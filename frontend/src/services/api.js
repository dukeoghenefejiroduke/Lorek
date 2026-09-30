import axios from 'axios';
import { get, save, multiSet, multiRemove, remove } from './storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import haptics from '../utils/haptics';
import { Platform, Alert } from 'react-native'; // Standard import
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment configuration with fallbacks
const ENV = {
  development: {
    API_URL: 'https://lorek.onrender.com/api',
    //API_URL: 'http://127.0.0.1:5000/api', // Android Emulator
    API_URL_IOS: 'https://lorek.onrender.com/api', // iOS Simulator
    API_URL_PHYSICAL: 'https://lorek.onrender.com/api', // Physical device
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    CACHE_TTL: 3600000, // 1 hour
  },
  staging: {
    API_URL: 'https://staging-api.izonlanguage.com/api',
    TIMEOUT: 20000,
    RETRY_ATTEMPTS: 2,
    CACHE_TTL: 1800000, // 30 minutes
  },
  production: {
    API_URL: 'https://api.izonlanguage.com/api',
    TIMEOUT: 15000,
    RETRY_ATTEMPTS: 1,
    CACHE_TTL: 900000, // 15 minutes
  }
};

// Determine environment
const ENVIRONMENT = process.env.EXPO_PUBLIC_APP_ENV || 'development';
const config = ENV[ENVIRONMENT];

// Helper to get language headers
export const getLanguageHeaders = async () => {
    const lang = await get('userLanguageCode');
    return lang ? { 'Accept-Language': lang.toUpperCase() } : {};
};

// Get appropriate API URL based on platform
const getApiUrl = () => {
  if (ENVIRONMENT !== 'development') return config.API_URL;
  
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_API_URL_IOS || config.API_URL_IOS;
  } else if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_API_URL || config.API_URL;
  }
  return config.API_URL_PHYSICAL;
};

const API_URL = getApiUrl();
if (__DEV__) console.log('📡 API Service Initialized with URL:', API_URL);
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

const DEFAULT_LANGUAGE_CODE = 'IZON'; // Neutral/placeholder default


const extractLanguageCode = (value) => {
  if (!value) return DEFAULT_LANGUAGE_CODE;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return extractLanguageCode(parsed);
    } catch {
      return value.toUpperCase();
    }
  }

  return (value.code || value.language || DEFAULT_LANGUAGE_CODE).toUpperCase();
};

// Request deduplication
const pendingRequests = new Map();

const api = axios.create({
  baseURL: API_URL,
  timeout: config.TIMEOUT,
  headers: { 
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Client-Version': '1.0.4',
    'X-Client-Platform': Platform.OS,
    'X-Client-Environment': ENVIRONMENT,
  },
  maxRedirects: 5,
  validateStatus: (status) => status >= 200 && status < 300,
});

api.interceptors.request.use(async (config) => {
    // Unique key for the request
    const requestKey = `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
    
    if (pendingRequests.has(requestKey)) {
        // Return existing promise
        return Promise.reject({ deduplicated: true, promise: pendingRequests.get(requestKey) });
    }
    
    // Create promise
    const promise = new Promise((resolve) => resolve(config));
    pendingRequests.set(requestKey, promise);
    
    return config;
});

api.interceptors.response.use(
    (response) => {
        // Remove from pending
        const requestKey = `${response.config.method}:${response.config.url}:${JSON.stringify(response.config.params)}`;
        pendingRequests.delete(requestKey);
        
        return response;
    },
    (error) => {
        // Remove from pending
        if (error.config) {
            const requestKey = `${error.config.method}:${error.config.url}:${JSON.stringify(error.config.params)}`;
            pendingRequests.delete(requestKey);
        }
        return Promise.reject(error);
    }
);

import { addToSyncQueue, processSyncQueue } from './syncService';

// Monitor network status
let isOnline = true;
let isRefreshing = false;
let failedQueue = [];

NetInfo.fetch().then(state => {
  if (state.isConnected !== null && state.isConnected !== undefined) {
    isOnline = state.isConnected;
  }
});

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

NetInfo.addEventListener(state => {
  const wasOnline = isOnline;
  isOnline = state.isConnected !== false;
  
  // Sync when coming online
  if (!wasOnline && isOnline) {
    processSyncQueue();
  }
});

// Interceptor to queue mutations when offline
// --- INTERCEPTORS ---

// ...

api.interceptors.request.use(
  async (config) => {
    // 1. Auth Headers
    const publicAuthRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email'];
    if (!publicAuthRoutes.some(route => config.url.includes(route))) {
        const token = await get('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    
    // 2. Offline Mode Handling
    if (!isOnline && (config.method !== 'get')) {
        await addToSyncQueue(config.method, config.url, config.data);
        return Promise.reject('Queued for offline sync');
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Enhanced response interceptor with retry logic
api.interceptors.response.use(
  (response) => {
    if (__DEV__) console.log(`✅ API Response: ${response.config.method.toUpperCase()} ${response.config.url} ${response.status}`);
    const duration = Date.now() - (response.config.metadata?.startTime || 0);
    
    // Add cache control headers
    if (response.config.method === 'get') {
      response.headers['cache-control'] = `max-age=${config.CACHE_TTL / 1000}`;
    }

    return response;
  },
  async (error) => {
    console.error(`❌ API Response Error: ${error.config?.url} ${error.message}`, error.response?.status);
    const originalConfig = error.config;
    
    // Don't retry if we've already retried or if it's not a GET request
    if (!originalConfig || originalConfig._retry || originalConfig.method !== 'get') {
      return handleApiError(error);
    }

    // Check if we should retry (network errors or 5xx)
    const shouldRetry = !error.response || (error.response.status >= 500 && error.response.status <= 599);
    
    if (shouldRetry) {
      originalConfig._retry = true;
      originalConfig._retryCount = originalConfig._retryCount || 0;
      
      if (originalConfig._retryCount < config.RETRY_ATTEMPTS) {
        originalConfig._retryCount++;
        
        // Exponential backoff
        const delay = Math.pow(2, originalConfig._retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        
        return api(originalConfig);
      }
    }

    return handleApiError(error);
  }
);

// Centralized error handler
const handleApiError = async (error) => {
  const errorResponse = {
    success: false,
    message: 'An unexpected error occurred',
    status: error.response?.status,
    data: error.response?.data,
    isNetworkError: !error.response,
    isTimeout: error.code === 'ECONNABORTED',
    timestamp: new Date().toISOString(),
  };

  // Categorize errors
  if (errorResponse.isNetworkError) {
    errorResponse.message = 'Network connection unavailable. Please check your internet connection.';
    errorResponse.type = 'NETWORK_ERROR';
  } else if (errorResponse.isTimeout) {
    errorResponse.message = 'Request timed out. Please try again.';
    errorResponse.type = 'TIMEOUT_ERROR';
  } else if (error.response) {
    switch (error.response.status) {
      case 400:
        errorResponse.message = error.response.data?.message || 'Invalid request';
        errorResponse.type = 'BAD_REQUEST';
        break; 
        
      case 401:
        const isGhostUser = error.response.data?.message === 'User not found';
        if (isGhostUser) {
          // Now await works here
          await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
          return Promise.reject({ ...errorResponse, type: 'GHOST_USER' });
        }
        return handleUnauthorized(error);

      case 403: 
        errorResponse.message = "You don't have permission to perform this action";
        errorResponse.type = 'FORBIDDEN';
        break;

      case 404:
        errorResponse.message = 'Resource not found';
        errorResponse.type = 'NOT_FOUND';
        break;
      case 422:
        errorResponse.message = error.response.data?.message || 'Validation failed';
        errorResponse.type = 'VALIDATION_ERROR';
        errorResponse.errors = error.response.data?.errors;
        break;
      case 429:
        errorResponse.message = 'Too many requests. Please slow down.';
        errorResponse.type = 'RATE_LIMIT';
        break;
      case 500:
        errorResponse.message = 'Server error. Please try again later.';
        errorResponse.type = 'SERVER_ERROR';
        break;
      default:
        errorResponse.message = error.response.data?.message || 'Something went wrong';
        errorResponse.type = 'UNKNOWN_ERROR';
    }
  }

  // Log error in development
  if (__DEV__) {
    console.error('❌ API Error:', {
      ...errorResponse,
      originalError: error.message,
      config: error.config,
    });
  }

  // Provide haptic feedback for errors (optional)
  haptics.notificationError();

  return Promise.reject(errorResponse);
};

const handleUnauthorized = async (error) => {
  const originalRequest = error.config;

  // 1. If we are already on the login screen or trying to refresh, don't loop
  if (originalRequest.url.includes('/auth/refresh-token') || originalRequest.url.includes('/auth/login')) {
    await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
    return Promise.reject(error);
  }

  if (originalRequest._retry) {
    return Promise.reject(error);
  }

  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    }).then(token => {
      originalRequest.headers['Authorization'] = 'Bearer ' + token;
      return api(originalRequest);
    }).catch(err => Promise.reject(err));
  }

  originalRequest._retry = true;
  isRefreshing = true;
  
  try {
    const refreshToken = await get('refreshToken');
    
    // CHANGE: If no refresh token exists, just reject silently so the app 
    // can redirect to login without showing a confusing "Token Error" alert.
    if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject({ ...error, message: "Session expired", silent: true });
    }

    const response = await api.post('/auth/refresh-token', { refreshToken });
    const { token: newToken, refreshToken: newRefreshToken } = response.data;

    await multiSet([
      ['token', newToken],
      ['refreshToken', newRefreshToken]
    ]);
    
    processQueue(null, newToken);
    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
    return api(originalRequest);
  } catch (refreshError) {
    processQueue(refreshError, null);
    // Only wipe and alert if it was a genuine authentication failure
    if (refreshError.response?.status !== 429) {
        await multiRemove(['token', 'refreshToken', 'user']);
    }
    return Promise.reject(refreshError);
  } finally {
    isRefreshing = false;
  }
};

// Cache management
const cache = new Map();
const pendingGetRequests = new Map();

const getCachedResponse = async (key, ttl = config.CACHE_TTL) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  return null;
};

const setCachedResponse = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
};

// Enhanced GET with caching and deduplication
api.getWithCache = async (url, params = {}, ttl = config.CACHE_TTL, headers = {}) => {
  const cacheKey = `${url}_${JSON.stringify(params)}`;
  
  // Check cache first
  const cached = await getCachedResponse(cacheKey, ttl);
  if (cached) {
    return { data: cached, fromCache: true };
  }
  
  // Check if there's already a pending request for this URL
  const pendingKey = cacheKey;
  if (pendingGetRequests.has(pendingKey)) {
    return pendingGetRequests.get(pendingKey);
  }
  
  // Make the request
  const requestPromise = api.get(url, { params, headers })
    .then(response => {
      setCachedResponse(cacheKey, response.data);
      pendingGetRequests.delete(pendingKey);
      return { data: response.data, fromCache: false };
    })
    .catch(error => {
      pendingGetRequests.delete(pendingKey);
      throw error;
    });
  
  pendingGetRequests.set(pendingKey, requestPromise);
  return requestPromise;
};

// --- AUTH API ---
export const authAPI = {
  register: async (data) => {
    const response = await api.post('/auth/register', data);   
    const { token, refreshToken, user } = response.data;
    if (token) {
      await multiSet([
        ['token', token],
        ['refreshToken', refreshToken],
        ['user', user]
      ]);
      // FORCED UPDATE: Manually attach token to the instance for the next immediate call
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    return response;
  },
  
  login: async (data) => {
    const response = await api.post('/auth/login', data);
    const { token, refreshToken, user } = response.data;
    if (token) {
      await multiSet([
        ['token', response.data.token],
        ['refreshToken', refreshToken],
        ['user', user]
      ]);
      // FORCED UPDATE: Manually attach token to the instance for the next immediate call
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return response;
  },
  
  googleAuth: async (data) => {
    const response = await api.post('/auth/google', data);
    const { token, refreshToken, user } = response.data;
    if (token) {
      await multiSet([
        ['token', token],
        ['refreshToken', refreshToken],
        ['user', user]
      ]);
      // FORCED UPDATE: Manually attach token to the instance for the next immediate call
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return response;
  },
  
logout: async () => {
  try {
    const token = await get('token');
    if (token) {
      await api.post('/auth/logout');
    }
  } catch (error) {
    console.warn('Logout API error:', error);
  } finally {
    await multiRemove(['token', 'refreshToken', 'user', 'sessionExpiry']); // Added sessionExpiry
    delete api.defaults.headers.common['Authorization'];
    cache.clear();
  }
},

  verifyReferralCode: (code) => api.get(`/auth/verify-referral/${code}`),

  refreshToken: (data) => api.post('/auth/refresh-token', data),
  
  generateApiKey: (data) => api.post('/auth/generate-api-key', data),
  
  getApiKeys: () => api.get('/auth/api-keys'),
  
  revokeApiKey: (keyId) => api.delete(`/auth/api-keys/${keyId}`),
  
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  
  changePassword: (data) => api.post('/auth/change-password', data),
  
  getProfile: () => api.get('/auth/profile'),
  
  updateProfile: (data) => api.put('/auth/profile', data),
  
};

// --- VOCABULARY API ---
export const vocabularyAPI = {
  // Admin methods
  addWord: (data) => api.post('/vocabulary/add', data),
  addBulk: (data) => api.post('/vocabulary/bulk', data),
  updateWord: (id, data) => api.put(`/vocabulary/${id}`, data),
  deleteWord: (id) => api.delete(`/vocabulary/${id}`),
  verifyWord: (id) => api.post(`/vocabulary/${id}/verify`),
  
  // Learning methods
  getSmartReview: async (params) => api.get('/vocabulary/mastery/stats', { params, headers: await getLanguageHeaders() }),
  updateSRS: async (wordId, score) => api.post('/vocabulary/mastery/update', { wordId, quality: score }, { headers: await getLanguageHeaders() }),
  batchUpdateSRS: async (updates) => api.post('/vocabulary/mastery/batch-update', { updates }, { headers: await getLanguageHeaders() }),
  getPersonalizedMix: async () => api.get('/vocabulary/daily-mix/personalized', { headers: await getLanguageHeaders() }),
  getRandomSelection: async (params) => api.get('/vocabulary/random/selection', { params, headers: await getLanguageHeaders() }),
  getLearningSuggestions: async () => api.get('/vocabulary/suggestions/learning', { headers: await getLanguageHeaders() }),
  getReviewQueue: async () => api.get('/vocabulary/review', { headers: await getLanguageHeaders() }),
  
  // Public methods with caching
  getAll: async (params) => {
    return api.getWithCache('/vocabulary', params, config.CACHE_TTL, await getLanguageHeaders());
  },
  
  getById: async (id) => api.get(`/vocabulary/${id}`, { headers: await getLanguageHeaders() }),
  
  search: async (query) => {
    return api.getWithCache('/vocabulary/search', { q: query }, config.CACHE_TTL, await getLanguageHeaders());
  },
  
  getByCategory: async (category) => {
    return api.getWithCache('/vocabulary/category/' + category, {}, config.CACHE_TTL, await getLanguageHeaders());
  },
  
  getDailyWord: async () => api.get('/vocabulary/daily-mix/personalized', { headers: await getLanguageHeaders() }),
  getFeaturedWordOfDay: async () => api.get('/vocabulary/word-of-day/featured', { headers: await getLanguageHeaders() }),
  
  getFavorites: async () => api.get('/vocabulary/favorites/list', { headers: await getLanguageHeaders() }),
  
  addToFavorites: async (wordId) => api.post(`/vocabulary/${wordId}/favorite`, {}, { headers: await getLanguageHeaders() }),
  
  removeFromFavorites: async (wordId) => api.delete(`/vocabulary/${wordId}/favorite`, { headers: await getLanguageHeaders() }),
  
  reportWord: (wordId, data) => api.post(`/vocabulary/${wordId}/report`, data),
  
  getRecent: async () => api.get('/vocabulary/recent', { headers: await getLanguageHeaders() }),
  
  getStats: async () => api.get('/vocabulary/stats', { headers: await getLanguageHeaders() }),
  getOverviewStats: async () => api.get('/vocabulary/stats/overview', { headers: await getLanguageHeaders() }),
  
  // Public endpoints
  public: {
    getAll: (params) => api.get('/public/vocabulary', { params }),
    search: (query) => api.get(`/public/vocabulary/search`, { params: { q: query } }),
    getDaily: () => api.get('/public/word-of-day'),
    getCategories: () => api.get('/public/categories'),
    getCategoryByName: (name) => api.get(`/public/categories/${name}`),
    getByCategory: (category) => api.get(`/public/vocabulary/category/${category}`),
  }
};

// --- GAMIFICATION API ---
export const gamificationAPI = {
  getUserStats: async () => api.get('/progress/stats', { headers: await getLanguageHeaders() }), 
  updateProgress: async (lessonId, data) => api.post(`/progress/lesson/${lessonId}`, data, { headers: await getLanguageHeaders() }),
  
  getLeaderboard: async (params = { period: 'weekly' }) => api.get('/progress/leaderboard', { params, headers: await getLanguageHeaders() }),
  
  checkBadges: async () => api.post('/progress/achievements/check', {}, { headers: await getLanguageHeaders() }),
  
  getBadges: async () => api.get('/progress/badges', { headers: await getLanguageHeaders() }),
  
  getAchievements: async () => api.get('/progress/achievements', { headers: await getLanguageHeaders() }),
  
  getStreakInfo: async () => api.get('/progress/streak', { headers: await getLanguageHeaders() }),
  
  getPoints: async () => api.get('/progress/points', { headers: await getLanguageHeaders() }),
  
  getRank: async () => api.get('/progress/rank', { headers: await getLanguageHeaders() }),
  
  claimReward: async (rewardId) => api.post(`/progress/rewards/${rewardId}/claim`, {}, { headers: await getLanguageHeaders() }),
};

export const leaderboardAPI = {
   getLeaderboard: (params) => api.get('/leaderboard', { params }),
   getUserRank: () => api.get('/leaderboard/rank'),
   getFriendsLeaderboard: (params) => api.get('/leaderboard/friends', { params }),
}

// --- LESSON API ---
export const lessonAPI = {
  // User Methods
  // Change the default params or pass them when calling
  getAll: async (params = { includeProgress: 'true' }) => 
    api.get('/lessons', { 
      params, 
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0', ...await getLanguageHeaders() } 
    }),
  getById: async (id) => api.get(`/lessons/${id}`, { headers: await getLanguageHeaders() }),
  complete: async (id, data) => api.post(`/lessons/${id}/complete`, data, { headers: await getLanguageHeaders() }),
  getProgress: async (id) => api.get(`/lessons/${id}/progress`, { headers: await getLanguageHeaders() }),
  getRecommendations: async () => api.get('/lessons/recommendations/list', { headers: await getLanguageHeaders() }),
  search: async (query) => api.get('/lessons', { params: { search: query }, headers: await getLanguageHeaders() }),
  getByLevel: async (level) => api.get('/lessons', { params: { level }, headers: await getLanguageHeaders() }),
  getByCategory: async (category) => api.get('/lessons', { params: { category }, headers: await getLanguageHeaders() }),

  // Admin Methods
    create: (data) => api.post('/lessons', data),
    update: (id, data) => api.put(`/lessons/${id}`, data),
    delete: (id) => api.delete(`/lessons/${id}`), // Archives the lesson
    publish: (id) => api.post(`/lessons/${id}/publish`),
    getStats: () => api.get('/lessons/stats/overview'),
    getAdminLessons: () => axios.get('/api/lessons?adminView=true'), 

    // Public Methods
    public: {
      getAll: (params) => api.get('/public/lessons', { params }),
      getById: (id) => api.get('/public/lessons/' + id),
    }
};

// --- PROGRESS API ---
export const progressAPI = {
  get: async () => api.get('/progress', { headers: await getLanguageHeaders() }),
  getCategories: async () => api.get('/progress/categories', { headers: await getLanguageHeaders() }),
  update: async (data) => api.post('/progress', data, { headers: await getLanguageHeaders() }),
  
  getGraph: async (params) => api.get('/progress/graph', { params, headers: await getLanguageHeaders() }),
  
  getMonthly: async (month, year) => api.get('/progress/monthly', { params: { month, year }, headers: await getLanguageHeaders() }),
  
  getYearly: async (year) => api.get('/progress/yearly', { params: { year }, headers: await getLanguageHeaders() }),
  
  reset: async () => api.post('/progress/reset', {}, { headers: await getLanguageHeaders() }),
  
  export: () => api.get('/progress/export', { responseType: 'blob' }),
  
  
  updateStreak: async (forceCheck = false) => api.post('/progress/streak', { forceCheck }, { headers: await getLanguageHeaders() }),
  checkMilestones: async () => api.post('/progress/milestone', {}, { headers: await getLanguageHeaders() }),
  getLeaderboard: async (params) => api.get('/progress/leaderboard', { params, headers: await getLanguageHeaders() }),
  getAchievements: async () => api.get('/progress/achievements', { headers: await getLanguageHeaders() }),
  getDetailedStats: async () => api.get('/progress/stats/detailed', { headers: await getLanguageHeaders() }),
};

// --- TRANSLATOR API ---
export const translatorAPI = {
  translate: async (data) => api.post('/translator/translate', data, { headers: await getLanguageHeaders() }),
  translateBatch: async (data) => api.post('/translator/translate/batch', data, { headers: await getLanguageHeaders() }),
  translateGet: async (params) => api.get('/translator/translate', { params, headers: await getLanguageHeaders() }),
  detectLanguage: async (text) => api.post('/translator/detect', { text }, { headers: await getLanguageHeaders() }),
  saveToHistory: async (data) => api.post('/translator/translations', data, { headers: await getLanguageHeaders() }),
  getHistory: async () => api.get('/translator/translations', { headers: await getLanguageHeaders() }),
  getFavorites: async () => api.get('/translator/translations/favorites', { headers: await getLanguageHeaders() }),
  toggleFavorite: async (id) => api.put(`/translator/translations/${id}/favorite`, {}, { headers: await getLanguageHeaders() }),
  deleteTranslation: async (id) => api.delete(`/translator/translations/${id}`, { headers: await getLanguageHeaders() }),
  clearHistory: async () => api.delete('/translator/translations/clear', { headers: await getLanguageHeaders() }),
  getOfflinePack: async () => api.get('/translator/translations/offline-pack', { headers: await getLanguageHeaders() }),
};

// --- PRONUNCIATION API ---
export const pronunciationAPI = {
  getGuide: async () => api.get('/public/pronunciation/guide', { headers: await getLanguageHeaders() }),
  
  getVocabularyWithPronunciation: async (params = {}) => api.get('/vocabulary', {
    params: { ...params, includePronunciation: 'true' },
    headers: await getLanguageHeaders()
  }),
  
  validate: async (data) => api.post('/public/validate', data, { headers: await getLanguageHeaders() }),
  
  getAudio: async (wordId) => api.get(`/pronunciation/audio/${wordId}`, { responseType: 'blob', headers: await getLanguageHeaders() }),
  
  submitRecording: async (wordId, audioBlob) => {
    const formData = new FormData();
    formData.append('audio', {
      uri: audioBlob,
      type: 'audio/m4a',
      name: `recording_${wordId}.m4a`,
    });
    return api.post(`/pronunciation/${wordId}/validate`, formData, {
      headers: { 'Content-Type': 'multipart/form-data', ...await getLanguageHeaders() },
    });
  },
  
  getTips: async (wordId) => api.get(`/pronunciation/${wordId}/tips`, { headers: await getLanguageHeaders() }),
};

// --- REFERRAL API ---
export const referralAPI = {
  getStats: () => api.get('/referral/referral-stats'),
  getCode: () => api.get('/referral/referral-code'),
  generateNewCode: () => api.post('/referral/referral-code/generate'),
  getReferrals: (params) => api.get('/referral/referrals', { params }),
  claimRewards: (data) => api.post('/referral/referral-rewards/claim', data),
  rewards: () => api.get('/referral/referral-rewards'),
  processReferral: (data) => api.post('/referral/process', data),
};

// --- NOTIFICATION API ---
export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete('/notifications'),
  getSettings: () => api.get('/notifications/settings'),
  updateSettings: (data) => api.put('/notifications/settings', data),
  registerToken: (data) => api.post('/notifications/register-token', data),
  unregisterToken: (data) => api.delete('/notifications/register-token', { data }),
};


// --- ADMIN API ---
export const adminAPI = {  // Dashboard
  getDashboard: () => api.get('/admin/dashboard'), 
  
  // Users
  getUsers: (params) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  
  // Content
  createCourse: (data) => api.post('/admin/content/courses', data),
  createSection: (data) => api.post('/admin/content/sections', data),
  createUnit: (data) => api.post('/admin/content/units', data),
  getContentStats: () => api.get('/admin/content/stats'),
  getPendingContent: () => api.get('/admin/content/pending'),
  moderateContent: (id, action) => api.post(`/admin/content/moderate/${id}`, { action }),
  getPendingContributions: () => api.get('/admin/contributions/pending'),
  moderateContribution: (id, action) => api.post(`/admin/content/moderate/${id}`, { action }),
  
  // KnowledgeBase
  getKnowledge: () => api.get('/admin/knowledge'),
  addKnowledge: (data) => api.post('/admin/knowledge', data),
  updateKnowledge: (id, data) => api.put(`/admin/knowledge/${id}`, data),
  deleteKnowledge: (id) => api.delete(`/admin/knowledge/${id}`),
  
  // Analytics
  getAnalytics: (params) => api.get('/admin/analytics', { params }),
  exportData: (type) => api.get(`/admin/export/${type}`, { responseType: 'blob' }),

  // Top Contributors
  getTopContributors: () => api.get('/admin/users/contributors/top'),
  
  // Versioning
  createVersion: (data) => api.post('/admin/version', data),
};

export const userAPI = {
  getSummary: () => api.get('/user/me'),
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data),
  uploadAvatar: (formData) => api.post('/user/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  removeAvatar: () => api.delete('/user/avatar'),
  getStats: () => api.get('/user/stats'),
  changePassword: (data) => api.post('/user/change-password', data),
  deleteAccount: () => api.delete('/user/account'),
  
   getUserProfile: (userId) => api.get(`/user/profile/${userId}`),
  getUserStats: (userId) => api.get(`/user/stats/${userId}`),
  getUserBadges: (userId) => api.get(`/user/badges/${userId}`),
  getUserActivity: (userId) => api.get(`/user/activity/${userId}`),
};

export const communityAPI = {
  getLeaderboard: (params) => api.get('/community/leaderboard', { params }),
  
  // Contributions
  getMyContributions: () => api.get('/community/contributions/me'),
  getPendingContributions: () => api.get('/community/contributions/pending'),
  reviewContribution: (contributionId, data) => api.post(`/community/contributions/${contributionId}/review`, data),
  
  // Posts
  getFeed: (params) => api.get('/community/feed', { params }),
  createPost: (data) => api.post('/community/posts', data),
  likePost: (postId) => api.post(`/community/posts/${postId}/like`),
  deletePost: (postId) => api.delete(`/community/posts/${postId}`),
  
  // Comments
  getComments: (postId, params) => api.get(`/community/posts/${postId}/comments`, { params }),
  addComment: (postId, data) => api.post(`/community/posts/${postId}/comments`, data),
  
  // Friends
  sendFriendRequest: (userId) => api.post(`/community/friends/request/${userId}`),
  acceptFriendRequest: (requestId) => api.post(`/community/friends/accept/${requestId}`),
  getFriends: () => api.get('/community/friends'),
  getFriendRequests: () => api.get('/community/friends/requests'),
  getSentRequests: () => api.get('/community/friends/requests/sent'),
  
  // Discussions
  getDiscussions: (params) => api.get('/community/discussions', { params }),
  createDiscussion: (data) => api.post('/community/discussions', data),
  likeReply: (discussionId, replyId) => api.post(`/community/discussions/${discussionId}/replies/${replyId}/like`),
  reportDiscussion: (discussionId, data) => api.post(`/community/discussions/${discussionId}/report`, data),
  pinDiscussion: (discussionId, data) => api.post(`/community/discussions/${discussionId}/pin`, data),
  getDiscussion: (discussionId) => api.get(`/community/discussions/${discussionId}`),
  replyToDiscussion: (discussionId, data) => api.post(`/community/discussions/${discussionId}/reply`, data),
};

export const cultureAPI = {
  // Categories
  getCategories: async (params) => api.get('/culture/categories', { params, headers: await getLanguageHeaders() }),
  
  // Content
  getContentByCategory: async (categoryId, params) => api.get(`/culture/category/${categoryId}`, { params, headers: await getLanguageHeaders() }),
  getContentItem: async (contentId) => api.get(`/culture/content/${contentId}`, { headers: await getLanguageHeaders() }),
  
  // Proverbs
  getProverbs: async (params) => api.get('/culture/proverbs', { params, headers: await getLanguageHeaders() }),
  getProverbOfDay: async (params) => api.get('/culture/proverbs/daily', { params, headers: await getLanguageHeaders() }),
  getProverb: async (id) => api.get(`/culture/proverbs/${id}`, { headers: await getLanguageHeaders() }),
  getFeaturedProverbs: async () => api.get('/culture/proverbs/featured', { headers: await getLanguageHeaders() }),
  getProverbsByCategory: async (category) => api.get(`/culture/proverbs/category/${category}`, { headers: await getLanguageHeaders() }),
  searchProverbs: async (query) => api.get('/culture/proverbs/search', { params: { q: query }, headers: await getLanguageHeaders() }),
  getProverbStats: async () => api.get('/culture/proverbs/stats', { headers: await getLanguageHeaders() }),
  
  // Interactions
  submitProverbFeedback: async (id, data) => api.post(`/culture/proverbs/${id}/feedback`, data, { headers: await getLanguageHeaders() }),
  addProverbComment: async (id, data) => api.post(`/culture/proverbs/${id}/comments`, data, { headers: await getLanguageHeaders() }),
  likeProverb: async (id) => api.post(`/culture/proverbs/${id}/like`, {}, { headers: await getLanguageHeaders() }),
  shareProverb: async (id) => api.post(`/culture/proverbs/${id}/share`, {}, { headers: await getLanguageHeaders() }),
  
  // Admin
  createContent: (data) => api.post('/culture/admin/content', data),
  updateContent: (id, data) => api.put(`/culture/admin/content/${id}`, data),
  createProverb: (data) => api.post('/culture/admin/proverbs', data),
  updateProverb: (id, data) => api.put(`/culture/admin/proverbs/${id}`, data),
  deleteProverb: (id) => api.delete(`/culture/admin/proverbs/${id}`),
  verifyProverb: (id) => api.post(`/culture/admin/proverbs/${id}/verify`),
  
  // Public
  public: {
    getAll: () => api.get('/culture/'),
    getCategories: (params) => api.get('/culture/categories', { params }),
    getProverbs: (params) => api.get('/culture/proverbs', { params }),
    getProverbToday: () => api.get('/public/proverbs/today'),
  }
};

export const gamesAPI = {
  startGame: async (data) => api.post('/games/start', data, { headers: await getLanguageHeaders() }),
  submitGame: async (data) => api.post('/games/submit', data, { headers: await getLanguageHeaders() }),
  getStats: async () => api.get('/games/stats', { headers: await getLanguageHeaders() }),
  getLeaderboard: async (gameType, params) => api.get(`/games/leaderboard/${gameType}`, { params, headers: await getLanguageHeaders() }),
  getHistory: async (params) => api.get('/games/history', { params, headers: await getLanguageHeaders() }),
  getWords: async (params) => api.get('/games/words', { params, headers: await getLanguageHeaders() }),
};

export const messagesAPI = {
  // Conversations
  getConversations: (params) => api.get('/messages/conversations', { params }),
  getConversation: (conversationId) => api.get(`/messages/conversation/${conversationId}`),
  createConversation: (data) => api.post('/messages/conversation', data),
  deleteConversation: (conversationId) => api.delete(`/messages/conversations/${conversationId}`),
  
  // Messages
  getMessages: (conversationId, params) => api.get(`/messages/conversations/${conversationId}/messages`, { params }),
  sendMessage: (data) => api.post('/messages', data),
  deleteMessage: (messageId) => api.delete(`/messages/${messageId}`),
  
  // Unread
  getUnreadCount: () => api.get('/messages/unread/count'),
};

export const practiceAPI = {
  getDaily: async (params) => api.get('/practice/daily', { params, headers: await getLanguageHeaders() }),
  submitResult: async (data) => api.post('/practice/submit', data, { headers: await getLanguageHeaders() }),
  getStats: async () => api.get('/practice/stats', { headers: await getLanguageHeaders() }),
  getForecast: async () => api.get('/practice/forecast', { headers: await getLanguageHeaders() }),
};

export const languagesAPI = {
  getAll: () => api.get('/languages'),
  
  getAvailableLanguages: () => api.get('/user/languages'),
  
  getByCode: (code) => api.get(`/languages/${code}`),
  getUserActiveLanguage: () => api.get('/languages/user/active'),
  setActiveLanguage: async (languageCode) => {
    const response = await api.post('/languages/user/active', { languageCode: extractLanguageCode(languageCode) });
    const activeLanguage = response.data?.data?.activeLanguage;

    if (activeLanguage) {
      await save('userLanguage', activeLanguage);
    } else {
      await save('userLanguage', { code: extractLanguageCode(languageCode) });
    }

    apiUtils.clearCache();
    return response;
  },
  addLanguage: (languageCode) => api.post('/languages/user/add', { languageCode }),
  removeLanguage: (languageCode) => api.delete(`/languages/user/remove/${languageCode}`),
  updateLearningLanguage: async (language) => {
    // 1. Save to Backend
    const response = await api.put('/user/language', { language });
    
    // 2. Save Locally so the interceptor uses it for the next call
    await save(
      'userLanguage',
      typeof language === 'string' ? { code: extractLanguageCode(language) } : language
    );
    
    // 3. Clear cache since data is language-specific
    apiUtils.clearCache();
    
    return response;
  },
};

export const premiumAPI = {
  getStatus: () => api.get('/premium/status'),
  getPricing: () => api.get('/premium/pricing'),
  checkFeature: (featureName) => api.get(`/premium/feature/${featureName}`),
  checkLimit: (actionType) => api.get(`/premium/check-limit/${actionType}`),
  trackUsage: (data) => api.post('/premium/track-usage', data),
  createSubscription: (data) => api.post('/premium/subscribe', data),
  cancelSubscription: (data) => api.post('/premium/cancel', data),
};

// --- UTILITY FUNCTIONS ---
export const apiUtils = {
  // Clear all caches
  clearCache: () => {
    cache.clear();
    pendingRequests.clear();
    pendingGetRequests.clear();
  },
  
  // Get queue status
  getQueueStatus: () => ({
    queuedRequests: failedQueue.length,
    isOnline,
  }),
  
  // Force process queue
  processQueue,
  
  // Check API health
  checkHealth: () => api.get('/health'),
  
  // Get API version
  getVersion: () => api.get('/version'),
  
  // Submit general feedback
  submitFeedback: (data) => api.post('/public/feedback', data),
  
  // Cancel all pending requests
  cancelAllRequests: () => {
    pendingRequests.clear();
    pendingGetRequests.clear();
  },
};

export default api;
