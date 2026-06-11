import React, { useContext } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, ThemeContext } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import AppNavigator from './src/navigation/AppNavigator';
import UpdateNotification from './src/components/UpdateNotification';

function NavigationWrapper() {
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
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <GestureHandlerRootView style={styles.container}>
              <NavigationWrapper />
            </GestureHandlerRootView>
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
