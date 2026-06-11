import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useEffect, useRef, useContext } from 'react';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Animated, Dimensions, Platform, StatusBar, Alert, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { lessonAPI, progressAPI } from '../services/api';
import { LanguageContext } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

const LessonDetailScreen = ({ route, navigation }) => {
  const { lessonId } = route.params;

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const userAnswersRef = useRef({});
  const [showSummary, setShowSummary] = useState(false);
  const [score, setScore] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [translationInput, setTranslationInput] = useState('');
  const [fillBlankAnswer, setFillBlankAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [isLearningMode, setIsLearningMode] = useState(true);
  const { activeLanguage } = useContext(LanguageContext);

   const contextValue = useContext(ThemeContext) || {};
   console.log('DEBUG: Accessing ThemeContext in LessonDetailScreen.js:', contextValue);
   const { isDarkMode, theme } = contextValue;
   
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    fetchLesson();
    startTimer();
    userAnswersRef.current = {}; // Reset answers on mount
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!loading && !showSummary) {
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    }
  }, [currentExerciseIndex, loading, showSummary, isLearningMode]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeSpent(0);
    timerRef.current = setInterval(() => setTimeSpent(t => t + 1), 1000);
  };

  const fetchLesson = async () => {
    try {
      setLoading(true);
      const response = await lessonAPI.getById(lessonId);
      setLesson(response.data.data || response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load lesson.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const nextExercise = () => {
    const nextIndex = currentExerciseIndex + 1;
    if (nextIndex < lesson.exercises.length) {
      setCurrentExerciseIndex(nextIndex);
      setSelectedOption(null);
      setTranslationInput('');
      setFillBlankAnswer('');
      setShowHint(false);
      const newProgress = ((nextIndex + 1) / lesson.exercises.length) * 100;
      Animated.timing(progressAnim, { toValue: newProgress, duration: 400, useNativeDriver: false }).start();
    } else {
      completeLesson();
    }
  };

const completeLesson = async () => {
  const currentAnswers = userAnswersRef.current; // Get the latest data from Ref
  
  const totalExercises = lesson.exercises.length;
  
  const answersArray = lesson.exercises.map((_, i) => {
    return {
      exerciseIndex: i.toString(),
      answer: currentAnswers[i]?.answer || null,
      correct: currentAnswers[i]?.correct || false,
    };
  });

  const totalCorrect = answersArray.filter(a => a.correct).length;
  const calculatedScore = Math.round((totalCorrect / totalExercises) * 100);

  // Set score early so the UI feels fast
  setScore(calculatedScore);

  const payload = {
    score: calculatedScore,
    timeSpent: timeSpent,
    responses: answersArray,
    startedAt: new Date(Date.now() - timeSpent * 1000).toISOString(),
    completedAt: new Date().toISOString(),
  };

  try {
    // 1. Submit completion
    const response = await lessonAPI.complete(lessonId, payload);
    
    // 2. Use the data RETURNED from the POST (Optimization!)
    // Your backend returns: data.statistics.streak
    const newStreak = response.data?.data?.statistics?.streak; 
    
    if (newStreak !== undefined && newStreak > 0) {
       haptics.notificationSuccess();
    }

    // 3. Finally show summary
    setShowSummary(true);
    
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    console.error('Lesson completion failed:', errorMsg);
    
    // Even if saving failed, show the summary so the user isn't stuck
    Alert.alert(
      'Progress Not Saved', 
      `Your score was ${calculatedScore}%, but we couldn't sync it. ${errorMsg}`,
      [{ text: 'OK', onPress: () => setShowSummary(true) }]
    );
  }
};

  
// Example for Multiple Choice (Apply similar logic to others)
const handleMultipleChoice = (optionId) => {
  const exercise = lesson.exercises[currentExerciseIndex];
  const selectedOptionObj = exercise.options.find(opt => String(opt.id) === String(optionId));
  const isCorrect = selectedOptionObj?.isCorrect === true;

  setSelectedOption(optionId);
  
  // Update the REF immediately
  userAnswersRef.current[currentExerciseIndex] = { answer: optionId, correct: isCorrect };
  // Update state for UI if needed
  setUserAnswers({ ...userAnswersRef.current });

  if (isCorrect) {
    haptics.notificationSuccess();
    Alert.alert('Correct! 🎉', 'Great job!', [{ text: 'Continue', onPress: nextExercise }]);
  } else {
    haptics.notificationError();
    const correctOption = exercise.options.find(opt => opt.isCorrect === true);
    Alert.alert('Incorrect ❌', `Correct answer: ${correctOption?.izon || correctOption?.english}`, [{ text: 'Continue', onPress: nextExercise }]);
  }
};

  const getLevelColor = () => {
    switch (lesson?.level) {
      case 'beginner': return ['#4CAF50', '#2E7D32'];
      case 'intermediate': return ['#FF9800', '#F57C00'];
      case 'advanced': return ['#F44336', '#C62828'];
      default: return ['#2196F3', '#1565C0'];
    }
  };

  const renderLearningContent = () => {
    const { content } = lesson;
    return (
      <ScrollView style={styles.content}>
        <Animated.View style={[styles.exerciseWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {content?.grammar?.map((item, i) => (
            <View key={i} style={[styles.contentCard, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}><Ionicons name="book" size={20} color="#4CAF50" /><Text style={styles.cardTitle}>{item.title.english}</Text></View>
              <Text style={styles.cardText}>{item.explanation.english}</Text>
            </View>
          ))}
          <View style={[styles.contentCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}><MaterialIcons name="translate" size={20} color="#2196F3" /><Text style={styles.cardTitle}>Sentence Examples</Text></View>
            {content?.examples?.map((ex, i) => (
              <View key={i} style={styles.exampleRow}><Text style={styles.izonText}>{ex.izon}</Text><Text style={[styles.englishText, { color: theme.subText }]}>{ex.english}</Text></View>
            ))}
          </View>
          {content?.culturalNotes?.map((note, i) => (
            <View key={i} style={[styles.contentCard, styles.cultureCard, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}><FontAwesome5 name="landmark" size={18} color="#FF9800" /><Text style={styles.cardTitle}>{note.title.english}</Text></View>
              <Text style={styles.cultureText}>{note.content.english}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.startQuizButton} onPress={() => setIsLearningMode(false)}>
            <Text style={styles.startQuizText}>Ready to Practice? Start Quiz</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    );
  };

  const handleTranslation = () => {
    if (!translationInput.trim()) return Alert.alert('Error', 'Please enter your translation');

    const exercise = lesson.exercises[currentExerciseIndex];
    // Simple check: matching lowercase strings
    const isCorrect = translationInput.trim().toLowerCase() === exercise.correctAnswer?.toLowerCase();

    setUserAnswers(prev => ({
      ...prev,
      [currentExerciseIndex]: { answer: translationInput.trim(), correct: isCorrect },
    }));

    if (isCorrect) {
      haptics.notificationSuccess();
      Alert.alert('Correct! 🎉', 'Excellent!', [{ text: 'Continue', onPress: nextExercise }]);
    } else {
      haptics.notificationError();
      Alert.alert('Incorrect ❌', `Correct: ${exercise.correctAnswer}`, [{ text: 'Continue', onPress: nextExercise }]);
    }
  };

  const handleFillBlank = () => {
    if (!fillBlankAnswer.trim()) return Alert.alert('Error', 'Please fill in the blank');

    const exercise = lesson.exercises[currentExerciseIndex];
    const isCorrect = fillBlankAnswer.trim().toLowerCase() === exercise.correctAnswer?.toLowerCase();

    setUserAnswers(prev => ({
      ...prev,
      [currentExerciseIndex]: { answer: fillBlankAnswer.trim(), correct: isCorrect },
    }));

    if (isCorrect) {
      haptics.notificationSuccess();
      Alert.alert('Correct! 🎉', 'Well done!', [{ text: 'Continue', onPress: nextExercise }]);
    } else {
      haptics.notificationError();
      Alert.alert('Incorrect ❌', `Correct: ${exercise.correctAnswer}`, [{ text: 'Continue', onPress: nextExercise }]);
    }
  };
  
   const renderExercise = () => {
    const exercise = lesson?.exercises?.[currentExerciseIndex];
    if (!exercise) return null;

    switch (exercise.type) {
      case 'multiple-choice':
        return (
          <View style={styles.exerciseContainer}>
            <Text style={styles.questionText}>{exercise.question?.izon || exercise.question?.english}</Text>
            <View style={styles.optionsContainer}>
              {exercise.options?.map((opt, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={[styles.optionButton, { backgroundColor: theme.card }, String(selectedOption) === String(opt.id || idx) && styles.selectedOption]} 
                  onPress={() => handleMultipleChoice(opt.id ?? idx)}
                  disabled={!!selectedOption}
                >
                  <Text style={styles.optionText}>{opt.izon || opt.english}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'translation':
        return (
          <View style={styles.exerciseContainer}>
            <Text style={styles.questionText}>Translate this to {exercise.direction === 'en→izon' ? activeLanguage.name : 'English'}:</Text>
            <Text style={styles.translationPrompt}>{exercise.prompt}</Text>
            <TextInput
              style={styles.translationInput}
              placeholder="Type your answer here..."
              value={translationInput}
              onChangeText={setTranslationInput}
              multiline
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleTranslation}>
              <Text style={styles.submitButtonText}>Submit Answer</Text>
            </TouchableOpacity>
          </View>
        );

      case 'fill-blank':
        return (
          <View style={styles.exerciseContainer}>
            <Text style={styles.questionText}>Complete the sentence:</Text>
            <Text style={styles.fillBlankSentence}>
              {exercise.sentence?.split('_____').map((part, idx, arr) => (
                <React.Fragment key={idx}>
                  {part}
                  {idx < arr.length - 1 && (
                    <TextInput
                      style={styles.fillBlankInput}
                      placeholder="..."
                      value={fillBlankAnswer}
                      onChangeText={setFillBlankAnswer}
                      autoFocus
                    />
                  )}
                </React.Fragment>
              ))}
            </Text>
            <TouchableOpacity style={styles.submitButton} onPress={handleFillBlank}>
              <Text style={styles.submitButtonText}>Check Answer</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return <Text style={styles.cardText}>Unsupported exercise type: {exercise.type}</Text>;
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#4CAF50" /></View>;

  if (showSummary) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient colors={['#1a4c2e', '#43a047']} style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Lesson Completed!</Text>
          <Text style={styles.summaryScore}>Score: {score}%</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.card }]} onPress={() => navigation.navigate('Lessons')}>
            <Text style={styles.retryButtonText}>Finish</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={getLevelColor()} style={styles.header}>
        <Text style={styles.headerTitle}>{isLearningMode ? "Learn" : "Quiz"}: {lesson?.title?.english}</Text>
        {!isLearningMode && (
          <View style={styles.progressBarContainer}>
            <Animated.View style={[styles.progressBar, { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
          </View>
        )}
      </LinearGradient>
      {isLearningMode ? renderLearningContent() : <ScrollView>{renderExercise()}</ScrollView>}
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    progressBarContainer: { height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, marginTop: 15 },
    progressBar: { height: '100%', backgroundColor: '#FFD700', borderRadius: 3 },
    content: { flex: 1 },
    exerciseWrapper: { padding: 20 },
    contentCard: { borderRadius: 15, padding: 20, marginBottom: 15, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
    cardTitle: { fontSize: 18, fontWeight: '700', color: '#2E7D32' },
    cardText: { fontSize: 16, lineHeight: 24, color: '#444' },
    exampleRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    izonText: { fontSize: 18, fontWeight: 'bold', color: '#1a4c2e' },
    englishText: { fontSize: 14 },
    cultureCard: { backgroundColor: '#FFF8E1', borderLeftWidth: 4, borderLeftColor: '#FF9800' },
    cultureText: { fontSize: 15, color: '#5D4037' },
    startQuizButton: { backgroundColor: '#4CAF50', flexDirection: 'row', justifyContent: 'center', padding: 18, borderRadius: 12, marginTop: 10, gap: 10 },
    startQuizText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    exerciseContainer: { padding: 20 },
    questionText: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
    optionsContainer: { gap: 12 },
    optionButton: { padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0' },
    selectedOption: { backgroundColor: '#e8f5e9', borderColor: '#4CAF50' },
    optionText: { fontSize: 16 },
    summaryContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    summaryTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
    summaryScore: { fontSize: 22, color: '#FFD700', marginVertical: 20 },
    retryButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
    retryButtonText: { color: '#1a4c2e', fontWeight: 'bold' }
});

export default LessonDetailScreen;
