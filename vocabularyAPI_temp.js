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
