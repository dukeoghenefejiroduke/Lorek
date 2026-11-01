import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const SecureStoreService = {
  async getItemAsync(key) {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(`secure_${key}`);
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn('SecureStore getItemAsync error:', e);
      return null;
    }
  },
  async setItemAsync(key, value) {
    if (Platform.OS === 'web') {
      return await AsyncStorage.setItem(`secure_${key}`, value);
    }
    try {
      return await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn('SecureStore setItemAsync error:', e);
    }
  },
  async deleteItemAsync(key) {
    if (Platform.OS === 'web') {
      return await AsyncStorage.removeItem(`secure_${key}`);
    }
    try {
      return await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('SecureStore deleteItemAsync error:', e);
    }
  }
};

export default SecureStoreService;
