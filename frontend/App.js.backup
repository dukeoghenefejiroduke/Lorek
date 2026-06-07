import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';

import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import AppNavigator from './src/navigation/AppNavigator';

Sentry.init({
  dsn: 'https://42bed7edc2db8f533c938a38e74c5fd9@o4511521656078336.ingest.de.sentry.io/4511521660731472',
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
});

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <GestureHandlerRootView style={styles.container}>
              <NavigationContainer>
                <AppNavigator />
              </NavigationContainer>
            </GestureHandlerRootView>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
