import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { vocabularyAPI } from '../services/api';
import AudioPlayer from '../components/AudioPlayer';
import ScreenHeader from '../components/ScreenHeader';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { LanguageContext } from '../context/LanguageContext';

export default function PronunciationScreen({ navigation }) {
  const contextValue = useContext(ThemeContext) || {};
  const { theme } = contextValue;
  const { activeLanguage } = useContext(LanguageContext);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [practiceMode, setPracticeMode] = useState('listening');
  const [showPronunciationGuide, setShowPronunciationGuide] = useState(false);
  const [userRecordings, setUserRecordings] = useState({});
  const [quizScore, setQuizScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [languageSwitcherVisible, setLanguageSwitcherVisible] = useState(false);

  useEffect(() => {
    loadVocabulary();
  }, [activeLanguage]);

  const loadVocabulary = async () => {
    try {
      setLoading(true);
      const response = await vocabularyAPI.getAll({
        limit: 20,
        includePronunciation: 'true',
        lang: activeLanguage?.code || 'IZON',
      });
      const data = response.data?.success ? response.data.data : response.data;
      setWords(data || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load vocabulary');
    } finally {
      setLoading(false);
    }
  };

  const handleUserRecording = (uri) => {
    const currentWord = words[currentWordIndex];
    setUserRecordings(prev => ({
      ...prev,
      [currentWord.id]: uri,
    }));
  };

  const handleNext = () => {
    if (currentWordIndex < words.length - 1) {
      setCurrentWordIndex(prev => prev + 1);
    } else {
      if (practiceMode === 'quiz') {
        setShowResults(true);
      } else {
        Alert.alert('Complete!', 'You have practiced all words!');
      }
    }
  };

  const handlePrevious = () => {
    if (currentWordIndex > 0) {
      setCurrentWordIndex(prev => prev - 1);
    }
  };

  const handleQuizAnswer = (isCorrect) => {
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
    handleNext();
  };

  const renderListeningPractice = () => {
    const word = words[currentWordIndex];
    if (!word) return null;

    return (
      <View style={[styles.practiceContainer, { backgroundColor: theme.card }]}>
        <Text style={styles.word}>{word.izonWord}</Text>
        
        <AudioPlayer 
          audioUrl={word.audioUrl}
          word={word.izonWord}
          onRecord={handleUserRecording}
          showControls={true}
        />

        <View style={styles.pronunciationDetails}>
          <TouchableOpacity
            style={styles.guideButton}
            onPress={() => setShowPronunciationGuide(true)}
          >
            <Icon name="volume-up" size={20} color="#fff" />
            <Text style={styles.guideButtonText}>Pronunciation Guide</Text>
          </TouchableOpacity>

          {word.pronunciation?.ipa && (
            <View style={[styles.ipaContainer, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.ipaLabel}>IPA:</Text>
              <Text style={[styles.ipaText, { color: theme.text }]}>{word.pronunciation.ipa}</Text>
            </View>
          )}

          {word.pronunciation?.breakdown && (
            <View style={styles.breakdownContainer}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Sound Breakdown:</Text>
              <View style={styles.soundsGrid}>
                {word.pronunciation.breakdown.map((sound, index) => (
                  <View key={index} style={styles.soundItem}>
                    <View style={styles.soundCharContainer}>
                      <Text style={styles.soundChar}>{sound.char}</Text>
                      <Text style={styles.soundType}>
                        {sound.type === 'vowel' ? 'V' : 'C'}
                      </Text>
                    </View>
                    <Text style={[styles.soundDesc, { color: theme.subText }]}>{sound.sound}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.translation}>{word.englishTranslation}</Text>
          
          {word.examples?.[0] && (
            <View style={[styles.exampleContainer, { backgroundColor: '#F5F5F5' }]}>
              <Text style={[styles.exampleLabel, { color: theme.subText }]}>Example:</Text>
              <Text style={[styles.exampleText, { color: theme.text }]}>{word.examples[0].izon}</Text>
              <Text style={[styles.exampleTranslation, { color: theme.subText }]}>{word.examples[0].english}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSpeakingPractice = () => {
    const word = words[currentWordIndex];
    if (!word) return null;

    const userRecording = userRecordings[word.id];

    return (
      <View style={[styles.practiceContainer, { backgroundColor: theme.card }]}>
        <Text style={[styles.practiceTitle, { color: theme.text }]}>🎤 Speaking Practice</Text>
        <Text style={[styles.instruction, { color: theme.subText }]}>
          Listen to the word, then record yourself saying it
        </Text>

        <View style={[styles.wordCard, { backgroundColor: '#E3F2FD' }]}>
          <Text style={styles.word}>{word.izonWord}</Text>
          <Text style={[styles.translationHint, { color: theme.subText }]}>{word.englishTranslation}</Text>
        </View>

        <AudioPlayer 
          audioUrl={word.audioUrl}
          word={word.izonWord}
          onRecord={handleUserRecording}
          showControls={true}
        />

        <View style={[styles.tipsContainer, { backgroundColor: '#FFF8E1' }]}>
          <Text style={styles.tipsTitle}>Tips:</Text>
          <Text style={[styles.tip, { color: theme.subText }]}>• Listen carefully to the native speaker</Text>
          <Text style={[styles.tip, { color: theme.subText }]}>• Pay attention to tone and pitch</Text>
          <Text style={[styles.tip, { color: theme.subText }]}>• Record yourself multiple times</Text>
          <Text style={[styles.tip, { color: theme.subText }]}>• Compare your recording with the native</Text>
        </View>

        {userRecording && (
          <View style={[styles.recordingFeedback, { backgroundColor: '#E8F5E9' }]}>
            <Text style={styles.feedbackTitle}>✅ Recording Saved!</Text>
            <Text style={[styles.feedbackText, { color: theme.subText }]}>
              Great job! You can listen to your recording by tapping "Play Your Voice"
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderQuiz = () => {
    const word = words[currentWordIndex];
    if (!word) return null;

    const options = generateQuizOptions(word);

    return (
      <View style={[styles.practiceContainer, { backgroundColor: theme.card }]}>
        <Text style={[styles.practiceTitle, { color: theme.text }]}>🧠 Pronunciation Quiz</Text>
        <Text style={[styles.instruction, { color: theme.subText }]}>
          Listen to the pronunciation and choose the correct word
        </Text>

        <View style={styles.quizAudioContainer}>
          <AudioPlayer 
            audioUrl={word.audioUrl}
            word={null}
            showControls={false}
          />
        </View>

        <Text style={[styles.quizQuestion, { color: theme.text }]}>Which word did you hear?</Text>

        <View style={styles.optionsContainer}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={styles.optionButton}
              onPress={() => handleQuizAnswer(option.isCorrect)}
            >
              <Text style={[styles.optionText, { color: theme.text }]}>{option.text}</Text>
              {option.isCorrect && (
                <Icon name="check-circle" size={20} color="#4CAF50" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.scoreContainer, { backgroundColor: '#F5F5F5' }]}>
          <Text style={[styles.scoreText, { color: theme.text }]}>
            Score: {quizScore}/{currentWordIndex}
          </Text>
          <Text style={styles.progressText}>
            Question {currentWordIndex + 1} of {words.length}
          </Text>
        </View>
      </View>
    );
  };

  const generateQuizOptions = (correctWord) => {
    const options = [{ text: correctWord.izonWord, isCorrect: true }];
    
    const otherWords = words
      .filter(w => w.id !== correctWord.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(w => ({ text: w.izonWord, isCorrect: false }));
    
    return [...options, ...otherWords].sort(() => Math.random() - 0.5);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={[styles.loadingText, { color: theme.subText }]}>Loading pronunciation exercises...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader 
        title="Pronunciation Practice"
        showLanguageSelector={true}
        onLanguagePress={() => setLanguageSwitcherVisible(true)}
        onBackPress={() => navigation.goBack()}
      />

      <View style={[styles.modeSelectorWrapper, { backgroundColor: '#1a73e8' }]}>
        <View style={styles.modeSelector}>
          {['listening', 'speaking', 'quiz'].map(mode => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.modeButton,
                practiceMode === mode && styles.activeModeButton,
                practiceMode === mode && { backgroundColor: theme.card }
              ]}
              onPress={() => setPracticeMode(mode)}
            >
              <Text style={[
                styles.modeButtonText,
                practiceMode === mode && styles.activeModeButtonText,
              ]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.progressContainer, { backgroundColor: theme.card }]}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${((currentWordIndex + 1) / words.length) * 100}%` }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: theme.subText }]}>
          Word {currentWordIndex + 1} of {words.length}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {practiceMode === 'listening' && renderListeningPractice()}
        {practiceMode === 'speaking' && renderSpeakingPractice()}
        {practiceMode === 'quiz' && renderQuiz()}
      </ScrollView>

      <View style={[styles.navigation, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[styles.navButton, currentWordIndex === 0 && styles.disabledButton]}
          onPress={handlePrevious}
          disabled={currentWordIndex === 0}
        >
          <Icon name="arrow-back" size={20} color="#fff" />
          <Text style={styles.navButtonText}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleNext}
        >
          <Text style={styles.navButtonText}>
            {currentWordIndex < words.length - 1 ? 'Next' : 'Finish'}
          </Text>
          <Icon name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showPronunciationGuide}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{activeLanguage?.name || 'Izon'} Pronunciation Guide</Text>
              <TouchableOpacity onPress={() => setShowPronunciationGuide(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.guideContent}>
              <View style={styles.guideSection}>
                <Text style={styles.guideSectionTitle}>Vowels</Text>
                <View style={styles.soundsGrid}>
                  {Object.entries({
                    "a": "like 'a' in 'father'",
                    "e": "like 'e' in 'bed'",
                    "ẹ": "like 'e' but with slightly rounded lips",
                    "i": "like 'ee' in 'see'",
                    "ị": "higher pitch than regular 'i'",
                    "o": "like 'o' in 'go'",
                    "ọ": "like 'o' but deeper in throat",
                    "u": "like 'oo' in 'food'",
                    "ụ": "like 'u' but with tension"
                  }).map(([char, desc]) => (
                    <View key={char} style={styles.soundItem}>
                      <Text style={[styles.guideChar, { color: theme.text }]}>{char}</Text>
                      <Text style={[styles.guideDesc, { color: theme.subText }]}>{desc}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.guideSection}>
                <Text style={styles.guideSectionTitle}>Special Consonants</Text>
                <View style={styles.soundsGrid}>
                  {Object.entries({
                    "gb": "simultaneous g and b sounds",
                    "kp": "simultaneous k and p sounds",
                    "ny": "like 'ñ' in Spanish 'señor'",
                    "gh": "voiced velar fricative (like French 'r')",
                  }).map(([char, desc]) => (
                    <View key={char} style={styles.soundItem}>
                      <Text style={[styles.guideChar, { color: theme.text }]}>{char}</Text>
                      <Text style={[styles.guideDesc, { color: theme.subText }]}>{desc}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.tipsSection}>
                <Text style={styles.tipsSectionTitle}>Pronunciation Tips</Text>
                <Text style={[styles.tipItem, { color: theme.subText }]}>• {activeLanguage?.name || 'Izon'} is a tonal language - pitch changes meaning</Text>
                <Text style={[styles.tipItem, { color: theme.subText }]}>• Practice 'gb' and 'kp' as single sounds</Text>
                <Text style={[styles.tipItem, { color: theme.subText }]}>• Press tongue to roof of mouth for 'ny' sound</Text>
                <Text style={[styles.tipItem, { color: theme.subText }]}>• Listen for nasalization in vowels following m/n</Text>
                <Text style={[styles.tipItem, { color: theme.subText }]}>• Start with simple words before attempting tones</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showResults}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.resultsContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.resultsTitle, { color: theme.text }]}>🎉 Quiz Complete!</Text>
            <Text style={[styles.resultsScore, { color: theme.subText }]}>
              Your Score: {quizScore}/{words.length}
            </Text>
            <Text style={styles.resultsPercentage}>
              {Math.round((quizScore / words.length) * 100)}%
            </Text>

            <View style={styles.resultsFeedback}>
              {quizScore === words.length ? (
                <Text style={styles.perfectText}>Perfect! Excellent listening skills! 🎯</Text>
              ) : quizScore >= words.length * 0.7 ? (
                <Text style={styles.goodText}>Good job! Keep practicing! 👍</Text>
              ) : (
                <Text style={styles.practiceText}>Keep practicing! You'll improve! 💪</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.restartButton}
              onPress={() => {
                setShowResults(false);
                setCurrentWordIndex(0);
                setQuizScore(0);
              }}
            >
              <Text style={styles.restartButtonText}>Restart Quiz</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowResults(false);
                setPracticeMode('listening');
              }}
            >
              <Text style={[styles.closeButtonText, { color: theme.subText }]}>Back to Practice</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <LanguageSwitcher
        visible={languageSwitcherVisible}
        onClose={() => setLanguageSwitcherVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  modeSelectorWrapper: {
    padding: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
    padding: 3,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
  },
  activeModeButton: {
    // backgroundColor handled inline
  },
  modeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  activeModeButtonText: {
    color: '#1a73e8',
  },
  progressContainer: {
    padding: 15,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  practiceContainer: {
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  word: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a73e8',
    textAlign: 'center',
    marginBottom: 15,
  },
  practiceTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  pronunciationDetails: {
    marginTop: 20,
  },
  guideButton: {
    flexDirection: 'row',
    backgroundColor: '#FF9800',
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  guideButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  ipaContainer: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  ipaLabel: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  ipaText: {
    fontSize: 20,
    fontFamily: 'System',
  },
  breakdownContainer: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  soundsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  soundItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    minWidth: 60,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  soundCharContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  soundChar: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginRight: 5,
  },
  soundType: {
    fontSize: 10,
    color: '#fff',
    backgroundColor: '#FF9800',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  soundDesc: {
    fontSize: 10,
    textAlign: 'center',
  },
  translation: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 10,
  },
  exampleContainer: {
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  exampleText: {
    fontSize: 16,
    marginBottom: 5,
  },
  exampleTranslation: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  wordCard: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  translationHint: {
    fontSize: 14,
    marginTop: 5,
  },
  tipsContainer: {
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF8F00',
    marginBottom: 10,
  },
  tip: {
    fontSize: 14,
    marginBottom: 5,
    lineHeight: 20,
  },
  recordingFeedback: {
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  feedbackTitle: {
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  feedbackText: {
    fontSize: 14,
  },
  quizAudioContainer: {
    marginBottom: 20,
  },
  quizQuestion: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  optionText: {
    fontSize: 16,
    flex: 1,
  },
  scoreContainer: {
    marginTop: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  navigation: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 10,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#1a73e8',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  navButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  guideContent: {
    padding: 20,
  },
  guideSection: {
    marginBottom: 25,
  },
  guideSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 15,
  },
  guideChar: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  guideDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  tipsSection: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 10,
  },
  tipsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 10,
  },
  tipItem: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  resultsContent: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultsScore: {
    fontSize: 20,
    marginBottom: 5,
  },
  resultsPercentage: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 20,
  },
  resultsFeedback: {
    marginBottom: 30,
  },
  perfectText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  goodText: {
    fontSize: 16,
    color: '#FF9800',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  practiceText: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  restartButton: {
    backgroundColor: '#1a73e8',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  restartButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    padding: 15,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
  },
});
