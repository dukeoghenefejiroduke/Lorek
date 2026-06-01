import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

// Storage configuration
const STORAGE_PREFIX = '@IzonApp:';
const ENCRYPTION_KEY = process.env.EXPO_PUBLIC_STORAGE_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const CACHE_CLEANUP_THRESHOLD = 0.8; // 80% of max size

// Storage types for different purposes
export const StorageTypes = {
  USER_DATA: 'user_data',
  SETTINGS: 'settings',
  VOCABULARY: 'vocabulary',
  LESSONS: 'lessons',
  CACHE: 'cache',
  OFFLINE: 'offline',
  TEMP: 'temp',
  SECURE: 'secure',
};

class StorageService {
  constructor() {
    this.cache = new Map();
    this.pendingWrites = new Map();
    this.writeQueue = [];
    this.isProcessing = false;
    this.memoryCacheEnabled = true;
    this.encryptionEnabled = false; // Set to true in production with proper key
    this.stats = {
      reads: 0,
      writes: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
    };
    
    // Initialize storage
    this.initialize();
  }

  // Initialize storage service
  async initialize() {
    try {
      await this.cleanupOldCache();
      await this.loadStats();
      this.setupAutoCleanup();
    } catch (error) {
      console.error('Storage initialization failed:', error);
    }
  }

  // Generate consistent storage key with prefix
  _getKey(key, type = StorageTypes.DEFAULT) {
    return `${STORAGE_PREFIX}${type}:${key}`;
  }

  // Encrypt data (if encryption enabled)
  async _encrypt(data) {
    if (!this.encryptionEnabled) return data;
    
    try {
      const jsonString = JSON.stringify(data);
      // In production, implement proper encryption
      // This is a placeholder - use a proper encryption library
      const encrypted = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        jsonString + ENCRYPTION_KEY
      );
      return { encrypted: true, data: encrypted, original: jsonString };
    } catch (error) {
      console.error('Encryption failed:', error);
      return data;
    }
  }

  // Decrypt data (if encryption enabled)
  async _decrypt(data) {
    if (!this.encryptionEnabled || !data?.encrypted) return data;
    
    try {
      // In production, implement proper decryption
      return JSON.parse(data.original);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  // Compress data for storage
  async _compress(data) {
    // In production, implement compression (e.g., using pako or lz-string)
    return data;
  }

  // Decompress data
  async _decompress(data) {
    // In production, implement decompression
    return data;
  }

  // Enhanced save method with compression, encryption, and queueing
  async save(key, value, options = {}) {
    const {
      type = StorageTypes.DEFAULT,
      encrypt = false,
      compress = false,
      ttl = null, // Time to live in milliseconds
      immediate = false, // Skip queue for immediate writes
      skipCache = false,
    } = options;

    const storageKey = this._getKey(key, type);
    
    try {
      // Prepare metadata
      const metadata = {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ttl,
        version: '1.0',
        type,
        encrypted: encrypt,
        compressed: compress,
      };

      // Process value
      let processedValue = value;
      
      // Compress if needed
      if (compress) {
        processedValue = await this._compress(processedValue);
      }
      
      // Encrypt if needed
      if (encrypt) {
        processedValue = await this._encrypt(processedValue);
      }

      // Wrap with metadata
      const storageObject = {
        metadata,
        data: processedValue,
      };

      // Update memory cache
      if (this.memoryCacheEnabled && !skipCache) {
        this.cache.set(storageKey, {
          data: value, // Store original in cache
          metadata,
          timestamp: Date.now(),
        });
      }

      // Queue or immediate write
      if (immediate) {
        await this._writeToStorage(storageKey, storageObject);
      } else {
        await this._queueWrite(storageKey, storageObject);
      }

      // Update stats
      this.stats.writes++;
      await this._saveStats();

      return { success: true, key: storageKey };
    } catch (error) {
      this.stats.errors++;
      console.error(`Error saving to storage [${storageKey}]:`, error);
      return { success: false, error: error.message };
    }
  }

  // Queue write operations for performance
  async _queueWrite(key, value) {
    this.writeQueue.push({ key, value, timestamp: Date.now() });
    
    if (!this.isProcessing) {
      await this._processWriteQueue();
    }
  }

  // Process write queue in batches
  async _processWriteQueue() {
    if (this.isProcessing || this.writeQueue.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      // Group writes by key to avoid duplicates
      const uniqueWrites = new Map();
      this.writeQueue.forEach(item => {
        uniqueWrites.set(item.key, item);
      });
      
      // Write in batches of 10
      const batch = Array.from(uniqueWrites.values()).slice(0, 10);
      
      await Promise.all(
        batch.map(async (item) => {
          await this._writeToStorage(item.key, item.value);
          // Remove from queue
          this.writeQueue = this.writeQueue.filter(w => w.key !== item.key);
        })
      );
      
      // Process next batch if queue still has items
      if (this.writeQueue.length > 0) {
        setTimeout(() => this._processWriteQueue(), 100);
      }
    } catch (error) {
      console.error('Error processing write queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Actual write to AsyncStorage
  async _writeToStorage(key, value) {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      throw error;
    }
  }

  // Enhanced get method with caching, TTL, and error handling
  async get(key, options = {}) {
    const {
      type = StorageTypes.DEFAULT,
      defaultValue = null,
      skipCache = false,
      refresh = false, // Force refresh from storage
    } = options;

    const storageKey = this._getKey(key, type);
    
    try {
      this.stats.reads++;
      
      // Check memory cache first
      if (!skipCache && this.memoryCacheEnabled && !refresh) {
        const cached = this.cache.get(storageKey);
        if (cached) {
          // Check TTL
          if (cached.metadata.ttl) {
            const age = Date.now() - cached.metadata.updatedAt;
            if (age < cached.metadata.ttl) {
              this.stats.cacheHits++;
              return cached.data;
            } else {
              // Cache expired, remove it
              this.cache.delete(storageKey);
            }
          } else {
            this.stats.cacheHits++;
            return cached.data;
          }
        }
      }
      
      this.stats.cacheMisses++;
      
      // Get from storage
      const jsonValue = await AsyncStorage.getItem(storageKey);
      
      if (jsonValue === null) {
        return defaultValue;
      }
      
      const storageObject = JSON.parse(jsonValue);
      
      // Check TTL
      if (storageObject.metadata?.ttl) {
        const age = Date.now() - storageObject.metadata.updatedAt;
        if (age > storageObject.metadata.ttl) {
          // Data expired, remove it
          await this.remove(key, { type });
          return defaultValue;
        }
      }
      
      // Process data
      let data = storageObject.data;
      
      // Decrypt if needed
      if (storageObject.metadata?.encrypted) {
        data = await this._decrypt(data);
      }
      
      // Decompress if needed
      if (storageObject.metadata?.compressed) {
        data = await this._decompress(data);
      }
      
      // Update cache
      if (this.memoryCacheEnabled) {
        this.cache.set(storageKey, {
          data,
          metadata: storageObject.metadata,
          timestamp: Date.now(),
        });
      }
      
      return data;
    } catch (error) {
      this.stats.errors++;
      console.error(`Error getting from storage [${storageKey}]:`, error);
      return defaultValue;
    }
  }

  // Multi-get for batch operations
  async multiGet(keys, options = {}) {
    const { type = StorageTypes.DEFAULT } = options;
    
    try {
      const storageKeys = keys.map(key => this._getKey(key, type));
      const results = await AsyncStorage.multiGet(storageKeys);
      
      const parsed = {};
      results.forEach(([key, value], index) => {
        if (value) {
          try {
            parsed[keys[index]] = JSON.parse(value).data;
          } catch {
            parsed[keys[index]] = value;
          }
        }
      });
      
      return parsed;
    } catch (error) {
      console.error('Error in multiGet:', error);
      return {};
    }
  }

  // Multi-set for batch operations
  async multiSet(keyValuePairs, options = {}) {
    const { type = StorageTypes.DEFAULT } = options;
    
    try {
      const pairs = keyValuePairs.map(([key, value]) => {
        const storageKey = this._getKey(key, type);
        const storageObject = {
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            type,
          },
          data: value,
        };
        return [storageKey, JSON.stringify(storageObject)];
      });
      
      await AsyncStorage.multiSet(pairs);
      
      this.stats.writes += pairs.length;
      
      return { success: true };
    } catch (error) {
      console.error('Error in multiSet:', error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced remove method
  async remove(key, options = {}) {
    const { type = StorageTypes.DEFAULT, pattern = false } = options;
    
    try {
      if (pattern) {
        // Remove all keys matching pattern
        const allKeys = await AsyncStorage.getAllKeys();
        const matchingKeys = allKeys.filter(k => 
          k.startsWith(this._getKey(key, type))
        );
        
        await AsyncStorage.multiRemove(matchingKeys);
        
        // Clear from cache
        matchingKeys.forEach(k => this.cache.delete(k));
      } else {
        const storageKey = this._getKey(key, type);
        await AsyncStorage.removeItem(storageKey);
        this.cache.delete(storageKey);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error removing from storage:', error);
      return { success: false, error: error.message };
    }
  }

  // Clear all storage (use with caution)
  async clear(options = {}) {
    const { excludePrefixes = [] } = options;
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Filter keys based on exclude prefixes
      const keysToRemove = allKeys.filter(key => {
        return !excludePrefixes.some(prefix => key.startsWith(prefix));
      });
      
      await AsyncStorage.multiRemove(keysToRemove);
      
      // Clear cache
      this.cache.clear();
      
      return { success: true, removedCount: keysToRemove.length };
    } catch (error) {
      console.error('Error clearing storage:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all keys
  async getAllKeys(options = {}) {
    const { type = null, pattern = null } = options;
    
    try {
      let keys = await AsyncStorage.getAllKeys();
      
      if (type) {
        const prefix = this._getKey('', type);
        keys = keys.filter(key => key.startsWith(prefix));
      }
      
      if (pattern) {
        keys = keys.filter(key => key.includes(pattern));
      }
      
      return keys;
    } catch (error) {
      console.error('Error getting all keys:', error);
      return [];
    }
  }

  // Get storage size
  async getStorageSize() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += key.length + value.length;
        }
      }
      
      return {
        itemCount: keys.length,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      };
    } catch (error) {
      console.error('Error calculating storage size:', error);
      return { itemCount: 0, totalSize: 0, totalSizeMB: '0' };
    }
  }

  // Cleanup old cache entries
  async cleanupOldCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const now = Date.now();
      let removed = 0;
      
      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            const obj = JSON.parse(value);
            if (obj.metadata?.ttl && now - obj.metadata.updatedAt > obj.metadata.ttl) {
              await AsyncStorage.removeItem(key);
              this.cache.delete(key);
              removed++;
            }
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
      
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }

  // Auto cleanup based on size
  async cleanupIfNeeded() {
    try {
      const size = await this.getStorageSize();
      
      if (size.totalSize > MAX_CACHE_SIZE * CACHE_CLEANUP_THRESHOLD) {
        await this.cleanupOldestEntries();
      }
    } catch (error) {
      console.error('Error in cleanupIfNeeded:', error);
    }
  }

  // Cleanup oldest entries
  async cleanupOldestEntries(count = 100) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const entries = [];
      
      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            const obj = JSON.parse(value);
            entries.push({
              key,
              updatedAt: obj.metadata?.updatedAt || 0,
            });
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
      
      // Sort by oldest first
      entries.sort((a, b) => a.updatedAt - b.updatedAt);
      
      // Remove oldest entries
      const toRemove = entries.slice(0, Math.min(count, entries.length));
      await AsyncStorage.multiRemove(toRemove.map(e => e.key));
      
      // Clear from cache
      toRemove.forEach(e => this.cache.delete(e.key));
      
    } catch (error) {
      console.error('Error cleaning up oldest entries:', error);
    }
  }

  // Setup auto cleanup interval
  setupAutoCleanup() {
    // Cleanup every hour
    setInterval(() => {
      this.cleanupIfNeeded();
    }, 3600000);
  }

  // Save stats to storage
  async _saveStats() {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_PREFIX}system:storage_stats`,
        JSON.stringify(this.stats)
      );
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }

  // Load stats from storage
  async loadStats() {
    try {
      const statsJson = await AsyncStorage.getItem(`${STORAGE_PREFIX}system:storage_stats`);
      if (statsJson) {
        this.stats = JSON.parse(statsJson);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // Export data for backup
  async exportData(types = [StorageTypes.USER_DATA, StorageTypes.SETTINGS]) {
    try {
      const exportData = {};
      const allKeys = await AsyncStorage.getAllKeys();
      
      for (const type of types) {
        const prefix = this._getKey('', type);
        const typeKeys = allKeys.filter(key => key.startsWith(prefix));
        
        for (const key of typeKeys) {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            exportData[key] = JSON.parse(value);
          }
        }
      }
      
      return exportData;
    } catch (error) {
      console.error('Error exporting data:', error);
      return null;
    }
  }

  // Import data from backup
  async importData(data, options = { overwrite: false }) {
    try {
      const { overwrite } = options;
      
      if (overwrite) {
        // Clear existing data first
        const keys = Object.keys(data);
        await AsyncStorage.multiRemove(keys);
      }
      
      // Prepare import pairs
      const pairs = Object.entries(data).map(([key, value]) => [
        key,
        JSON.stringify(value),
      ]);
      
      await AsyncStorage.multiSet(pairs);
      
      return { success: true, importedCount: pairs.length };
    } catch (error) {
      console.error('Error importing data:', error);
      return { success: false, error: error.message };
    }
  }

  // Migrate data to new version
  async migrate(fromVersion, toVersion) {
    try {
      const versionKey = `${STORAGE_PREFIX}system:version`;
      const currentVersion = await this.get('version', { type: 'system' }, '1.0');
      
      if (currentVersion === fromVersion) {
        // Perform migration logic here
        
        // Update version
        await this.save('version', toVersion, { type: 'system' });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error during migration:', error);
      return { success: false, error: error.message };
    }
  }

  // Get storage statistics
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      queueSize: this.writeQueue.length,
      memoryCacheEnabled: this.memoryCacheEnabled,
      encryptionEnabled: this.encryptionEnabled,
    };
  }

  // Clear memory cache
  clearMemoryCache() {
    this.cache.clear();
  }

  // Toggle memory cache
  setMemoryCacheEnabled(enabled) {
    this.memoryCacheEnabled = enabled;
    if (!enabled) {
      this.clearMemoryCache();
    }
  }

  // Toggle encryption
  setEncryptionEnabled(enabled) {
    this.encryptionEnabled = enabled;
  }

  // Check if a key exists
  async has(key, options = {}) {
    const { type = StorageTypes.DEFAULT } = options;
    const storageKey = this._getKey(key, type);
    
    try {
      const value = await AsyncStorage.getItem(storageKey);
      return value !== null;
    } catch (error) {
      console.error('Error checking key existence:', error);
      return false;
    }
  }

  // Get multiple values by prefix
  async getByPrefix(prefix, options = {}) {
    const { type = StorageTypes.DEFAULT } = options;
    const fullPrefix = this._getKey(prefix, type);
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const matchingKeys = allKeys.filter(key => key.startsWith(fullPrefix));
      
      const values = {};
      for (const key of matchingKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const shortKey = key.replace(fullPrefix, '');
          values[shortKey] = JSON.parse(value).data;
        }
      }
      
      return values;
    } catch (error) {
      console.error('Error getting by prefix:', error);
      return {};
    }
  }
}

// Create and export a single instance
export const storage = new StorageService();

// Export individual methods for backward compatibility
export const save = storage.save.bind(storage);
export const get = storage.get.bind(storage);
export const remove = storage.remove.bind(storage);
export const clear = storage.clear.bind(storage);
export const multiGet = storage.multiGet.bind(storage);
export const multiSet = storage.multiSet.bind(storage);

export default storage;