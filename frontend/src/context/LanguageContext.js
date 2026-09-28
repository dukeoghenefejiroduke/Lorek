import React, { createContext, useState, useEffect, useMemo } from 'react';
import { get, save } from '../services/storage';
import api from '../services/api'; // Correct default import

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [activeLanguage, setActiveLanguage] = useState(null); // Initially null
  const [supportedLanguages, setSupportedLanguages] = useState([]);
  const [loadingLanguage, setLoadingLanguage] = useState(true);

  useEffect(() => {
    fetchSupportedLanguages();
  }, []);

  const fetchSupportedLanguages = async () => {
    try {
      const response = await api.get('/languages');
      const languages = response.data.data;
      setSupportedLanguages(languages);
      
      // Load user preference
      const savedCode = await get('userLanguageCode');
      const preferred = languages.find(l => l.code === savedCode) || languages.find(l => l.code === 'IZON');
      setActiveLanguage(preferred || languages[0]);
    } catch (e) {
      console.error('Failed to load supported languages', e);
    } finally {
      setLoadingLanguage(false);
    }
  };

  const changeLanguage = async (languageInput) => {
    const code = typeof languageInput === 'string'
      ? languageInput
      : (languageInput?.code || languageInput);
    
    const lang = supportedLanguages.find(l => l.code === code) || (typeof languageInput === 'object' ? languageInput : null);
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
