import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useAppUpdate } from '../hooks/useAppUpdate';

const UpdateNotification = () => {
  const { updateAvailable, updateInfo } = useAppUpdate();

  const handleUpdate = () => {
    if (updateInfo?.updateUrl) {
      Linking.openURL(updateInfo.updateUrl);
    }
  };

  if (!updateAvailable) return null;

  return (
    <Modal transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.message}>
            A new version ({updateInfo?.latestVersion}) is available. Please update to enjoy the latest features.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleUpdate}>
            <Text style={styles.buttonText}>Update Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#fff', padding: 20, borderRadius: 15, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  message: { textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#4CAF50', padding: 10, borderRadius: 5, width: '100%' },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
});

export default UpdateNotification;
