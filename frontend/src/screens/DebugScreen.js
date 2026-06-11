import SafeAreaContainer from '../components/SafeAreaContainer';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DebugScreen = () => (
  <View style={styles.container}>
    <Text>Debug Screen - If you see this, the app is not crashing!</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

export default DebugScreen;
