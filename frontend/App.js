import React, { useContext, useEffect } from 'react';
import { StyleSheet, Platform, Alert } from 'react-native';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = `
    html, body, #root {
      width: 100%;
      height: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    input, textarea, select, button, [contenteditable="true"], [data-focusable="true"] {
      pointer-events: auto !important;
      user-select: text !important;
      -webkit-user-select: text !important;
      touch-action: manipulation !important;
    }
    div, span {
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(style);
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons, options) => {
    const fullMessage = `${title ? title + '\n\n' : ''}${message || ''}`;
    if (!buttons || buttons.length === 0) {
      window.alert(fullMessage);
      return;
    }
    if (buttons.length === 1) {
      window.alert(fullMessage);
      if (buttons[0].onPress) buttons[0].onPress();
      return;
    }
    if (buttons.length === 2) {
      const cancelBtn = buttons.find(b => b.style === 'cancel' || b.text?.toLowerCase() === 'cancel');
      const actionBtn = buttons.find(b => b !== cancelBtn) || buttons[1];
      const confirmed = window.confirm(fullMessage);
      if (confirmed) {
        if (actionBtn && actionBtn.onPress) actionBtn.onPress();
      } else {
        if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
      }
      return;
    }
    const result = window.prompt(`${fullMessage}\n\nOptions: ${buttons.map((b, i) => `${i + 1}: ${b.text}`).join(', ')} (Enter number):`);
    const index = parseInt(result, 10) - 1;
    if (!isNaN(index) && buttons[index] && buttons[index].onPress) {
      buttons[index].onPress();
    } else {
      const defaultBtn = buttons.find(b => b.style !== 'cancel') || buttons[0];
      if (defaultBtn && defaultBtn.onPress) defaultBtn.onPress();
    }
  };
}

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, ThemeContext } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { HealthProvider } from './src/context/HealthContext';
import { ExerciseEngineProvider } from './src/context/ExerciseEngineContext';
import { useNetworkSync } from './src/hooks/useNetworkSync';
import AppNavigator from './src/navigation/AppNavigator';
import UpdateNotification from './src/components/UpdateNotification';
import { initDb } from './src/services/db';

const linking = {
  prefixes: [
    'frontend://',
    'https://*.vercel.app',
    'https://lorek.vercel.app',
    'https://*.vercel.app/app',
    'https://lorek.vercel.app/app',
    'http://localhost:8081',
    'http://localhost:19006'
  ],
};

function NavigationWrapper() {
  useNetworkSync();
  // This wrapper ensures we only render NavigationContainer 
  // after ensuring context is established if necessary, 
  // though ThemeProvider already handles this.
  return (
    <NavigationContainer linking={linking}>
      <AppNavigator />
      <UpdateNotification />
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    initDb().catch(err => console.error('Failed to init DB', err));
  }, []);
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <HealthProvider>
              <ExerciseEngineProvider>
                <GestureHandlerRootView style={[styles.container, Platform.OS === 'web' && { touchAction: 'manipulation', pointerEvents: 'auto' }]}>
                  <NavigationWrapper />
                </GestureHandlerRootView>
              </ExerciseEngineProvider>
            </HealthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
