import React from 'react';
import { View, ActivityIndicator, StyleSheet, Modal, Text } from 'react-native';

export default function LoadingOverlay({ visible, message = 'Loading...' }) {
  if (!visible) return null;
  
  return (
    <Modal transparent={true} animationType="fade">
      <View style={styles.container}>
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.text}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.7)' 
  },
  loaderBox: {
    padding: 20,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  text: { marginTop: 10, color: '#333', fontWeight: '500' }
});
