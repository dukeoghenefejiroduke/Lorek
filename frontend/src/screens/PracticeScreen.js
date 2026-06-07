import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Animated,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { vocabularyAPI, pronunciationAPI, gamificationAPI, practiceAPI } from '../services/api';
import Quiz from '../components/Quiz';
import AudioPlayer from '../components/AudioPlayer';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import haptics from '../utils/haptics';
import * as Speech from 'expo-speech';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';
import ScreenHeader from '../components/ScreenHeader';
import LanguageSwitcher from '../components/LanguageSwitcher';

const { width } = Dimensions.get('window');

export default function PracticeScreen() {
  const navigation = useNavigation();
  
  // State management
  const [mode, setMode] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [pronunciationMode, setPronunciationMode] = useState('listening');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userRecordings, setUserRecordings] = useState({});
  const [pronunciationGuide, setPronunciationGuide] = useState(null);
  const [pronunciationWords, setPronunciationWords] = useState([]);
  const [loadingPronunciation, setLoadingPronunciation] = useState(false);
  const [listeningQuestions, setListeningQuestions] = useState([]);
  const [currentListeningQuestion, setCurrentListeningQuestion] = useState(0);
  const [listeningScore, setListeningScore] = useState(0);
  const [showListeningResults, setShowListeningResults] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [stats, setStats] = useState({
    totalPractice: 0,
    correctAnswers: 0,
    streak: 0,
    accuracy: 0,
  });
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(50);
  const [dailyProgress, setDailyProgress] = useState(0);
  const [achievements, setAchievements] = useState([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [forecast, setForecast] = useState([]);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [languageSwitcherVisible, setLanguageSwitcherVisible] = useState(false);
  
   // SRS Specific State
  const [sessionId, setSessionId] = useState(null);
  const [srsStats, setSrsStats] = useState({ dueToday: 0, completedToday: 0 });
  
 const { activeLanguage } = useContext(LanguageContext);
    
   const contextValue = useContext(ThemeContext) || {};
   console.log('DEBUG: Accessing ThemeContext in PracticeScreen.js:', contextValue);
   const { isDarkMode, theme } = contextValue;
    
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Sync SRS stats whenever screen focuses
  useFocusEffect(
    useCallback(() => {
      loadSrsStats();
      loadForecast();
    }, [])
  );

    useEffect(() => {
    const getPersistedProgress = async () => {
      const saved = await AsyncStorage.getItem('dailyProgress');
      if (saved) setDailyProgress(JSON.parse(saved));
    };
    getPersistedProgress();
    
    loadUserStats();
    loadAchievements();
    
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 20000, useNativeDriver: true })
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const checkAuth = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Authentication Required', 'Please log in to practice.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
      return false;
    }
    return true;
  };
  
   const loadSrsStats = async () => {
    try {
      const res = await practiceAPI.getDaily();
      if (res.data?.success) {
        setSrsStats({
          dueToday: res.data.data.stats.dueToday,
          completedToday: res.data.data.stats.completedToday
        });
      }
    } catch (e) {
    }
  };

  const loadForecast = async () => {
    try {
      setLoadingForecast(true);
      const res = await practiceAPI.getForecast();
      if (res.data?.success) {
        setForecast(res.data.data);
      }
    } catch (e) {
    } finally {
      setLoadingForecast(false);
    }
  };
  
 const handleFinish = async (correct, total) => {
  const finalScore = total > 0 ? Math.round((correct / total) * 100) : 0;
  try {
    setLoading(true);
    const response = await gamificationAPI.updateProgress(mode, {
      score: finalScore,
      completed: finalScore >= 70,
      correctCount: correct,
      totalQuestions: total 
    });

    // If your API returns the updated stats object, use it directly
    if (response.data?.data?.stats) {
      setStats(response.data.data.stats);
    } else {
      // Otherwise, force a reload from the source of truth
      await loadUserStats();
    }
  } catch (error) {
    console.error("Failed to save progress:", error.message);
  } finally {
    setLoading(false);
  }
};

 const loadUserStats = async () => {
  try {
    const response = await gamificationAPI.getUserStats();
    const dbData = response.data?.data;

    if (dbData) {
      setStats({
        // Add fallbacks to 0 to ensure the state isn't undefined
        totalPractice: dbData.points || 0,
        correctAnswers: dbData.correctAnswers || 0,
        streak: dbData.streak || 0,
        accuracy: dbData.accuracy || 0,
      });
      setDailyProgress(dbData.dailyProgress || 0);
    }
  } catch (error) {
    console.error('Stats sync error:', error);
  }
};

  const loadAchievements = async () => {
    try {
      const response = await gamificationAPI.getAchievements();
      const data = response.data?.data || response.data;
      setAchievements(Array.isArray(data) ? data : []);
    } catch (error) {
      setAchievements([]); 
    }
  };
  
   const handleAnswer = async (selectedAnswer) => {
    const currentQ = questions[currentQuestion];
    
     if (!currentQ) return; // Guard clause
    
    const isCorrect = selectedAnswer === currentQ.correctAnswer;
    const newScore = isCorrect ? score + 1 : score;

    // Handle SRS Backend Submission if in SRS mode
  if (mode === 'srs-daily' && sessionId) {
    try {
      // Ensure we have a valid word ID before calling the API
      const wordId = currentQ.word?._id || currentQ.word?.id;
      if (wordId) {
        await practiceAPI.submitResult({
          sessionId,
          wordId: wordId,
          quality: isCorrect ? 4 : 0, 
        });
      }
    } catch (e) {
    }
  }

    if (isCorrect) {
      setScore(newScore);
      updateStats(true);
    } else {
      updateStats(false);
    }

    if (currentQuestion + 1 < questions.length) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 500);
    } else {
      handleFinish(newScore, questions.length);
      setTimeout(() => setShowResults(true), 500);
    }
  };

 const updateStats = (correct) => {
    setDailyProgress(prev => {
      const newProgress = Math.min(prev + 10, dailyGoal);
      AsyncStorage.setItem('dailyProgress', JSON.stringify(newProgress));
      if (newProgress >= dailyGoal && prev < dailyGoal) {
        haptics.notificationSuccess();
        Alert.alert('🎉 Daily Goal Achieved!', 'Great job!');
      }
      return newProgress;
    });
    
    setStats(prev => {
      const total = (Number(prev?.totalPractice) || 0) + 1;
      const correctCount = (Number(prev?.correctAnswers) || 0) + (correct ? 1 : 0);
      return {
        ...prev,
        totalPractice: total,
        correctAnswers: correctCount,
        accuracy: total > 0 ? Math.round((correctCount / total) * 100) : 0,
        streak: prev.streak || 0,
      };
    });
  };

  // Add this helper function inside your PracticeScreen component
 const extractWords = (response) => {
  const data = response?.data?.data ?? response?.data ?? [];
  return Array.isArray(data) ? data : (data?.words ?? []);
};

const loadPronunciationWords = async () => {
    if (!(await checkAuth())) return;
    try {
      setLoading(true);
      const response = await pronunciationAPI.getVocabularyWithPronunciation({
        limit: 10,
        category: 'greetings,numbers,family',
      });

      const words = extractWords(response);
      const wordsWithAudio = words.filter((word) => word.audioUrl || word.audio);

      if (wordsWithAudio.length === 0) {
        Alert.alert('No Audio Available', 'No words with audio found. Add audio to your vocabulary first.');
        setMode(null);
        return;
      }

      setPronunciationWords(wordsWithAudio.slice(0, 10));
    } catch (error) {
      console.error('Failed to load pronunciation words:', error);
      Alert.alert('Error', error.response?.data?.data.message || 'Failed to load pronunciation words.');
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

  const loadListeningQuiz = async () => {
    if (!(await checkAuth())) return;
    try {
      setLoading(true);
      const response = await pronunciationAPI.getVocabularyWithPronunciation({
        limit: 15,
        hasAudio: true,
      });

      const words = extractWords(response);
      const wordsWithAudio = words.filter((word) => word.audioUrl || word.audio).slice(0, 10);

      if (wordsWithAudio.length < 5) {
        Alert.alert('Not Enough Audio', 'Need at least 5 words with audio for the listening quiz.');
        setMode(null);
        return;
      }

      const listeningQuiz = wordsWithAudio.map((word) => {
        const otherWords = wordsWithAudio
          .filter((w) => (w._id || w.id) !== (word._id || word.id))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        const options = [
          word.englishTranslation || word.english,
          ...otherWords.map((w) => w.englishTranslation || w.english),
        ].sort(() => Math.random() - 0.5);

        return {
          id: word._id || word.id,
          audioUrl: word.audioUrl || word.audio,
          question: "Listen to the audio. What does it mean in English?",
          correctAnswer: word.englishTranslation || word.english,
          options,
          word: word.izonWord || word.word,
          phonetic: word.phonetic || '',
          hint: "Tap the play button to listen to the pronunciation",
        };
      });

      setListeningQuestions(listeningQuiz);
      setCurrentListeningQuestion(0);
      setListeningScore(0);
      setShowListeningResults(false);
    } catch (error) {
      console.error('Failed to load listening quiz:', error);
      Alert.alert('Error', error.response?.data?.data.message || 'Failed to load listening quiz.');
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

 const loadQuizQuestions = async (practiceMode) => {
    setLoading(true);
    try {
      const response = await pronunciationAPI.getVocabularyWithPronunciation({ limit: 10, lang: activeLanguage.code});
      const words = extractWords(response);
      if (words.length === 0) {
        Alert.alert('No Vocabulary Found', 'Add words to your database first!');
        setMode(null);
        return;
      }
      const quizQuestions = words.map((word) => ({
        question: practiceMode === 'izon-to-english' 
          ? `What does "${word.izonWord || word.word}" mean?` 
          : `How do you say "${word.englishTranslation || word.english}"?`,
        correctAnswer: practiceMode === 'izon-to-english' 
          ? (word.englishTranslation || word.english) 
          : (word.izonWord || word.word),
        options: generateOptions(word, words, practiceMode),
        word,
      }));
      setQuestions(quizQuestions);
      setMode(practiceMode);
    } catch (e) {
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

 const startPractice = async (practiceMode) => {
  haptics.impactLight();
  setShowResults(false);
  setShowListeningResults(false);
  setScore(0);
  setCurrentQuestion(0);
  setSessionId(null);
    if (!(await checkAuth())) return;

if (practiceMode === 'srs-daily') {
  setLoading(true);
  try {
    const res = await practiceAPI.getDaily({ limit: 15, lang: activeLanguage.code});
    const words = res.data?.data?.words || [];
    const sId = res.data?.data?.sessionId;

    if (words.length === 0) {
      Alert.alert("All Caught Up!", "No words due for review today.");
      setLoading(false);
      return;
    }

    const srsQuestions = words.map(word => {
      // FIX: Ensure we extract the strings correctly regardless of nesting
      const izon = word.izonWord || word.word || "Unknown";
      const english = word.englishTranslation || word.english || "Unknown";
      
      return {
        question: `How do you say "${english}"?`,
        correctAnswer: izon,
        options: generateOptions(word, words, 'english-to-izon'),
        word: word 
      };
    });

    setQuestions(srsQuestions);
    setSessionId(sId);
    setMode('srs-daily');
  } catch (e) {
    Alert.alert("Error", "Failed to load daily review.");
  } finally {
    setLoading(false);
  }
  return;
}

    if (practiceMode === 'listening-quiz') {
      await loadListeningQuiz();
      setMode('listening-quiz');
      return;
    }

    if (practiceMode === 'pronunciation') {
      setMode(practiceMode);
      await loadPronunciationWords();
      return;
    }

    await loadQuizQuestions(practiceMode);
  };

  const handleListeningAnswer = (selectedAnswer, index) => {
    setSelectedOption(index);
    setShowFeedback(true);
    haptics.impactLight();
    
    const currentQ = listeningQuestions[currentListeningQuestion];
    const isCorrect = selectedAnswer === currentQ.correctAnswer;

    if (isCorrect) {
      setListeningScore(prev => prev + 1);
      updateStats(true);
    } else {
      updateStats(false);
    }

  // Inside handleListeningAnswer...
  setTimeout(() => {
  setSelectedOption(null);
  setShowFeedback(false);
  
  if (currentListeningQuestion + 1 < listeningQuestions.length) {
    setCurrentListeningQuestion(prev => prev + 1);
    setIsPlayingAudio(false);
  } else {
    // LISTENING QUIZ FINISHED
    handleFinish(listeningScore, listeningQuestions.length); // Call the API update
    setShowListeningResults(true);
  }
}, 1500);

  };
 
 const generateOptions = (correctWord, allWords, mode) => {
  const correct = mode === 'izon-to-english'
    ? (correctWord.englishTranslation || correctWord.english)
    : (correctWord.izonWord || correctWord.word);

  const others = allWords
    .filter(w => {
      const wId = w._id || w.id;
      const cId = correctWord._id || correctWord.id;
      return wId !== cId;
    })
    .map(w => mode === 'izon-to-english' 
      ? (w.englishTranslation || w.english) 
      : (w.izonWord || w.word)
    )
    .filter(option => option && option !== correct);

  // Shuffle and pick 3
  const shuffledOthers = others.sort(() => Math.random() - 0.5).slice(0, 3);

  // Ensure we always have 4 options total, even if database is small
  const finalOptions = [correct, ...shuffledOthers];
  
  // Fill in placeholders if we don't have enough words in the DB
  while (finalOptions.length < 4) {
    finalOptions.push("..."); 
  }

  return finalOptions.sort(() => Math.random() - 0.5);
};

  const handleNextWord = () => {
    if (currentWordIndex < pronunciationWords.length - 1) {
      setCurrentWordIndex(prev => prev + 1);
    } else {
      Alert.alert('Complete!', 'You have practiced all pronunciation words!');
      setMode(null);
    }
  };

  const handlePreviousWord = () => {
    if (currentWordIndex > 0) {
      setCurrentWordIndex(prev => prev - 1);
    }
  };

  const handleUserRecording = (uri) => {
    const currentWord = pronunciationWords[currentWordIndex];
    setUserRecordings(prev => ({
      ...prev,
      [currentWord.id || currentWord._id]: uri,
    }));
    haptics.notificationSuccess();
  };

  const speakWord = (word) => {
    Speech.speak(word, {
      language: 'ig',
      pitch: 1,
      rate: 0.8,
    });
  };

  const resetPractice = () => {
    setMode(null);
    setQuestions([]);
    setCurrentQuestion(0);
    setScore(0);
    setShowResults(false);
    setPronunciationWords([]);
    setCurrentWordIndex(0);
    setUserRecordings({});
    setListeningQuestions([]);
    setCurrentListeningQuestion(0);
    setListeningScore(0);
    setShowListeningResults(false);
    setSelectedOption(null);
    setShowFeedback(false);
    setSessionId(null);
  };

  const renderListeningQuiz = () => {
    const currentQ = listeningQuestions[currentListeningQuestion];
    
    if (!currentQ) return null;

    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.gradientHeader}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={resetPractice}
            >
              <Icon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Listening Quiz</Text>
              <Text style={styles.headerSubtitle}>
                Question {currentListeningQuestion + 1} of {listeningQuestions.length}
              </Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>Score: {listeningScore}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.container}>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${((currentListeningQuestion + 1) / listeningQuestions.length) * 100}%`,
                    backgroundColor: '#4CAF50',
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(((currentListeningQuestion + 1) / listeningQuestions.length) * 100)}%
            </Text>
          </View>

          <ScrollView 
            style={styles.quizContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.questionCard}>
              <View style={styles.questionIcon}>
                <Icon name="ear-hearing" size={40} color="#667eea" />
              </View>
              <Text style={styles.questionText}>{currentQ.question}</Text>
              
              {currentQ.word && (
                <View style={styles.wordHint}>
                  <Text style={styles.wordHintText}>
                    Word: <Text style={styles.wordHighlight}>{currentQ.word}</Text>
                  </Text>
                </View>
              )}
              
              <View style={styles.audioPlayerCard}>
                <Text style={styles.audioLabel}>Listen to pronunciation:</Text>
                <AudioPlayer 
                  audioUrl={currentQ.audioUrl}
                  word={currentQ.word}
                  showControls={true}
                  autoPlay={false}
                  onPlay={() => setIsPlayingAudio(true)}
                  onStop={() => setIsPlayingAudio(false)}
                />
              </View>

              <View style={styles.hintBox}>
                <Icon name="lightbulb-outline" size={18} color="#FF9800" />
                <Text style={styles.hintText}>{currentQ.hint}</Text>
              </View>
            </View>

            <View style={styles.optionsContainer}>
              {currentQ.options.map((option, index) => {
                const isSelected = selectedOption === index;
                const isCorrect = option === currentQ.correctAnswer;
                let buttonStyle = styles.optionButton;
                let textStyle = styles.optionText;

                if (showFeedback) {
                  if (isSelected && isCorrect) {
                    buttonStyle = styles.optionButtonCorrect;
                    textStyle = styles.optionTextCorrect;
                  } else if (isSelected && !isCorrect) {
                    buttonStyle = styles.optionButtonIncorrect;
                    textStyle = styles.optionTextIncorrect;
                  } else if (!isSelected && isCorrect) {
                    buttonStyle = styles.optionButtonCorrect;
                    textStyle = styles.optionTextCorrect;
                  }
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      buttonStyle,
                      isSelected && styles.optionButtonSelected,
                    ]}
                    onPress={() => handleListeningAnswer(option, index)}
                    disabled={showFeedback}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      <View style={styles.optionIndex}>
                        <Text style={styles.optionIndexText}>{String.fromCharCode(65 + index)}</Text>
                      </View>
                      <Text style={textStyle} numberOfLines={2}>{option}</Text>
                      {showFeedback && isCorrect && (
                        <Icon name="check-circle" size={24} color="#4CAF50" style={styles.feedbackIcon} />
                      )}
                      {showFeedback && isSelected && !isCorrect && (
                        <Icon name="close-circle" size={24} color="#f44336" style={styles.feedbackIcon} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.footer}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Icon name="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.statText}>{listeningScore} Correct</Text>
                </View>
                <View style={styles.statItem}>
                  <Icon name="clock-outline" size={20} color="#2196F3" />
                  <Text style={styles.statText}>
                    {listeningQuestions.length - currentListeningQuestion - 1} Remaining
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  };

  const renderListeningResults = () => {
    const percentage = Math.round((listeningScore / listeningQuestions.length) * 100);
    let message, color, icon;
    
    if (percentage >= 90) {
      message = "Outstanding! 🎉 Master Listener";
      color = "#4CAF50";
      icon = "trophy";
    } else if (percentage >= 70) {
      message = "Great Job! 👍 Keep Going";
      color = "#2196F3";
      icon = "star";
    } else if (percentage >= 50) {
      message = "Good Start! 📚 Practice More";
      color = "#FF9800";
      icon = "trending-up";
    } else {
      message = "Keep Practicing! 💪 You'll Improve";
      color = "#f44336";
      icon = "refresh";
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.gradientHeader}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={resetPractice}
            >
              <Icon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Quiz Results</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.container}>
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <View style={[styles.resultIcon, { backgroundColor: color + '20' }]}>
                <Icon name={icon} size={60} color={color} />
              </View>
              <Text style={[styles.resultsMessage, { color }]}>{message}</Text>
            </View>

            <View style={styles.scoreCircle}>
              <LinearGradient
                colors={[color, color + 'CC']}
                style={styles.scoreCircleGradient}
              >
                <Text style={styles.scoreCircleText}>
                  {listeningScore}<Text style={styles.scoreCircleTotal}>/{listeningQuestions.length}</Text>
                </Text>
                <Text style={styles.scoreCirclePercentage}>{percentage}%</Text>
              </LinearGradient>
            </View>

            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Performance Breakdown</Text>
              
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownLabel}>
                  <Icon name="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.breakdownText}>Correct Answers</Text>
                </View>
                <Text style={[styles.breakdownValue, { color: '#4CAF50' }]}>
                  {listeningScore}
                </Text>
              </View>
              
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownLabel}>
                  <Icon name="close-circle" size={20} color="#f44336" />
                  <Text style={styles.breakdownText}>Incorrect Answers</Text>
                </View>
                <Text style={[styles.breakdownValue, { color: '#f44336' }]}>
                  {listeningQuestions.length - listeningScore}
                </Text>
              </View>
              
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownLabel}>
                  <Icon name="target" size={20} color="#2196F3" />
                  <Text style={styles.breakdownText}>Accuracy Rate</Text>
                </View>
                <Text style={[styles.breakdownValue, { color }]}>
                  {percentage}%
                </Text>
              </View>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryAction]}
                onPress={() => startPractice('listening-quiz')}
              >
                <Icon name="refresh" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Try Again</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryAction]}
                onPress={resetPractice}
              >
                <Icon name="home" size={20} color="#667eea" />
                <Text style={styles.secondaryActionText}>Practice Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  const renderQuizResults = () => {
    const percentage = Math.round((score / questions.length) * 100);
    let message, color;
    
    if (percentage >= 90) {
      message = "Excellent! 🎉 Perfect Score!";
      color = "#4CAF50";
    } else if (percentage >= 70) {
      message = "Great Job! 👍";
      color = "#2196F3";
    } else if (percentage >= 50) {
      message = "Good Start! 📚";
      color = "#FF9800";
    } else {
      message = "Keep Practicing! 💪";
      color = "#f44336";
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.gradientHeader}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={resetPractice}
            >
              <Icon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Practice Complete</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.container}>
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsMessage, { color }]}>{message}</Text>
            </View>

            <View style={styles.scoreCircle}>
              <LinearGradient
                colors={[color, color + 'CC']}
                style={styles.scoreCircleGradient}
              >
                <Text style={styles.scoreCircleText}>
                  {score}<Text style={styles.scoreCircleTotal}>/{questions.length}</Text>
                </Text>
                <Text style={styles.scoreCirclePercentage}>{percentage}%</Text>
              </LinearGradient>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryAction]}
                onPress={() => startPractice(mode)}
              >
                <Icon name="refresh" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Try Again</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryAction]}
                onPress={resetPractice}
              >
                <Icon name="home" size={20} color="#667eea" />
                <Text style={styles.secondaryActionText}>Practice Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  const renderPronunciationPractice = () => {
    if (pronunciationWords.length === 0) return null;

    const currentWord = pronunciationWords[currentWordIndex];

    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#FF9800', '#EF6C00']}
          style={styles.gradientHeader}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={resetPractice}
            >
              <Icon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Pronunciation Practice</Text>
              <Text style={styles.headerSubtitle}>
                Word {currentWordIndex + 1} of {pronunciationWords.length}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.container}>
          <View style={styles.pronunciationContent}>
            <View style={styles.wordCard}>
              <Text style={styles.izonWord}>{currentWord.izonWord || currentWord.word}</Text>
              <Text style={styles.englishWord}>{currentWord.englishTranslation || currentWord.english}</Text>
              {currentWord.phonetic && (
                <Text style={styles.phoneticText}>/{currentWord.phonetic}/</Text>
              )}
              
              <TouchableOpacity 
                style={styles.speakButton}
                onPress={() => speakWord(currentWord.izonWord || currentWord.word)}
              >
                <Icon name="volume-high" size={24} color="#FF9800" />
                <Text style={styles.speakButtonText}>Tap to hear</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.audioSection}>
              <Text style={styles.sectionTitle}>Native Pronunciation</Text>
              <AudioPlayer 
                audioUrl={currentWord.audioUrl || currentWord.audio}
                word={currentWord.izonWord || currentWord.word}
                showControls={true}
              />
            </View>

            <View style={styles.recordSection}>
              <Text style={styles.sectionTitle}>Record Yourself</Text>
              <Text style={styles.sectionSubtitle}>
                Practice speaking and compare with native pronunciation
              </Text>
              <AudioPlayer 
                audioUrl={currentWord.audioUrl || currentWord.audio}
                word={currentWord.izonWord || currentWord.word}
                onRecord={handleUserRecording}
                showControls={true}
                showRecordButton={true}
              />
            </View>

            {userRecordings[currentWord.id || currentWord._id] && (
              <View style={styles.userRecordingSection}>
                <Text style={styles.sectionTitle}>Your Recording</Text>
                <AudioPlayer 
                  audioUrl={userRecordings[currentWord.id || currentWord._id]}
                  word="Your pronunciation"
                  showControls={true}
                />
                <TouchableOpacity 
                  style={styles.compareButton}
                  onPress={() => {
                    // Compare pronunciation logic
                    Alert.alert('Compare', 'Listening to your pronunciation...');
                  }}
                >
                  <Icon name="compare" size={20} color="#4CAF50" />
                  <Text style={styles.compareButtonText}>Compare with Native</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.navigationButtons}>
              <TouchableOpacity
                style={[styles.navButton, currentWordIndex === 0 && styles.navButtonDisabled]}
                onPress={handlePreviousWord}
                disabled={currentWordIndex === 0}
              >
                <Icon name="chevron-left" size={24} color={currentWordIndex === 0 ? "#ccc" : "#333"} />
                <Text style={[styles.navButtonText, currentWordIndex === 0 && styles.navButtonTextDisabled]}>
                  Previous
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navButton, styles.navButtonNext]}
                onPress={handleNextWord}
              >
                <Text style={styles.navButtonNextText}>
                  {currentWordIndex < pronunciationWords.length - 1 ? 'Next Word' : 'Finish'}
                </Text>
                <Icon name="chevron-right" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  const PracticeCard = ({ 
    title, 
    description, 
    icon, 
    onPress, 
    gradient, 
    badge,
    disabled = false,
    progress
  }) => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.modeCard, disabled && styles.modeCardDisabled]}
        onPress={onPress}
        activeOpacity={0.9}
        disabled={disabled}
      >
        <LinearGradient
          colors={gradient}
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardContent}>
            <View style={styles.cardIcon}>
              <Icon name={icon} size={32} color="#fff" />
            </View>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDescription}>{description}</Text>
            {badge && (
              <View style={[styles.cardBadge, { backgroundColor: badge === 'DUE' ? '#ff3b30' : '#FF4081' }]}>
                <Text style={styles.cardBadgeText}>{badge}</Text>
              </View>
            )}
            {disabled && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </View>
            )}          
            {progress !== undefined && (
              <View style={styles.cardProgress}>
                <View style={[styles.cardProgressFill, { width: `${progress}%` }]} />
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderMainMenu = () => (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={isDarkMode ? '#000' : '#667eea'} />
      
      {/* Animated Background Pattern */}
      <Animated.View style={[styles.backgroundPattern, { transform: [{ rotate }] }]}>
        <Text style={[styles.patternText, { color: theme.text, opacity: isDarkMode ? 0.05 : 0.05 }]}>⚡ 𖦹 🔱 ⚡ 𖦹 🔱</Text>
      </Animated.View>

      <ScreenHeader 
        title={`Practice ${activeLanguage?.name || 'Izon'}`}
        showLanguageSelector={true}
        onLanguagePress={() => setLanguageSwitcherVisible(true)}
      >
        <TouchableOpacity 
          style={styles.statsButton}
          onPress={() => setShowStatsModal(true)}
        >
          <Icon name="chart-line" size={24} color="#fff" />
        </TouchableOpacity>
      </ScreenHeader>

      <View style={[styles.dailyProgress, { backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 20 }]}>
        <View style={styles.dailyProgressHeader}>
          <Text style={styles.dailyProgressTitle}>Daily XP Goal</Text>
          <Text style={styles.dailyProgressValue}>{dailyProgress}/{dailyGoal} XP</Text>
        </View>
        <View style={[styles.dailyProgressBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <View style={[styles.dailyProgressFill, { width: `${(dailyProgress / dailyGoal) * 100}%`, backgroundColor: theme.accent }]} />
        </View>
      </View>

      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]}
        showsVerticalScrollIndicator={false}
      >       
      <View style={[styles.streakCard, { backgroundColor: theme.card }]}>
          <View style={styles.streakContent}>
            <Icon name="fire" size={24} color={theme.error} />
            <Text style={[styles.streakText, { color: theme.error }]}>{stats.streak} Day Streak!</Text>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Text style={{marginRight: 10, color: theme.subText, fontWeight: 'bold'}}>{srsStats.dueToday} Due</Text>
             <TouchableOpacity onPress={() => setShowAchievements(true)}>
                <Icon name="trophy" size={24} color={theme.accent} />
             </TouchableOpacity>
          </View>
        </View>

        <View style={styles.modeGrid}>
          <PracticeCard
            title="Daily Review"
            description="Spaced Repetition"
            icon="brain"
            onPress={() => startPractice('srs-daily')}
            gradient={isDarkMode ? ['#442222', '#663333'] : ['#FF5F6D', '#FFC371']}
            badge={srsStats.dueToday > 0 ? `${srsStats.dueToday} DUE` : null}
          />
          
          <PracticeCard
            title={`${activeLanguage?.name || 'Izon'} → English`}
            description="Translate to English"
            icon="translate"
            onPress={() => startPractice('izon-to-english')}
            gradient={isDarkMode ? ['#224422', '#336633'] : ['#4CAF50', '#2E7D32']}
            progress={Math.min(stats.accuracy, 100)}
          />

          <PracticeCard
            title={`English → ${activeLanguage?.name || 'Izon'}`}
            description={`Translate to ${activeLanguage?.name || 'Izon'}`}
            icon="swap-horizontal"
            onPress={() => startPractice('english-to-izon')}
            gradient={isDarkMode ? ['#222244', '#333366'] : ['#2196F3', '#0D47A1']}
          />
          
          <PracticeCard
            title="Conversation"
            description="AI Chatbot"
            icon="chat"
            onPress={() => navigation.navigate("Conversation")}
            gradient={isDarkMode ? ['#442244', '#663366'] : ['#9C27B0', '#6A1B9A']}
            badge="NEW"
          />
          
          <PracticeCard
            title="Pronunciation"
            description="Speak and Compare"
            icon="microphone"
            onPress={() => startPractice('pronunciation')}
            gradient={isDarkMode ? ['#443322', '#664433'] : ['#FF9800', '#EF6C00']}
          />

          <PracticeCard
            title="Listening Quiz"
            description="Test your ears"
            icon="headphones"
            onPress={() => startPractice('listening-quiz')}
            gradient={isDarkMode ? ['#224444', '#336666'] : ['#9C27B0', '#6A1B9A']}
            badge="POPULAR"
          />
        </View>

        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statsTitle, { color: theme.text }]}>Your Progress</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Icon name="check-circle" size={24} color={theme.success} />
              <Text style={[styles.statNumber, { color: theme.text }]}>{stats?.totalPractice || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>Total Practice</Text>
            </View>
            <View style={styles.statBox}>
              <Icon name="target" size={24} color={theme.secondary} />
              <Text style={[styles.statNumber, { color: theme.text }]}>{stats?.accuracy || 0}%</Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>Accuracy</Text>
            </View>
            <View style={styles.statBox}>
              <Icon name="clock" size={24} color={theme.warning} />
              <Text style={[styles.statNumber, { color: theme.text }]}>{pronunciationWords.length}</Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>Words Learned</Text>
            </View>
          </View>
        </View>

        <View style={[styles.tipsCard, { backgroundColor: isDarkMode ? 'rgba(255, 235, 59, 0.1)' : '#FFFDE7', borderLeftColor: theme.warning }]}>
          <Icon name="lightbulb" size={24} color={theme.warning} />
          <Text style={[styles.tipsText, { color: isDarkMode ? theme.text : '#FF8F00' }]}>
            Tip: Practice daily for 10 minutes to see the best results!
          </Text>
        </View>

        <View style={[styles.recentActivity, { backgroundColor: theme.card }]}>
          <Text style={[styles.recentTitle, { color: theme.text }]}>Recent Activity</Text>
          <View style={styles.activityItem}>
            <Icon name="check-circle" size={16} color={theme.success} />
            <Text style={[styles.activityText, { color: theme.subText }]}>Completed listening quiz - 80% accuracy</Text>
          </View>
          <View style={styles.activityItem}>
            <Icon name="microphone" size={16} color={theme.warning} />
            <Text style={[styles.activityText, { color: theme.subText }]}>Practiced 5 pronunciation words</Text>
          </View>
        </View>
      </ScrollView>

      {/* Stats Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showStatsModal}
        onRequestClose={() => setShowStatsModal(false)}
      >
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={isDarkMode ? ['#000', '#1a1a1a'] : ['#667eea', '#764ba2']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Your Statistics</Text>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalBody}>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statRowLabel, { color: theme.text }]}>Total Practice Sessions</Text>
              <Text style={[styles.statRowValue, { color: theme.primary }]}>{stats.totalPractice || 0}</Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statRowLabel, { color: theme.text }]}>Correct Answers</Text>
                <Text style={[styles.statRowValue, { color: theme.primary }]}>{stats.correctAnswers}</Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statRowLabel, { color: theme.text }]}>Current Streak</Text>
                <Text style={[styles.statRowValue, { color: theme.error }]}>{stats.streak} days</Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statRowLabel, { color: theme.text }]}>Accuracy Rate</Text>
                <Text style={[styles.statRowValue, { color: theme.secondary }]}>{stats.accuracy ?? 0}%</Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statRowLabel, { color: theme.text }]}>Words Learned</Text>
                <Text style={[styles.statRowValue, { color: theme.warning }]}>{pronunciationWords.length}</Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statRowLabel, { color: theme.text }]}>Daily Goal Progress</Text>
                <Text style={[styles.statRowValue, { color: theme.accent }]}>{dailyProgress}/{dailyGoal} XP</Text>
              </View>

              {/* Review Forecast Section */}
              <View style={styles.forecastSection}>
                <Text style={[styles.statsSectionTitle, { color: theme.text }]}>Review Forecast</Text>
                <Text style={[styles.statsSectionSubtitle, { color: theme.subText }]}>Upcoming reviews for the next 7 days</Text>
                
                {loadingForecast ? (
                  <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
                ) : (
                  <View style={styles.forecastContainer}>
                    {forecast.slice(0, 7).map((day, index) => (
                      <View key={index} style={styles.forecastItem}>
                        <View style={[styles.forecastBarContainer, { backgroundColor: theme.background }]}>
                          <View 
                            style={[
                              styles.forecastBar, 
                              { 
                                height: `${Math.min((day.count / 20) * 100, 100)}%`, 
                                backgroundColor: theme.primary 
                              }
                            ]} 
                          />
                        </View>
                        <Text style={[styles.forecastLabel, { color: theme.subText }]}>
                          {index === 0 ? 'Today' : new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                        </Text>
                        <Text style={[styles.forecastCount, { color: theme.text }]}>{day.count}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {/* Achievements Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAchievements}
        onRequestClose={() => setShowAchievements(false)}
      >
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Achievements</Text>
              <TouchableOpacity onPress={() => setShowAchievements(false)}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalBody}>
              {(achievements || []).map((achievement, index) => (
                <View key={index} style={[styles.achievementCard, { borderBottomColor: theme.border }, achievement.unlocked && styles.achievementUnlocked]}>
                  <View style={[styles.achievementIcon, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f5f5f5' }, achievement.unlocked && styles.achievementUnlocked]}>
                    <Icon name={achievement.icon} size={24} color={achievement.unlocked ? theme.accent : theme.subText} />
                  </View>
                  <View style={styles.achievementInfo}>
                    <Text style={[styles.achievementTitle, { color: theme.text }]}>{achievement.title}</Text>
                    <Text style={[styles.achievementDesc, { color: theme.subText }]}>{achievement.description}</Text>
                  </View>
                  {achievement.unlocked && (
                    <Icon name="check-circle" size={20} color={theme.success} />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );

  // Loading State
  if (loading || loadingPronunciation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your practice session...</Text>
      </View>
    );
  }

  // Render based on mode
  if (showResults) {
    return renderQuizResults();
  }

  if (showListeningResults) {
    return renderListeningResults();
  }

  if (mode === 'listening-quiz' && listeningQuestions.length > 0) {
    return renderListeningQuiz();
  }

  if (mode === 'pronunciation' && pronunciationWords.length > 0) {
    return renderPronunciationPractice();
  }

  if (mode && mode !== 'pronunciation' && mode !== 'listening-quiz' && questions.length > 0) {
    return (
      <Quiz
        question={questions[currentQuestion]}
        questionNumber={currentQuestion + 1}
        totalQuestions={questions.length}
        onAnswer={handleAnswer}
        score={score}
      />
    );
  }

  // Default to main menu
  return (
    <View style={{ flex: 1 }}>
      {renderMainMenu()}
      <LanguageSwitcher
        visible={languageSwitcherVisible}
        onClose={() => setLanguageSwitcherVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.05,
  },
  patternText: {
    fontSize: 40,
    color: '#667eea',
  },
  gradientHeader: {
    paddingTop: StatusBar.currentHeight || 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  statsButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  dailyProgress: {
    marginTop: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 12,
  },
  dailyProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dailyProgressTitle: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  dailyProgressValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dailyProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  dailyProgressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },
  scoreBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scoreText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  streakCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  modeGrid: {
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  modeCard: {
    width: (width - 56) / 2,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  modeCardDisabled: {
    opacity: 0.7,
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  cardContent: {
    alignItems: 'center',
  },
  cardIcon: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 14,
  },
  cardBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FF4081',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  comingSoonBadge: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  cardProgressBar: {
    height: '100%',
  },
  cardProgressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
  },
  statsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 25,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  tipsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDE7',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  tipsText: {
    flex: 1,
    fontSize: 14,
    color: '#FF8F00',
    marginLeft: 12,
    fontWeight: '500',
    lineHeight: 20,
  },
  recentActivity: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 30,
    padding: 20,
    borderRadius: 15,
    elevation: 3,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  activityText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  progressContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  quizContent: {
    flex: 1,
    padding: 20,
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    marginBottom: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  questionIcon: {
    marginBottom: 15,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 26,
  },
  wordHint: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 20,
  },
  wordHintText: {
    fontSize: 16,
    color: '#1565C0',
    fontWeight: '500',
  },
  wordHighlight: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  audioPlayerCard: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    padding: 20,
  },
  audioLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    fontWeight: '500',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 12,
    alignSelf: 'stretch',
  },
  hintText: {
    fontSize: 14,
    color: '#FF9800',
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  optionButtonSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f0f4ff',
    transform: [{ scale: 1.02 }],
  },
  optionButtonCorrect: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  optionButtonIncorrect: {
    backgroundColor: '#FFEBEE',
    borderColor: '#f44336',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIndex: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionIndexText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  optionText: {
    fontSize: 17,
    color: '#333',
    flex: 1,
    fontWeight: '500',
  },
  optionTextCorrect: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  optionTextIncorrect: {
    color: '#f44336',
    fontWeight: '600',
  },
  feedbackIcon: {
    marginLeft: 10,
  },
  footer: {
    marginTop: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  resultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  resultsHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  resultIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultsMessage: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
  },
  scoreCircle: {
    width: 200,
    height: 200,
    marginVertical: 30,
  },
  scoreCircleGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreCircleText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  scoreCircleTotal: {
    fontSize: 24,
    fontWeight: 'normal',
  },
  scoreCirclePercentage: {
    fontSize: 20,
    color: '#fff',
    opacity: 0.9,
  },
  breakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    marginBottom: 30,
    elevation: 5,
  },
  breakdownTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  breakdownLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 15,
    gap: 10,
  },
  primaryAction: {
    backgroundColor: '#667eea',
  },
  secondaryAction: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryActionText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pronunciationContent: {
    padding: 20,
  },
  wordCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 25,
    elevation: 5,
  },
  izonWord: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  englishWord: {
    fontSize: 24,
    color: '#666',
    marginBottom: 10,
  },
  phoneticText: {
    fontSize: 18,
    color: '#9C27B0',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  speakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  speakButtonText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '600',
  },
  audioSection: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  recordSection: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  userRecordingSection: {
    backgroundColor: '#E8F5E9',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    gap: 8,
  },
  compareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 30,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    flex: 1,
    marginHorizontal: 5,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  navButtonTextDisabled: {
    color: '#ccc',
  },
  navButtonNext: {
    backgroundColor: '#4CAF50',
  },
  navButtonNextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
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
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statRowLabel: {
    fontSize: 16,
    color: '#666',
  },
  statRowValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  achievementIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  achievementUnlocked: {
    backgroundColor: '#FFF9C4',
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 12,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  
  statsSectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 5 },
  statsSectionSubtitle: { fontSize: 12, marginBottom: 20 },
  forecastSection: { marginTop: 10, paddingBottom: 20 },
  forecastContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 150, paddingVertical: 10 },
  forecastItem: { alignItems: 'center', width: '12%' },
  forecastBarContainer: { width: 10, height: 100, borderRadius: 5, backgroundColor: '#f0f0f0', justifyContent: 'flex-end', overflow: 'hidden' },
  forecastBar: { width: '100%', borderRadius: 5 },
  forecastLabel: { fontSize: 10, marginTop: 8, textAlign: 'center' },
  forecastCount: { fontSize: 10, fontWeight: 'bold', marginTop: 4 },
});
