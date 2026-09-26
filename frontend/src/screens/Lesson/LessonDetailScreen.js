import SafeAreaContainer from '../../components/SafeAreaContainer';
import React, { useState, useEffect, useRef, useContext } from 'react';
import { ThemeContext, lightTheme } from '../../context/ThemeContext';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Animated, Dimensions, Platform, StatusBar, Alert, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from '../../utils/haptics';
import { lessonAPI, progressAPI } from '../../services/api';
import { LanguageContext } from '../../context/LanguageContext';
import { HealthContext } from '../../context/HealthContext';
import { useExerciseEngine } from '../../context/ExerciseEngineContext';
import KeyboardAvoidingWrapper from '../../components/KeyboardAvoidingWrapper';
import MultipleChoice from '../../components/exercises/MultipleChoice';
import Translation from '../../components/exercises/Translation';
import FillBlank from '../../components/exercises/FillBlank';
import Matching from '../../components/exercises/Matching';
import Reorder from '../../components/exercises/Reorder';


const { width } = Dimensions.get('window');

const LessonDetailScreen = ({ route, navigation }) => {
  const { lessonId } = route.params;
  const { health, deduct } = React.useContext(HealthContext);
  const { loadExercise } = useExerciseEngine();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeSpent, setTimeSpent] = useState(0);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const userAnswersRef = useRef({});
  const [selectedOption, setSelectedOption] = useState(null);
  const [translationInput, setTranslationInput] = useState('');
  const [fillBlankAnswer, setFillBlankAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [isLearningMode, setIsLearningMode] = useState(true);
  const { activeLanguage } = useContext(LanguageContext);

   const contextValue = useContext(ThemeContext) || {};
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
    if (lesson && lesson.exercises && lesson.exercises[currentExerciseIndex]) {
      loadExercise(lesson.exercises[currentExerciseIndex]);
    }
  }, [lesson, currentExerciseIndex]);


  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeSpent(0);
    timerRef.current = setInterval(() => setTimeSpent(t => t + 1), 1000);
  };

  const fetchLesson = async () => {
    try {
      setLoading(true);
      const response = await lessonAPI.getById(lessonId);
      if (response && response.data) {
        setLesson(response.data.data || response.data);
        
        // Trigger entrance animations once lesson loads
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          })
        ]).start();
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Failed to load lesson:', error);
      Alert.alert('Error', 'Failed to load lesson. Please check your connection or try again later.');
      // Do not navigate back automatically, allow user to retry or see the error
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
  const currentAnswers = userAnswersRef.current; 
  
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

  const payload = {
    score: calculatedScore,
    timeSpent: timeSpent,
    responses: answersArray,
    startedAt: new Date(Date.now() - timeSpent * 1000).toISOString(),
    completedAt: new Date().toISOString(),
  };

  try {
    const response = await lessonAPI.complete(lessonId, payload);
    const resultData = response.data.data;
    
    // Navigate to Result Screen
    navigation.navigate('Result', {
        score: calculatedScore,
        rewards: resultData.rewards,
        statistics: resultData.statistics,
        feedback: resultData.feedback
    });
    
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    console.error('Lesson completion failed:', errorMsg);
    
    Alert.alert(
      'Progress Not Saved', 
      `Your score was ${calculatedScore}%, but we couldn't sync it. ${errorMsg}`,
      [{ text: 'OK', onPress: () => navigation.navigate('Lessons') }]
    );
  }
};

  
// Example for Multiple Choice (Apply similar logic to others)
const handleMultipleChoice = (optionId) => {
  if (health <= 0) {
    Alert.alert('Out of Hearts! ❤️', 'You are out of hearts. Practice to regain them or wait for regeneration.', [
        { text: 'Go to Practice', onPress: () => navigation.navigate('Practice') },
    ]);
    return;
  }
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
    deduct();
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
      <KeyboardAvoidingWrapper style={styles.content}>
        <Animated.View style={[styles.exerciseWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          {content?.vocabulary?.length > 0 && (
            <View style={[styles.contentCard, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}><MaterialIcons name="list" size={20} color="#4CAF50" /><Text style={styles.cardTitle}>Vocabulary</Text></View>
              {content.vocabulary.map((vocab, i) => {
                const word = vocab.wordId;
                if (!word) return null;
                return (
                  <View key={i} style={styles.exampleRow}>
                    <Text style={styles.izonText}>{word.izonWord}</Text>
                    <Text style={[styles.englishText, { color: theme.subText }]}>{word.englishTranslation}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {content?.grammar?.length > 0 && content.grammar.map((item, i) => (
            <View key={i} style={[styles.contentCard, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}><Ionicons name="book" size={20} color="#4CAF50" /><Text style={styles.cardTitle}>{item?.title?.english || item?.title || ''}</Text></View>
              <Text style={styles.cardText}>{item?.explanation?.english || item?.explanation || ''}</Text>
            </View>
          ))}

          {content?.examples?.length > 0 && (
            <View style={[styles.contentCard, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}><MaterialIcons name="translate" size={20} color="#2196F3" /><Text style={styles.cardTitle}>Sentence Examples</Text></View>
              {content.examples.map((ex, i) => (
                <View key={i} style={styles.exampleRow}><Text style={styles.izonText}>{ex?.izon || ''}</Text><Text style={[styles.englishText, { color: theme.subText }]}>{ex?.english || ''}</Text></View>
              ))}
            </View>
          )}

          {content?.culturalNotes?.length > 0 && content.culturalNotes.map((note, i) => (
            <View key={i} style={[styles.contentCard, styles.cultureCard, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}><FontAwesome5 name="landmark" size={18} color="#FF9800" /><Text style={styles.cardTitle}>{note?.title?.english || note?.title || ''}</Text></View>
              <Text style={styles.cultureText}>{note?.content?.english || note?.content || ''}</Text>
            </View>
          ))}

          {(!content?.vocabulary?.length && !content?.grammar?.length && !content?.examples?.length && !content?.culturalNotes?.length) && (
              <View style={[styles.contentCard, { backgroundColor: theme.card }]}>
                  <Text style={styles.cardText}>No specific learning content available for this lesson.</Text>
              </View>
          )}

          <TouchableOpacity style={styles.startQuizButton} onPress={() => setIsLearningMode(false)}>
            <Text style={styles.startQuizText}>Ready to Practice? Start Quiz</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingWrapper>
    );
  };
  const getCorrectAnswerString = (correctAnswer) => {
    if (!correctAnswer) return '';
    if (typeof correctAnswer === 'string') return correctAnswer;
    if (typeof correctAnswer === 'object') {
      const val = correctAnswer.english || correctAnswer.izon || Object.values(correctAnswer)[0];
      return typeof val === 'string' ? val : (val != null ? String(val) : '');
    }
    return String(correctAnswer);
  };

  const handleTranslationInternal = (input) => {
    const exercise = lesson.exercises[currentExerciseIndex];
    const correctStr = getCorrectAnswerString(exercise.correctAnswer);
    
    // Normalize and clean answers to handle white space and punctuation differences
    const cleanInput = String(input || '').trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
    const cleanCorrect = String(correctStr || '')
      .trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
    
    const isCorrect = cleanInput === cleanCorrect;

    setUserAnswers(prev => ({
      ...prev,
      [currentExerciseIndex]: { answer: input, correct: isCorrect },
    }));

    if (isCorrect) {
      haptics.notificationSuccess();
      Alert.alert('Correct! 🎉', 'Well done!', [{ text: 'Continue', onPress: nextExercise }]);
    } else {
      haptics.notificationError();
      Alert.alert('Incorrect ❌', `Correct: ${correctStr}`, [{ text: 'Continue', onPress: nextExercise }]);
    }
  };

  const renderExercise = () => {
    const exercise = lesson?.exercises?.[currentExerciseIndex];
    if (!exercise) return null;

    switch (exercise.type) {
      case 'multiple-choice':
        return (
          <MultipleChoice
            exercise={exercise}
            onSelect={handleMultipleChoice}
            selectedOption={selectedOption}
            disabled={!!selectedOption}
          />
        );

      case 'translation':
        return (
          <Translation
            exercise={exercise}
            onSubmit={handleTranslationInternal}
            disabled={false}
          />
        );

      case 'fill-blank':
        return (
          <FillBlank
            exercise={exercise}
            onSubmit={handleFillBlankInternal}
            disabled={false}
          />
        );

      case 'matching':
        return (
          <Matching
            exercise={exercise}
            onSubmit={handleMatchingInternal}
            disabled={false}
          />
        );

      case 'reorder':
        return (
          <Reorder
            exercise={exercise}
            onSubmit={handleReorderInternal}
            disabled={false}
          />
        );

      default:
        return <Text style={styles.cardText}>Unsupported exercise type: {exercise.type}</Text>;
    }
  };

  const handleReorderInternal = (orderedWords) => {
    const exercise = lesson.exercises[currentExerciseIndex];
    const isCorrect = JSON.stringify(orderedWords) === JSON.stringify(exercise.correctOrder);

    setUserAnswers(prev => ({
      ...prev,
      [currentExerciseIndex]: { answer: orderedWords, correct: isCorrect },
    }));

    if (isCorrect) {
      haptics.notificationSuccess();
      Alert.alert('Correct! 🎉', 'Perfect order!', [{ text: 'Continue', onPress: nextExercise }]);
    } else {
      haptics.notificationError();
      Alert.alert('Incorrect ❌', `Correct order: ${exercise.correctOrder.join(' ')}`, [{ text: 'Continue', onPress: nextExercise }]);
    }
  };

  const handleMatchingInternal = (matches) => {
    const exercise = lesson.exercises[currentExerciseIndex];
    let correctCount = 0;
    exercise.matchingPairs.forEach(pair => {
        if (matches[pair.left.id] === pair.right.id) correctCount++;
    });
    const isCorrect = correctCount === exercise.matchingPairs.length;

    setUserAnswers(prev => ({
      ...prev,
      [currentExerciseIndex]: { answer: matches, correct: isCorrect },
    }));

    if (isCorrect) {
      haptics.notificationSuccess();
      Alert.alert('Correct! 🎉', 'Perfect match!', [{ text: 'Continue', onPress: nextExercise }]);
    } else {
      haptics.notificationError();
      Alert.alert('Incorrect ❌', 'Some pairs were not matched correctly.', [{ text: 'Continue', onPress: nextExercise }]);
    }
  };

  const handleFillBlankInternal = (input) => {
    setFillBlankAnswer(input);
    const exercise = lesson.exercises[currentExerciseIndex];
    const correctStr = getCorrectAnswerString(exercise.correctAnswer);
    const isCorrect = String(input || '').trim().toLowerCase() === String(correctStr || '').trim().toLowerCase();

    setUserAnswers(prev => ({
      ...prev,
      [currentExerciseIndex]: { answer: input.trim(), correct: isCorrect },
    }));

    if (isCorrect) {
      haptics.notificationSuccess();
      Alert.alert('Correct! 🎉', 'Well done!', [{ text: 'Continue', onPress: nextExercise }]);
    } else {
      haptics.notificationError();
      Alert.alert('Incorrect ❌', `Correct: ${correctStr}`, [{ text: 'Continue', onPress: nextExercise }]);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#4CAF50" /></View>;

  if (!lesson) {
    return (
      <View style={styles.loadingContainer}>
        <Text>No lesson content is available yet.</Text>
        <TouchableOpacity onPress={fetchLesson} style={{ marginTop: 20, padding: 10, backgroundColor: '#4CAF50', borderRadius: 5 }}>
          <Text style={{ color: '#fff' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={getLevelColor()} style={styles.header}>
        <Text style={styles.headerTitle}>{isLearningMode ? "Learn" : "Quiz"}: {lesson?.title?.english || lesson?.title || ''}</Text>
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
