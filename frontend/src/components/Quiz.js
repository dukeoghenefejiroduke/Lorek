import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
  Dimensions 
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import ProgressBar from './ProgressBar';
import { useExerciseEngine } from '../context/ExerciseEngineContext';

const { width } = Dimensions.get('window');

export default function Quiz({ 
  totalQuestions,
  timeLimit = null,
  onQuizComplete
}) {
  const { currentExercise, evaluation, evaluateAnswer } = useExerciseEngine();
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    if (timeLimit && !answered && currentExercise) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAnswer(null, true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentExercise, answered]);

  if (!currentExercise) return null;

  const handleAnswer = (answer, timeout = false) => {
    if (answered) return;
    if (!timeout && !answer) return;

    setSelectedAnswer(answer);
    setAnswered(true);

    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.1, duration: 150, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      evaluateAnswer(answer === currentExercise.correctAnswer, answer === currentExercise.correctAnswer ? 'Correct!' : `Incorrect. Correct: ${currentExercise.correctAnswer}`);
      
      // Notify parent/context if needed
      setSelectedAnswer(null);
      setAnswered(false);
      setTimeLeft(timeLimit);
      
      if (onQuizComplete) onQuizComplete();
    }, 1000);
  };

  const getButtonStyle = (option) => {
    if (!answered) return [styles.optionButton];
    return [
      styles.optionButton,
      option === currentExercise.correctAnswer ? styles.correctButton : 
      (option === selectedAnswer && option !== currentExercise.correctAnswer ? styles.wrongButton : {})
    ];
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.questionNumber}>Exercise</Text>
      </View>

      <Animated.View style={[styles.questionContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.question}>{currentExercise.question}</Text>
      </Animated.View>

      <View style={styles.optionsContainer}>
        {currentExercise.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={getButtonStyle(option)}
            onPress={() => handleAnswer(option)}
            disabled={answered}
          >
            <Text style={styles.optionText}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {evaluation && (
        <View style={styles.feedback}>
          <Text style={styles.feedbackText}>{evaluation.feedback}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Keep existing styles or minimal necessary updates
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  questionNumber: { fontSize: 14, fontWeight: '600', color: '#666' },
  questionContainer: { backgroundColor: '#fff', padding: 30, borderRadius: 20, marginVertical: 30, elevation: 4 },
  question: { fontSize: 22, fontWeight: '600', textAlign: 'center', color: '#333' },
  optionsContainer: { gap: 12 },
  optionButton: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 2, borderColor: '#e0e0e0', padding: 16 },
  correctButton: { backgroundColor: '#C8E6C9', borderColor: '#4CAF50' },
  wrongButton: { backgroundColor: '#FFCDD2', borderColor: '#f44336' },
  optionText: { fontSize: 16, color: '#333', textAlign: 'center' },
  feedback: { marginTop: 20, padding: 15, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center' },
  feedbackText: { fontSize: 14, color: '#666', textAlign: 'center' },
});
