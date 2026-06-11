import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Animated,
  Dimensions,
  StatusBar,
  Share,
  Vibration,
  RefreshControl,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { translatorAPI, pronunciationAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { LanguageContext } from '../context/LanguageContext';
import AudioPlayer from '../components/AudioPlayer';
import haptics from '../utils/haptics';

const { width, height } = Dimensions.get('window');

// ============================================================================
// CONSTANTS
// ============================================================================

const DIRECTION = {
  EN_TO_IZON: 'en_to_izon',
  IZON_TO_EN: 'izon_to_en',
};

const CONFIDENCE_CONFIG = {
  high: { color: '#4CAF50', icon: 'check-circle', label: 'High' },
  medium: { color: '#FF9800', icon: 'info', label: 'Medium' },
  low: { color: '#F44336', icon: 'warning', label: 'Low' },
};

const MAX_TEXT_LENGTH = 500;

// ============================================================================
// COMPONENTS
// ============================================================================

const LanguageSwitcher = ({ direction, onSwap, disabled, activeLanguageName, theme }) => (
  <View style={[styles.directionCard, { backgroundColor: theme.card }]}>
    <View style={styles.directionLabels}>
      <Text style={[styles.directionLabel, direction === DIRECTION.EN_TO_IZON && styles.activeDirectionLabel, { color: theme.subText }]}>
        English
      </Text>
      <TouchableOpacity
        style={styles.swapButton}
        onPress={onSwap}
        disabled={disabled}
      >
        <MaterialIcons name="swap-horiz" size={24} color="#4CAF50" />
      </TouchableOpacity>
      <Text style={[styles.directionLabel, direction === DIRECTION.IZON_TO_EN && styles.activeDirectionLabel, { color: theme.subText }]}>
        {activeLanguageName || 'Izon'}
      </Text>
    </View>
  </View>
);

const TranslationInput = ({ value = '', onChange, label, loading, onSubmit, theme }) => (
  <View style={[styles.inputCard, { backgroundColor: theme.card }]}>
    <View style={styles.inputHeader}>
      <Text style={[styles.inputLabel, { color: theme.subText }]}>{label}</Text>
      {value && value.length > 0 ? (
        <Text style={styles.charCount}>{value.length}/{MAX_TEXT_LENGTH}</Text>
      ) : null}
    </View>
    <TextInput
      style={styles.input}
      multiline
      numberOfLines={4}
      placeholder={`Type ${label.toLowerCase()} here...`}
      placeholderTextColor="#999"
      value={value || ''} // Ensure value is never null/undefined
      onChangeText={onChange}
      editable={!loading}
      maxLength={MAX_TEXT_LENGTH}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
    />
  </View>
);


const TranslateButton = ({ onPress, loading }) => (
  <Animated.View>
    <TouchableOpacity
      style={[styles.translateButton, loading && styles.translateButtonDisabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <FontAwesome5 name="magic" size={20} color="#fff" />
          <Text style={styles.translateButtonText}>Translate</Text>
        </>
      )}
    </TouchableOpacity>
  </Animated.View>
);

const ConfidenceBadge = ({ confidence }) => {
  const config = CONFIDENCE_CONFIG[confidence] || CONFIDENCE_CONFIG.medium;
  return (
    <View style={[styles.confidenceBadge, { backgroundColor: config.color + '20' }]}>
      <MaterialIcons name={config.icon} size={14} color={config.color} />
      <Text style={[styles.confidenceText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
};

const PronunciationSection = ({ pronunciation, theme }) => {
  if (!pronunciation) return null;

  return (
    <View style={styles.pronunciationSection}>
      <View style={styles.sectionTitleContainer}>
        <MaterialIcons name="volume-up" size={18} color="#4CAF50" />
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Pronunciation</Text>
      </View>

      {pronunciation.ipa && (
        <View style={[styles.ipaContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.ipaLabel, { color: theme.subText }]}>IPA</Text>
          <Text style={[styles.ipaText, { color: theme.text }]}>{pronunciation.ipa}</Text>
        </View>
      )}

      {pronunciation.syllables?.length > 0 && (
        <View style={styles.syllablesContainer}>
          <Text style={[styles.syllablesLabel, { color: theme.subText }]}>Syllables:</Text>
          <Text style={[styles.syllablesText, { color: theme.text }]}>{pronunciation.syllables.join(' · ')}</Text>
        </View>
      )}

      {pronunciation.breakdown?.length > 0 && (
        <View style={styles.breakdownContainer}>
          <Text style={[styles.breakdownTitle, { color: theme.text }]}>Sound Breakdown</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.soundsGrid}>
              {pronunciation.breakdown.map((sound, index) => (
                <View key={index} style={[styles.soundItem, { backgroundColor: theme.card }]}>
                  <Text style={styles.soundChar}>{sound.char}</Text>
                  <Text style={[styles.soundDesc, { color: theme.subText }]}>{sound.sound}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {pronunciation.tips?.map((tip, index) => (
        <View key={index} style={styles.tipItem}>
          <MaterialIcons name="lightbulb" size={14} color="#FF9800" />
          <Text style={[styles.tipText, { color: theme.subText }]}>{tip}</Text>
        </View>
      ))}
    </View>
  );
};

const ExamplesSection = ({ examples, theme }) => {
  if (!examples?.length) return null;

  return (
    <View style={styles.examplesSection}>
      <View style={styles.sectionTitleContainer}>
        <MaterialIcons name="menu-book" size={18} color="#FF9800" />
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Examples</Text>
      </View>
      {examples.map((example, index) => (
        <View key={index} style={styles.exampleItem}>
          <Text style={styles.exampleIzon}>{example.izon}</Text>
          <Text style={[styles.exampleEnglish, { color: theme.subText }]}>{example.english}</Text>
        </View>
      ))}
    </View>
  );
};

const TranslationResult = ({ translated, loading, error, info, onCopy, onShare, onSave, isFavorite, theme }) => {
  if (loading) {
    return (
      <View style={[styles.resultCard, { backgroundColor: theme.card }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={[styles.loadingText, { color: theme.subText }]}>Translating...</Text>
        </View>
      </View>
    );
  }

  if (!translated && !error) return null;

  return (
    <View style={[styles.resultCard, { backgroundColor: theme.card }]}>
      <View style={styles.resultHeader}>
        <View style={styles.resultHeaderLeft}>
          <Text style={[styles.resultLabel, { color: theme.text }]}>Translation</Text>
          {info.confidence && <ConfidenceBadge confidence={info.confidence} />}
        </View>
        <View style={styles.resultActions}>
          <TouchableOpacity onPress={onCopy}>
            <MaterialIcons name="content-copy" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onShare}>
            <MaterialIcons name="share" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSave}>
            <MaterialIcons
              name={isFavorite ? "bookmark" : "bookmark-border"}
              size={20}
              color={isFavorite ? "#4CAF50" : "#666"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.resultText}>{translated}</Text>

      {info.pronunciation && <PronunciationSection pronunciation={info.pronunciation} theme={theme} />}
      
      <AudioPlayer word={translated} showControls={true} compact />

      {info.examples && <ExamplesSection examples={info.examples} theme={theme} />}

      {info.note && (
        <View style={styles.noteContainer}>
          <MaterialIcons name="info" size={16} color="#FF9800" />
          <Text style={[styles.noteText, { color: theme.subText }]}>{info.note}</Text>
        </View>
      )}

      {info.alternatives?.length > 0 && (
        <TouchableOpacity style={styles.alternativesButton}>
          <MaterialIcons name="swap-vert" size={18} color="#666" />
          <Text style={[styles.alternativesButtonText, { color: theme.subText }]}>
            See {info.alternatives.length} alternative translations
          </Text>
        </TouchableOpacity>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={20} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const HistoryItem = ({ item, onPress, theme }) => (
  <TouchableOpacity style={styles.historyCard} onPress={() => onPress(item)}>
    <Text style={[styles.historyOriginal, { color: theme.subText }]} numberOfLines={1}>
      {item.sourceText || item.original}
    </Text>
    <Text style={[styles.historyTranslated, { color: theme.text }]} numberOfLines={1}>
      {item.targetText || item.translated}
    </Text>
    <View style={styles.historyFooter}>
      <Text style={styles.historyDirection}>
        {item.sourceLanguage === 'en' ? `EN → ${(item.targetLanguage || 'IZ').toUpperCase()}` : `${(item.sourceLanguage || 'IZ').toUpperCase()} → EN`}
      </Text>
      {item.confidence && (
        <View style={[
          styles.historyConfidence,
          { backgroundColor: CONFIDENCE_CONFIG[item.confidence]?.color + '20' || '#e0e0e0' }
        ]}>
          <Text style={[
            styles.historyConfidenceText,
            { color: CONFIDENCE_CONFIG[item.confidence]?.color || '#666' }
          ]}>
            {item.confidence}
          </Text>
        </View>
      )}
    </View>
  </TouchableOpacity>
);

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function TranslatorScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { activeLanguage } = useContext(LanguageContext);
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in TranslatorScreen.js:', contextValue);
  const { theme, isDarkMode } = contextValue;

  // State
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [direction, setDirection] = useState(DIRECTION.EN_TO_IZON);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [translationInfo, setTranslationInfo] = useState({
    type: '',
    note: '',
    pronunciation: null,
    provider: null,
    confidence: null,
    alternatives: [],
    examples: [],
  });
  const [isFavorite, setIsFavorite] = useState(false);
  const [translationHistory, setTranslationHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [includePronunciation, setIncludePronunciation] = useState(true);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    loadHistory();
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadHistory = async () => {
    try {
      const response = await translatorAPI.getHistory();
      setTranslationHistory(response.data.data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      haptics.notificationError();
      Alert.alert('Input required', 'Please enter text to translate.');
      return;
    }

    setLoading(true);
    setError(null);
    setTranslatedText('');
    setTranslationInfo({
      type: '',
      note: '',
      pronunciation: null,
      provider: null,
      confidence: null,
      alternatives: [],
      examples: [],
    });

    haptics.impactMedium();

    try {
      const from = direction === DIRECTION.EN_TO_IZON ? 'en' : 'izon';
      const to = direction === DIRECTION.EN_TO_IZON ? 'izon' : 'en';

      const response = await translatorAPI.translate({
        text: inputText.trim(),
        lang: activeLanguage?.code,
        from,
        to,
        includePronunciation: includePronunciation ? 'true' : 'false',
        includeExamples: 'true',
      });

      if (response.data.success) {
        const data = response.data.data;
        setTranslatedText(data.translated);
        setTranslationInfo({
          type: data.type,
          note: data.note || '',
          pronunciation: data.pronunciation || null,
          provider: data.provider || null,
          confidence: data.confidence || null,
          alternatives: data.alternatives || [],
          examples: data.examples || [],
        });
        
        haptics.notificationSuccess();
        loadHistory(); // Refresh history
      } else {
        setError(response.data.error || 'Translation failed');
        haptics.notificationError();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Network error');
      haptics.notificationError();
    } finally {
      setLoading(false);
    }
  };

  const swapDirection = () => {
    setDirection(prev => prev === DIRECTION.EN_TO_IZON 
      ? DIRECTION.IZON_TO_EN 
      : DIRECTION.EN_TO_IZON);
    // Swap texts
    setInputText(translatedText);
    setTranslatedText('');
    setTranslationInfo({
      type: '',
      note: '',
      pronunciation: null,
      provider: null,
      confidence: null,
      alternatives: [],
      examples: [],
    });
    haptics.impactLight();
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(translatedText);
    haptics.notificationSuccess();
    Alert.alert('Copied!', 'Translation copied to clipboard');
  };

  const shareTranslation = async () => {
    try {
      await Share.share({
        message: `${inputText}\n→\n${translatedText}\n\nTranslated with Lorek App`,
        title: 'Translation',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const saveTranslation = async () => {
    try {
      await translatorAPI.saveToHistory({
        original: inputText,
        translated: translatedText,
        direction: direction,
        confidence: translationInfo.confidence,
        pronunciation: translationInfo.pronunciation,
      });
      Alert.alert('Saved', 'Translation saved to history');
      haptics.notificationSuccess();
      loadHistory();
    } catch (err) {
      haptics.notificationError();
      Alert.alert('Error', 'Failed to save translation');
    }
  };

  const loadFromHistory = (item) => {
    setInputText(item.sourceText || item.original);
    setDirection(item.sourceLanguage === 'en' ? DIRECTION.EN_TO_IZON : DIRECTION.IZON_TO_EN);
    setShowHistory(false);
    setTimeout(() => handleTranslate(), 100);
  };

  const clearInput = () => {
    setInputText('');
    setTranslatedText('');
    setTranslationInfo({
      type: '',
      note: '',
      pronunciation: null,
      provider: null,
      confidence: null,
      alternatives: [],
      examples: [],
    });
    haptics.impactLight();
  };

  const getSourceLabel = () => direction === DIRECTION.EN_TO_IZON ? 'English' : (activeLanguage?.name || 'Izon');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

      {/* Header */}
      <LinearGradient
        colors={['#1a4c2e', '#2e7d32', '#43a047']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <FontAwesome5 name="language" size={20} color="#FFD700" />
            <Text style={styles.headerTitle}>{activeLanguage?.name || 'Izon'} Translator</Text>
          </View>

          <TouchableOpacity style={styles.historyButton} onPress={() => setShowHistory(true)}>
            <MaterialIcons name="history" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          Translate between English and {activeLanguage?.name || 'Izon'} with AI-powered accuracy
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
          }
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <LanguageSwitcher
              direction={direction}
              onSwap={swapDirection}
              disabled={loading}
              activeLanguageName={activeLanguage?.name}
              theme={theme}
            />

            <TranslationInput
              value={inputText}
              onChange={setInputText}
              label={getSourceLabel()}
              loading={loading}
              onSubmit={handleTranslate}
              theme={theme}
            />

            <TranslateButton onPress={handleTranslate} loading={loading} />

            <TranslationResult
              translated={translatedText}
              loading={loading}
              error={error}
              info={translationInfo}
              onCopy={copyToClipboard}
              onShare={shareTranslation}
              onSave={saveTranslation}
              isFavorite={isFavorite}
              theme={theme}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistory(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={['#1a4c2e', '#2e7d32']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Translation History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalBody}>
              {translationHistory.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <MaterialIcons name="history" size={60} color="#ccc" />
                  <Text style={[styles.emptyHistoryTitle, { color: theme.text }]}>No translations yet</Text>
                  <Text style={styles.emptyHistoryText}>
                    Your recent translations will appear here
                  </Text>
                </View>
              ) : (
                translationHistory.map((item) => (
                  <HistoryItem key={item._id || item.id} item={item} onPress={loadFromHistory} theme={theme} />
                ))
              )}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  historyButton: {
    padding: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  directionCard: {
    margin: 20,
    marginBottom: 0,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  directionLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  directionLabel: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  activeDirectionLabel: {
    color: '#4CAF50',
    fontSize: 18,
  },
  swapButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputCard: {
    margin: 20,
    marginTop: 10,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  translateButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    marginTop: 0,
    padding: 18,
    borderRadius: 15,
    gap: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  translateButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  translateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultCard: {
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  resultHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 15,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 10,
  },
  resultText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a4c2e',
    marginBottom: 20,
    lineHeight: 32,
  },
  pronunciationSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  ipaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    gap: 10,
  },
  ipaLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ipaText: {
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'monospace',
  },
  syllablesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  syllablesLabel: {
    fontSize: 14,
  },
  syllablesText: {
    fontSize: 16,
  },
  breakdownContainer: {
    marginTop: 10,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  soundsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  soundItem: {
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    width: 70,
    elevation: 1,
  },
  soundChar: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  soundDesc: {
    fontSize: 10,
    textAlign: 'center',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  tipText: {
    fontSize: 12,
    flex: 1,
  },
  examplesSection: {
    marginBottom: 15,
  },
  exampleItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  exampleIzon: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a4c2e',
    marginBottom: 4,
  },
  exampleEnglish: {
    fontSize: 14,
  },
  alternativesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    gap: 8,
  },
  alternativesButtonText: {
    fontSize: 14,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    gap: 8,
  },
  noteText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    gap: 10,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
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
    padding: 20,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyHistoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  historyOriginal: {
    fontSize: 14,
    marginBottom: 4,
  },
  historyTranslated: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDirection: {
    fontSize: 11,
    color: '#999',
  },
  historyConfidence: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  historyConfidenceText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
});
