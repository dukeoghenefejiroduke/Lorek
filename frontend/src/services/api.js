import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import haptics from '../utils/haptics';
import { Platform, Alert } from 'react-native'; // Standard import

// Environment configuration with fallbacks
const ENV = {
  development: {
    API_URL: 'https://lorek.onrender.com/api', // Android Emulator
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

// Create axios instance with advanced configuration
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

// Request queue for offline support
let requestQueue = [];
let isOnline = true;

let isRefreshing = false;
let failedQueue = [];

// Monitor network status
NetInfo.addEventListener(state => {
  const wasOnline = isOnline;
  isOnline = state.isConnected && state.isInternetReachable;
  
  if (!wasOnline && isOnline) {
    // Device came online, process queue
    processRequestQueue();
  }
});

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Process queued requests
const processRequestQueue = async () => {
  
  while (requestQueue.length > 0) {
    const queuedRequest = requestQueue.shift();
    try {
      const response = await api(queuedRequest.config);
      if (queuedRequest.resolve) {
        queuedRequest.resolve(response);
      }
    } catch (error) {
      if (queuedRequest.reject) {
        queuedRequest.reject(error);
      }
    }
  }
};

// Enhanced request interceptor
api.interceptors.request.use(
  async (config) => {
    // Generate request ID for tracking
    config.metadata = { 
      startTime: Date.now(),
      requestId: await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${config.url}-${Date.now()}-${Math.random()}`
      ).then(hash => hash.substring(0, 8))
    };

    // Add auth token if available
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Check if the URL is a "public" or "auth" endpoint
      const isAuthRequest = config.url.includes('/auth/') || config.url.includes('/public/');
      
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      const language = extractLanguageCode(await AsyncStorage.getItem('userLanguage')); 
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else if (!isAuthRequest) {
      // OPTIONAL: If it's a private route and no token exists, 
      // you could throw a custom error here to stop the request early.
      console.warn(`⚠️ No token found for private route: ${config.url}`);
    }
  
   if (refreshToken) {
        config.headers['X-Refresh-Token'] = refreshToken;
      }

      // Re-introducing language context via query parameter only for content-heavy screens
      config.headers['Accept-Language'] = language;
      
      const contentHeavyRoutes = [
        '/games/',
        '/practice/',
        '/lessons/',
        '/vocabulary/',
        '/pronunciation/',
        '/culture/',
        '/progress/',
        '/leaderboard/',
        '/translator/',
        '/home/' // Placeholder, adjust based on actual endpoint
      ];
      
      const shouldIncludeLang = contentHeavyRoutes.some(route => config.url.includes(route));
      
      if (config.method === 'get' && shouldIncludeLang) {
        config.params = { ...config.params, lang: language };
      }
    } catch (err) {
      console.warn('⚠️ Failed to get language/token from storage', err);
    }

    // Check for offline mode
    if (!isOnline && config.method !== 'get') {
      // Queue the request for later
      return new Promise((resolve, reject) => {
        requestQueue.push({
          config,
          resolve,
          reject,
          timestamp: Date.now(),
        });
      });
    }

    // Log request in development
    if (__DEV__) {
      // Request logging disabled for production security
    }

    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with retry logic
api.interceptors.response.use(
  (response) => {
    const duration = Date.now() - (response.config.metadata?.startTime || 0);
    
    // Log response in development
    if (__DEV__) {
      // Response logging disabled for production security
    }

    // Add cache control headers
    if (response.config.method === 'get') {
      response.headers['cache-control'] = `max-age=${config.CACHE_TTL / 1000}`;
    }

    return response;
  },
  async (error) => {
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

  if (originalRequest._retry) return Promise.reject(error);

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
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    
    // CHANGE: If no refresh token exists, just reject silently so the app 
    // can redirect to login without showing a confusing "Token Error" alert.
    if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject({ ...error, message: "Session expired", silent: true });
    }

    const response = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
    const { token: newToken, refreshToken: newRefreshToken } = response.data;

    await AsyncStorage.multiSet([
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
        await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
    }
    return Promise.reject(refreshError);
  } finally {
    isRefreshing = false;
  }
};

// Cache management
const cache = new Map();
const pendingRequests = new Map();

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
api.getWithCache = async (url, params = {}, ttl = config.CACHE_TTL) => {
  const cacheKey = `${url}_${JSON.stringify(params)}`;
  
  // Check cache first
  const cached = await getCachedResponse(cacheKey, ttl);
  if (cached) {
    return { data: cached, fromCache: true };
  }
  
  // Check if there's already a pending request for this URL
  const pendingKey = cacheKey;
  if (pendingRequests.has(pendingKey)) {
    return pendingRequests.get(pendingKey);
  }
  
  // Make the request
  const requestPromise = api.get(url, { params })
    .then(response => {
      setCachedResponse(cacheKey, response.data);
      pendingRequests.delete(pendingKey);
      return { data: response.data, fromCache: false };
    })
    .catch(error => {
      pendingRequests.delete(pendingKey);
      throw error;
    });
  
  pendingRequests.set(pendingKey, requestPromise);
  return requestPromise;
};

// --- AUTH API ---
export const authAPI = {
  register: async (data) => {
    const response = await api.post('/auth/register', data);   
    const { token, refreshToken, user } = response.data;
    if (token) {
      await AsyncStorage.multiSet([
        ['token', token],
        ['refreshToken', refreshToken],
        ['user', JSON.stringify(user)]
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
      await AsyncStorage.multiSet([
        ['token', response.data.token],
        ['refreshToken', refreshToken],
        ['user', JSON.stringify(user)]
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
      await AsyncStorage.multiSet([
        ['token', token],
        ['refreshToken', refreshToken],
        ['user', JSON.stringify(user)]
      ]);
      // FORCED UPDATE: Manually attach token to the instance for the next immediate call
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return response;
  },
  
logout: async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      await api.post('/auth/logout');
    }
  } catch (error) {
    console.warn('Logout API error:', error);
  } finally {
    await AsyncStorage.multiRemove(['token', 'refreshToken', 'user', 'sessionExpiry']); // Added sessionExpiry
    delete api.defaults.headers.common['Authorization'];
    cache.clear();
  }
},

  verifyReferralCode: (code) => api.get(`/auth/verify-referral/${code}`),

  refreshToken: (data) => api.post('/auth/refresh-token', data),
  
  generateApiKey: () => api.post('/auth/generate-api-key'),
  
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
  getSmartReview: (params) => api.get('/vocabulary/mastery/stats', { params }),
  updateSRS: (wordId, score) => api.post('/vocabulary/mastery/update', { wordId, quality: score }),
  batchUpdateSRS: (updates) => api.post('/vocabulary/mastery/batch-update', { updates }),
  getPersonalizedMix: () => api.get('/vocabulary/daily-mix/personalized'),
  getRandomSelection: (params) => api.get('/vocabulary/random/selection', { params }),
  getLearningSuggestions: () => api.get('/vocabulary/suggestions/learning'),
  
  // Public methods with caching
  getAll: async (params) => {
    return api.getWithCache('/vocabulary', params);
  },
  
  getById: (id) => api.get(`/vocabulary/${id}`),
  
  search: async (query) => {
    return api.getWithCache('/vocabulary/search', { q: query });
  },
  
  getByCategory: (category) => {
    return api.getWithCache('/vocabulary/category/' + category);
  },
  
  getDailyWord: () => api.get('/vocabulary/daily-mix/personalized'), // Updated to personalized if possible
  getFeaturedWordOfDay: () => api.get('/vocabulary/word-of-day/featured'),
  
  getFavorites: () => api.get('/vocabulary/favorites/list'),
  
  addToFavorites: (wordId) => api.post(`/vocabulary/${wordId}/favorite`),
  
  removeFromFavorites: (wordId) => api.delete(`/vocabulary/${wordId}/favorite`),
  
  reportWord: (wordId, data) => api.post(`/vocabulary/${wordId}/report`, data),
  
  getRecent: () => api.get('/vocabulary/recent'),
  
  getStats: () => api.get('/vocabulary/stats'),
  getOverviewStats: () => api.get('/vocabulary/stats/overview'),
  
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
  getUserStats: () => api.get('/progress/stats'), 
  updateProgress: (lessonId, data) => api.post(`/progress/lesson/${lessonId}`, data),
  
  getLeaderboard: (params = { period: 'weekly' }) => api.get('/progress/leaderboard', { params }),
  
  checkBadges: () => api.post('/progress/achievements/check'),
  
  getBadges: () => api.get('/progress/badges'),
  
  getAchievements: () => api.get('/progress/achievements'),
  
  getStreakInfo: () => api.get('/progress/streak'),
  
  getPoints: () => api.get('/progress/points'),
  
  getRank: () => api.get('/progress/rank'),
  
  claimReward: (rewardId) => api.post(`/progress/rewards/${rewardId}/claim`),
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
  getAll: (params = { includeProgress: 'true' }) => api.get('/lessons', { params }),
  getById: (id) => api.get(`/lessons/${id}`),
  complete: (id, data) => api.post(`/lessons/${id}/complete`, data),
  getProgress: (id) => api.get(`/lessons/${id}/progress`),
  getRecommendations: () => api.get('/lessons/recommendations/list'),
  search: (query) => api.get('/lessons', { params: { search: query } }),
  getByLevel: (level) => api.get('/lessons', { params: { level } }),
  getByCategory: (category) => api.get('/lessons', { params: { category } }),

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
      getById: (id) => api.get(`/public/lessons/${id}`),
    }
};

// --- PROGRESS API ---
export const progressAPI = {
  get: () => api.get('/progress'),
  getCategories: () => api.get('/progress/categories'),
  update: (data) => api.post('/progress', data),
  
  getGraph: (params) => api.get('/progress/graph', { params }),
  
  getMonthly: (month, year) => api.get('/progress/monthly', { params: { month, year } }),
  
  getYearly: (year) => api.get('/progress/yearly', { params: { year } }),
  
  reset: () => api.post('/progress/reset'),
  
  export: () => api.get('/progress/export', { responseType: 'blob' }),
  
  
  updateStreak: (forceCheck = false) => api.post('/progress/streak', { forceCheck }),
  checkMilestones: () => api.post('/progress/milestone'),
  getLeaderboard: (params) => api.get('/progress/leaderboard', { params }),
  getAchievements: () => api.get('/progress/achievements'),
  getDetailedStats: () => api.get('/progress/stats/detailed'),
};

// --- TRANSLATOR API ---
export const translatorAPI = {
  translate: (data) => api.post('/translator/translate', data),
  translateBatch: (data) => api.post('/translator/translate/batch', data),
  translateGet: (params) => api.get('/translator/translate', { params }),
  detectLanguage: (text) => api.post('/translator/detect', { text }),
  saveToHistory: (data) => api.post('/translator/translations', data),
  getHistory: () => api.get('/translator/translations'),
  getFavorites: () => api.get('/translator/translations/favorites'),
  toggleFavorite: (id) => api.put(`/translator/translations/${id}/favorite`),
  deleteTranslation: (id) => api.delete(`/translator/translations/${id}`),
  clearHistory: () => api.delete('/translator/translations/clear'),
  getOfflinePack: () => api.get('/translator/translations/offline-pack'),
};

// --- PRONUNCIATION API ---
export const pronunciationAPI = {
  getGuide: () => api.get('/public/pronunciation/guide'),
  
  getVocabularyWithPronunciation: (params = {}) => api.get('/vocabulary', {
    params: { ...params, includePronunciation: 'true' }
  }),
  
  validate: (data) => api.post('/public/validate', data),
  
  getAudio: (wordId) => api.get(`/pronunciation/audio/${wordId}`, { responseType: 'blob' }),
  
  submitRecording: (wordId, audioBlob) => {
    const formData = new FormData();
    formData.append('audio', {
      uri: audioBlob,
      type: 'audio/m4a',
      name: `recording_${wordId}.m4a`,
    });
    return api.post(`/pronunciation/${wordId}/validate`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  getTips: (wordId) => api.get(`/pronunciation/${wordId}/tips`),
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
  registerToken: (token) => api.post('/notifications/register-token', { token }),
  unregisterToken: (token) => api.delete('/notifications/register-token', { data: { token } }),
};

// --- SEARCH API ---
export const searchAPI = {
  global: (query, type = 'all', limit = 20) => api.get('/search', { params: { q: query, type, limit } }),
  byType: (query, type) => api.get('/search', { params: { q: query, type } }),
  suggestions: (query) => api.get('/search/suggestions', { params: { q: query } }),
  recent: () => api.get('/search/recent'),
  trending: () => api.get('/search/trending'),
  clearHistory: () => api.delete('/search/history'),
  deleteHistoryItem: (query) => api.delete(`/search/history/${encodeURIComponent(query)}`),
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
};

export const userAPI = {
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
  getCategories: (params) => api.get('/culture/categories', { params }),
  
  // Content
  getContentByCategory: (categoryId, params) => api.get(`/culture/category/${categoryId}`, { params }),
  getContentItem: (contentId) => api.get(`/culture/content/${contentId}`),
  
  // Proverbs
  getProverbs: (params) => api.get('/culture/proverbs', { params }),
  getProverbOfDay: (params) => api.get('/culture/proverbs/daily', { params }),
  getProverb: (id) => api.get(`/culture/proverbs/${id}`),
  getFeaturedProverbs: () => api.get('/culture/proverbs/featured'),
  getProverbsByCategory: (category) => api.get(`/culture/proverbs/category/${category}`),
  searchProverbs: (query) => api.get('/culture/proverbs/search', { params: { q: query } }),
  getProverbStats: () => api.get('/culture/proverbs/stats'),
  
  // Interactions
  submitProverbFeedback: (id, data) => api.post(`/culture/proverbs/${id}/feedback`, data),
  addProverbComment: (id, data) => api.post(`/culture/proverbs/${id}/comments`, data),
  likeProverb: (id) => api.post(`/culture/proverbs/${id}/like`),
  shareProverb: (id) => api.post(`/culture/proverbs/${id}/share`),
  
  // Admin
  createContent: (data) => api.post('/culture/admin/content', data),
  updateContent: (id, data) => api.put(`/culture/admin/content/${id}`, data),
  createProverb: (data) => api.post('/culture/admin/proverbs', data),
  updateProverb: (id, data) => api.put(`/culture/admin/proverbs/${id}`, data),
  deleteProverb: (id) => api.delete(`/culture/admin/proverbs/${id}`),
  verifyProverb: (id) => api.post(`/culture/admin/proverbs/${id}/verify`),
  
  // Public
  public: {
    getProverbs: (params) => api.get('/public/proverbs', { params }),
    getProverbToday: () => api.get('/public/proverbs/today'),
  }
};

export const gamesAPI = {
  startGame: (data) => api.post('/games/start', data),
  submitGame: (data) => api.post('/games/submit', data),
  getStats: () => api.get('/games/stats'),
  getLeaderboard: (gameType, params) => api.get(`/games/leaderboard/${gameType}`, { params }),
  getHistory: (params) => api.get('/games/history', { params }),
  getWords: (params) => api.get('/games/words', { params }),
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
  getDaily: (params) => api.get('/practice/daily', { params }),
  submitResult: (data) => api.post('/practice/submit', data),
  getStats: () => api.get('/practice/stats'),
  getForecast: () => api.get('/practice/forecast'),
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
      await AsyncStorage.setItem('userLanguage', JSON.stringify(activeLanguage));
    } else {
      await AsyncStorage.setItem('userLanguage', JSON.stringify({ code: extractLanguageCode(languageCode) }));
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
    await AsyncStorage.setItem(
      'userLanguage',
      typeof language === 'string' ? JSON.stringify({ code: extractLanguageCode(language) }) : JSON.stringify(language)
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
  },
  
  // Get queue status
  getQueueStatus: () => ({
    queuedRequests: requestQueue.length,
    isOnline,
  }),
  
  // Force process queue
  processQueue: processRequestQueue,
  
  // Check API health
  checkHealth: () => api.get('/health'),
  
  // Get API version
  getVersion: () => api.get('/version'),
  
  // Submit general feedback
  submitFeedback: (data) => api.post('/public/feedback', data),
  
  // Cancel all pending requests
  cancelAllRequests: () => {
    pendingRequests.clear();
  },
};

export default api;
