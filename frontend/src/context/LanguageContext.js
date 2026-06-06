import React, { createContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LanguageContext = createContext();

export const DEFAULT_LANGUAGE = {
  code: 'IZON',
  name: 'Izon',
  dialect: 'Kolokuma'
};

const normalizeLanguage = (language) => {
  if (!language) return DEFAULT_LANGUAGE;

  if (typeof language === 'string') {
    try {
      const parsed = JSON.parse(language);
      return normalizeLanguage(parsed);
    } catch {
      return { ...DEFAULT_LANGUAGE, code: language.toUpperCase() };
    }
  }

  return {
    ...DEFAULT_LANGUAGE,
    ...language,
    code: (language.code || DEFAULT_LANGUAGE.code).toUpperCase(),
  };
};

export const LanguageProvider = ({ children }) => {
  const [activeLanguage, setActiveLanguage] = useState(DEFAULT_LANGUAGE);
  const [loadingLanguage, setLoadingLanguage] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('userLanguage');
      if (savedLanguage) {
        setActiveLanguage(normalizeLanguage(savedLanguage));
      }
    } catch (e) {
      console.error('Failed to load language');
    } finally {
      setLoadingLanguage(false);
    }
  };

  const changeLanguage = async (lang) => {
    try {
      const normalizedLanguage = normalizeLanguage(lang);
      await AsyncStorage.setItem('userLanguage', JSON.stringify(normalizedLanguage));
      setActiveLanguage(normalizedLanguage);
      return normalizedLanguage;
    } catch (e) {
      console.error('Failed to save language');
      throw e;
    }
  };

  const value = useMemo(() => ({
    activeLanguage,
    changeLanguage,
    loadingLanguage
  }), [activeLanguage, loadingLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
