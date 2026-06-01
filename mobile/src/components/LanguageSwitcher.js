import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import haptics from '../utils/haptics';

import { languagesAPI } from '../services/api';
import { LanguageContext } from '../context/LanguageContext';

const LanguageSwitcher = ({ visible, onClose, onLanguageChange }) => {
  const { activeLanguage: contextLanguage, changeLanguage } = useContext(LanguageContext);
  const [languages, setLanguages] = useState([]);
  const [activeLanguage, setActiveLanguage] = useState(null);
  const [learningLanguages, setLearningLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (visible) {
      loadLanguages();
    }
  }, [visible]);

  const loadLanguages = async () => {
    try {
      setLoading(true);
      const [allRes, userRes] = await Promise.all([
        languagesAPI.getAll(),
        languagesAPI.getUserActiveLanguage(),
      ]);

      if (allRes.data.success) {
        setLanguages(allRes.data.data);
      }
      if (userRes.data.success) {
        const serverLanguage = userRes.data.data.activeLanguage || contextLanguage;
        setActiveLanguage(serverLanguage);
        await changeLanguage(serverLanguage);
        setLearningLanguages(userRes.data.data.learningLanguages || []);
      }
    } catch (error) {
      console.error('Failed to load languages:', error);
      Alert.alert('Error', 'Failed to load languages');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchLanguage = async (language) => {
    haptics.impactMedium();
    setSwitching(true);

    try {
      const response = await languagesAPI.setActiveLanguage(language.code);
      if (response.data.success) {
        const selectedLanguage = response.data?.data?.activeLanguage || language;
        setActiveLanguage(selectedLanguage);
        await changeLanguage(selectedLanguage);
        if (onLanguageChange) {
          onLanguageChange(selectedLanguage);
        }
        Alert.alert('Success', `Switched to ${selectedLanguage.name}`);
        setTimeout(() => onClose(), 500);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to switch language');
    } finally {
      setSwitching(false);
    }
  };

  const handleAddLanguage = async (language) => {
    try {
      const response = await languagesAPI.addLanguage(language.code);
      if (response.data.success) {
        setLearningLanguages([...learningLanguages, language]);
        Alert.alert('Success', `${language.name} added to your learning list`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add language');
    }
  };

  const renderLanguageItem = ({ item }) => {
    const isActive = activeLanguage?._id === item._id;
    const isLearning = learningLanguages.some(l => l._id === item._id);
    
    return (
      <TouchableOpacity
        style={[styles.languageItem, isActive && styles.activeLanguageItem]}
        onPress={() => handleSwitchLanguage(item)}
        disabled={switching}
      >
        <View style={[styles.languageIcon, { backgroundColor: `${item.color}20` }]}>
          <Text style={styles.languageEmoji}>{item.icon || '🌍'}</Text>
        </View>
        <View style={styles.languageInfo}>
          <Text style={[styles.languageName, isActive && styles.activeLanguageName]}>
            {item.name}
          </Text>
          <Text style={styles.languageNativeName}>{item.nativeName}</Text>
          <Text style={styles.languageDescription} numberOfLines={1}>
            {item.description}
          </Text>
        </View>
        {isActive && (
          <View style={styles.activeBadge}>
            <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
          </View>
        )}
        {!isLearning && !isActive && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddLanguage(item)}
          >
            <MaterialIcons name="add" size={20} color="#4CAF50" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <BlurView intensity={90} style={styles.modalOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading languages...</Text>
          </View>
        </BlurView>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={90} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient colors={['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <FlatList
            data={languages}
            keyExtractor={(item) => item._id}
            renderItem={renderLanguageItem}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={() => (
              <>
                <Text style={styles.sectionTitle}>
                  <MaterialIcons name="check-circle" size={16} color="#4CAF50" /> Active Language
                </Text>
                {activeLanguage && (
                  <View style={styles.activeLanguageCard}>
                    <Text style={styles.activeLanguageEmoji}>{activeLanguage.icon || '🌍'}</Text>
                    <View>
                      <Text style={styles.activeLanguageName}>{activeLanguage.name}</Text>
                      <Text style={styles.activeLanguageNative}>{activeLanguage.nativeName}</Text>
                    </View>
                  </View>
                )}
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                  <MaterialIcons name="menu-book" size={16} color="#2196F3" /> Available Languages
                </Text>
              </>
            )}
            ListFooterComponent={() => (
              <View style={styles.infoCard}>
                <MaterialIcons name="info" size={20} color="#FF9800" />
                <Text style={styles.infoText}>
                  Learning multiple languages? Add them to your list and switch anytime!
                </Text>
                <View style={{ height: 40 }} />
              </View>
            )}
          />
        </View>
      </BlurView>
    </Modal>
  );
};
  
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff',
  },
  activeLanguageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 12,
    gap: 15,
    marginBottom: 10,
  },
  activeLanguageEmoji: {
    fontSize: 32,
  },
  activeLanguageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a4c2e',
  },
  activeLanguageNative: {
    fontSize: 14,
    color: '#666',
  },
  languagesList: {
    gap: 10,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  activeLanguageItem: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  languageIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageEmoji: {
    fontSize: 24,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  activeLanguageName: {
    color: '#1a4c2e',
  },
  languageNativeName: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  languageDescription: {
    fontSize: 11,
    color: '#aaa',
  },
  activeBadge: {
    padding: 4,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 10,
    marginTop: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#FF9800',
    lineHeight: 18,
  },
});

export default LanguageSwitcher;
