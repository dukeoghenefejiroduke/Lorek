import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://42bed7edc2db8f533c938a38e74c5fd9@o4511521656078336.ingest.de.sentry.io/4511521660731472',
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
});

export default Sentry.wrap(function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.innerContainer}>
           {/* Placeholder for future content */}
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  }
});
