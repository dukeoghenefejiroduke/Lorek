import React, { useContext, useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = `
    html, body, #root {
      width: 100%;
      height: 100%;
      flex: 1;
      display: flex;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);
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

function NavigationWrapper() {
  useNetworkSync();
  // This wrapper ensures we only render NavigationContainer 
  // after ensuring context is established if necessary, 
  // though ThemeProvider already handles this.
  return (
    <NavigationContainer>
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
                <GestureHandlerRootView style={styles.container}>
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
