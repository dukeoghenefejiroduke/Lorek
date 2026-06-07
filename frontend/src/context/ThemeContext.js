import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

export const lightTheme = {
  background: '#f5f7fa',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#333333',
  subText: '#666666',
  border: '#f0f0f0',
  primary: '#4CAF50',
  secondary: '#2196F3',
  accent: '#FFD700',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  headerGradient: ['#1a4c2e', '#2e7d32'],
  overlay: 'rgba(255,255,255,0.7)',
};

export const darkTheme = {
  background: '#121212',
  surface: '#1e1e1e',
  card: '#252525',
  text: '#ffffff',
  subText: '#aaaaaa',
  border: '#333333',
  primary: '#4CAF50',
  secondary: '#2196F3',
  accent: '#FFD700',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  headerGradient: ['#000000', '#1a1a1a'],
  overlay: 'rgba(0,0,0,0.7)',
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    const savedTheme = await AsyncStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  };

  const toggleTheme = useCallback(async () => {
    setIsDarkMode(prev => {
      const newTheme = !prev;
      AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  }, []);

  const theme = useMemo(() => (isDarkMode ? darkTheme : lightTheme), [isDarkMode]);

  const value = useMemo(() => {
    return {
      isDarkMode,
      toggleTheme,
      theme: theme || lightTheme,
    };
  }, [isDarkMode, toggleTheme, theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
