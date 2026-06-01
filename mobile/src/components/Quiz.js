// components/Quiz.js
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

const { width } = Dimensions.get('window');

export default function Quiz({ 
  question, 
  questionNumber, 
  totalQuestions, 
  onAnswer, 
  score,
  timeLimit = null 
}) {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const shakeAnim = useState(new Animated.Value(0))[0];
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    if (timeLimit && !answered) {
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
  }, [questionNumber]);

  const handleAnswer = (answer, timeout = false) => {
    if (answered) return;

    if (!timeout && !answer) return;

    setSelectedAnswer(answer);
    setAnswered(true);

    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      onAnswer(answer, timeout);
      setSelectedAnswer(null);
      setAnswered(false);
      setTimeLeft(timeLimit);
    }, 1000);
  };

  const getButtonStyle = (option) => {
    const isCorrect = option === question.correctAnswer;
    
    if (!answered) return [styles.optionButton];
    
    if (isCorrect) {
      return [styles.optionButton, styles.correctButton];
    }
    
    if (option === selectedAnswer && !isCorrect) {
      return [styles.optionButton, styles.wrongButton];
    }
    
    return [styles.optionButton];
  };

  const getButtonTextStyle = (option) => {
    const isCorrect = option === question.correctAnswer;
    
    if (!answered) return styles.optionText;
    
    if (isCorrect) {
      return [styles.optionText, styles.correctText];
    }
    
    if (option === selectedAnswer && !isCorrect) {
      return [styles.optionText, styles.wrongText];
    }
    
    return styles.optionText;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.progressInfo}>
          <Text style={styles.questionNumber}>
            Question {questionNumber} of {totalQuestions}
          </Text>
          {timeLimit && (
            <View style={[styles.timer, timeLeft < 10 && styles.timerWarning]}>
              <Icon name="timer" size={16} color={timeLeft < 10 ? '#f44336' : '#666'} />
              <Text style={[styles.timerText, timeLeft < 10 && styles.timerTextWarning]}>
                {timeLeft}s
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.score}>Score: {score}</Text>
      </View>

      <ProgressBar 
        progress={(questionNumber / totalQuestions) * 100} 
        height={6}
        color="#1a73e8"
      />

      <Animated.View style={[
        styles.questionContainer,
        { transform: [{ scale: pulseAnim }] }
      ]}>
        <Text style={styles.question}>{question.question}</Text>
      </Animated.View>

      <View style={styles.optionsContainer}>
        {question.options.map((option, index) => (
          <Animated.View
            key={index}
            style={{
              transform: [{
                translateX: selectedAnswer === option && !answered ? shakeAnim : 0
              }]
            }}
          >
            <TouchableOpacity
              style={getButtonStyle(option)}
              onPress={() => handleAnswer(option)}
              disabled={answered}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <View style={styles.optionLetter}>
                  <Text style={styles.optionLetterText}>
                    {String.fromCharCode(65 + index)}
                  </Text>
                </View>
                <Text style={getButtonTextStyle(option)}>{option}</Text>
                {answered && option === question.correctAnswer && (
                  <Icon name="check-circle" size={22} color="#4CAF50" />
                )}
                {answered && option === selectedAnswer && option !== question.correctAnswer && (
                  <Icon name="cancel" size={22} color="#f44336" />
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {answered && (
        <View style={styles.feedback}>
          <Text style={styles.feedbackText}>
            {selectedAnswer === question.correctAnswer 
              ? '✅ Correct! Well done!' 
              : `❌ Incorrect. The correct answer is: ${question.correctAnswer}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  progressInfo: {
    flex: 1,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  timerWarning: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 12,
    color: '#666',
  },
  timerTextWarning: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  score: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  questionContainer: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    marginVertical: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  question: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    color: '#333',
    lineHeight: 30,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  correctButton: {
    backgroundColor: '#C8E6C9',
    borderColor: '#4CAF50',
  },
  wrongButton: {
    backgroundColor: '#FFCDD2',
    borderColor: '#f44336',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  optionLetter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  correctText: {
    color: '#2E7D32',
  },
  wrongText: {
    color: '#C62828',
  },
  feedback: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
  },
  feedbackText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
