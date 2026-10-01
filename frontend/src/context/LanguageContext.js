import React, { createContext, useState, useEffect, useMemo } from 'react';
import { get, save } from '../services/storage';
import api from '../services/api';

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [activeLanguage, setActiveLanguage] = useState(null);
  const [supportedLanguages, setSupportedLanguages] = useState([]);
  const [loadingLanguage, setLoadingLanguage] = useState(true);

  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        // Immediately check and restore the language the user was in before leaving the app
        const savedCode = await get('userLanguageCode');
        if (savedCode) {
          setActiveLanguage({ code: savedCode, name: savedCode === 'OGB' ? 'Ogbia' : 'Izon' });
        }
      } catch (e) {
        console.warn('Failed to load saved language from storage on startup', e);
      }
      fetchSupportedLanguages();
    };
    initializeLanguage();
  }, []);

  const fetchSupportedLanguages = async () => {
    try {
      const response = await api.get('/languages');
      const languages = response.data.data || [];
      setSupportedLanguages(languages);
      
      const savedCode = await get('userLanguageCode');
      const preferred = languages.find(l => l.code === savedCode) || 
                        languages.find(l => l.code === 'IZON') || 
                        languages[0] || 
                        { code: 'IZON', name: 'Izon' };
      setActiveLanguage(preferred);
    } catch (e) {
      console.error('Failed to fetch supported languages', e);
      // Fallback if network/API fails
      const savedCode = await get('userLanguageCode');
      if (!activeLanguage) {
        setActiveLanguage({ code: savedCode || 'IZON', name: savedCode === 'OGB' ? 'Ogbia' : 'Izon' });
      }
    } finally {
      setLoadingLanguage(false);
    }
  };

  const changeLanguage = async (languageInput) => {
    const code = typeof languageInput === 'string'
      ? languageInput
      : (languageInput?.code || languageInput);
    
    const lang = supportedLanguages.find(l => l.code === code) || 
                 (typeof languageInput === 'object' ? languageInput : { code, name: code === 'OGB' ? 'Ogbia' : 'Izon' });
                 
    if (lang) {
      if (lang.code) {
        await save('userLanguageCode', lang.code);
      }
      setActiveLanguage(lang);
    }
  };

  const value = useMemo(() => ({
    activeLanguage,
    supportedLanguages,
    changeLanguage,
    loadingLanguage
  }), [activeLanguage, supportedLanguages, loadingLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
