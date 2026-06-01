// components/PronunciationGuideModal.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TextInput,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { LanguageContext } from '../context/LanguageContext';

const { width, height } = Dimensions.get('window');

export default function PronunciationGuideModal({ visible, onClose, guideData, word = null }) {
  const { activeLanguage } = useContext(LanguageContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredVowels, setFilteredVowels] = useState({});
  const [filteredConsonants, setFilteredConsonants] = useState({});
  const [activeTab, setActiveTab] = useState('vowels');
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      animateIn();
      if (guideData) {
        filterSounds();
      }
    } else {
      animateOut();
    }
  }, [visible, guideData, searchTerm]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const filterSounds = () => {
    if (!guideData) return;

    if (searchTerm) {
      const filteredV = {};
      Object.entries(guideData.vowels || {}).forEach(([char, desc]) => {
        if (char.toLowerCase().includes(searchTerm.toLowerCase()) ||
            desc.toLowerCase().includes(searchTerm.toLowerCase())) {
          filteredV[char] = desc;
        }
      });
      setFilteredVowels(filteredV);

      const filteredC = {};
      Object.entries(guideData.consonants || {}).forEach(([char, desc]) => {
        if (char.toLowerCase().includes(searchTerm.toLowerCase()) ||
            desc.toLowerCase().includes(searchTerm.toLowerCase())) {
          filteredC[char] = desc;
        }
      });
      setFilteredConsonants(filteredC);
    } else {
      setFilteredVowels(guideData.vowels || {});
      setFilteredConsonants(guideData.consonants || {});
    }
  };

  const handleSoundPress = (char, description) => {
    haptics.impactLight();
    // Could trigger audio playback if available
  };

  const getSoundTypeIcon = (type) => {
    return type === 'vowel' ? '🎵' : '🔊';
  };

  if (!guideData) return null;

  const hasVowels = Object.keys(filteredVowels).length > 0;
  const hasConsonants = Object.keys(filteredConsonants).length > 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{activeLanguage?.name || 'Izon'} Pronunciation Guide</Text>
              {word && <Text style={styles.wordHint}>For: {word}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search sounds..."
              placeholderTextColor="#999"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm ? (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Icon name="clear" size={20} color="#999" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'vowels' && styles.activeTab]}
              onPress={() => {
                haptics.impactLight();
                setActiveTab('vowels');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'vowels' && styles.activeTabText]}>
                Vowels {hasVowels ? `(${Object.keys(filteredVowels).length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'consonants' && styles.activeTab]}
              onPress={() => {
                haptics.impactLight();
                setActiveTab('consonants');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'consonants' && styles.activeTabText]}>
                Consonants {hasConsonants ? `(${Object.keys(filteredConsonants).length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.guideContent} showsVerticalScrollIndicator={false}>
            {/* Vowels Section */}
            {activeTab === 'vowels' && hasVowels && (
              <View style={styles.guideSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEmoji}>🎵</Text>
                  <Text style={styles.guideSectionTitle}>Vowel Sounds</Text>
                </View>
                <Text style={styles.sectionDescription}>
                  Vowels are the building blocks of {activeLanguage?.name || 'Izon'} words. Each vowel has a distinct sound.
                </Text>
                <View style={styles.soundsGrid}>
                  {Object.entries(filteredVowels).map(([char, desc]) => (
                    <TouchableOpacity
                      key={char}
                      style={styles.soundItem}
                      onPress={() => handleSoundPress(char, desc)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.soundChar}>{char}</Text>
                      <Text style={styles.soundDesc} numberOfLines={2}>
                        {typeof desc === 'string' ? desc : desc.description || desc}
                      </Text>
                      <View style={styles.soundTypeBadge}>
                        <Text style={styles.soundTypeText}>Vowel</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Consonants Section */}
            {activeTab === 'consonants' && hasConsonants && (
              <View style={styles.guideSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEmoji}>🔊</Text>
                  <Text style={styles.guideSectionTitle}>Consonant Sounds</Text>
                </View>
                <Text style={styles.sectionDescription}>
                  Consonants in {activeLanguage?.name || 'Izon'} include unique sounds like 'gb' and 'kp' pronounced simultaneously.
                </Text>
                <View className="soundsGrid">
                  {Object.entries(filteredConsonants).map(([char, desc]) => (
                    <TouchableOpacity
                      key={char}
                      style={styles.soundItem}
                      onPress={() => handleSoundPress(char, desc)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.soundChar}>{char}</Text>
                      <Text style={styles.soundDesc} numberOfLines={2}>
                        {typeof desc === 'string' ? desc : desc.description || desc}
                      </Text>
                      <View style={[styles.soundTypeBadge, styles.consonantBadge]}>
                        <Text style={styles.soundTypeText}>Consonant</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* No Results */}
            {((activeTab === 'vowels' && !hasVowels) || (activeTab === 'consonants' && !hasConsonants)) && (
              <View style={styles.emptyState}>
                <Icon name="search-off" size={60} color="#ccc" />
                <Text style={styles.emptyTitle}>No sounds found</Text>
                <Text style={styles.emptyText}>
                  Try a different search term or clear the search
                </Text>
              </View>
            )}

            {/* Tips Section */}
            {guideData.tips && guideData.tips.length > 0 && (
              <View style={styles.tipsSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEmoji}>💡</Text>
                  <Text style={styles.tipsSectionTitle}>Pronunciation Tips</Text>
                </View>
                {guideData.tips.map((tip, index) => (
                  <View key={index} style={styles.tipItem}>
                    <Text style={styles.tipBullet}>•</Text>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Common Mistakes Section */}
            {guideData.commonMistakes && guideData.commonMistakes.length > 0 && (
              <View style={styles.mistakesSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEmoji}>⚠️</Text>
                  <Text style={styles.mistakesTitle}>Common Mistakes to Avoid</Text>
                </View>
                {guideData.commonMistakes.map((mistake, index) => (
                  <View key={index} style={styles.mistakeItem}>
                    <Text style={styles.mistakeSound}>{mistake.sound}</Text>
                    <View style={styles.mistakeDetails}>
                      <Text style={styles.mistakeText}>❌ {mistake.mistake}</Text>
                      <Text style={styles.correctionText}>✅ {mistake.correction}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.practiceButton} onPress={onClose}>
              <Icon name="mic" size={20} color="#fff" />
              <Text style={styles.practiceButtonText}>Practice Now</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
    minHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a4c2e',
  },
  wordHint: {
    fontSize: 13,
    color: '#4CAF50',
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    margin: 15,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 15,
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#4CAF50',
  },
  guideContent: {
    flex: 1,
    padding: 20,
  },
  guideSection: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionEmoji: {
    fontSize: 24,
  },
  guideSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  soundsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  soundItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    width: '30%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  soundChar: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 8,
  },
  soundDesc: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 14,
  },
  soundTypeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  consonantBadge: {
    backgroundColor: '#2196F3',
  },
  soundTypeText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  tipsSection: {
    backgroundColor: '#FFF8E1',
    padding: 18,
    borderRadius: 15,
    marginBottom: 20,
  },
  tipsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 8,
  },
  tipBullet: {
    fontSize: 16,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  mistakesSection: {
    backgroundColor: '#FFEBEE',
    padding: 18,
    borderRadius: 15,
    marginBottom: 20,
  },
  mistakesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 12,
  },
  mistakeItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 15,
    alignItems: 'flex-start',
  },
  mistakeSound: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F44336',
    minWidth: 40,
  },
  mistakeDetails: {
    flex: 1,
  },
  mistakeText: {
    fontSize: 13,
    color: '#C62828',
    marginBottom: 4,
  },
  correctionText: {
    fontSize: 13,
    color: '#2E7D32',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  practiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
  },
  practiceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
