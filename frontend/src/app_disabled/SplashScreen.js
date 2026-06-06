import React, { useEffect } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { View, Image, StyleSheet, StatusBar } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function SplashScreenComponent({ navigation }) {
  useEffect(() => {
    async function prepare() {
      // Simulate app loading/config
      await new Promise(resolve => setTimeout(resolve, 2000));
      await SplashScreen.hideAsync();
      navigation.replace('AppNavigator'); // Assuming AppNavigator handles the auth/main logic
    }
    prepare();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Image 
        source={require('../../assets/splash-icon.png')} 
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a4c2e', // Adjust to match branding
  },
  image: {
    width: 200,
    height: 200,
  },
});
