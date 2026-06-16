import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Dimensions,
  Platform,
  TextInput,
  ActivityIndicator,
  Animated,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { BlurView } from 'expo-blur';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';

import { gamesAPI } from '../services/api';

const { width } = Dimensions.get('window');

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

const GAMES = [
  {
    id: 'match',
    title: 'Match the Words',
    description: 'Match Izon words with their English translations',
    icon: '🎯',
    color: '#4CAF50',
    difficulty: 'Easy',
    players: 'Single Player',
    time: '5 min',
  },
  {
    id: 'spelling',
    title: 'Spelling Bee',
    description: 'Spell Izon words correctly',
    icon: '🐝',
    color: '#2196F3',
    difficulty: 'Medium',
    players: 'Single Player',
    time: '10 min',
  },
  {
    id: 'quiz',
    title: 'Quick Quiz',
    description: 'Test your knowledge with timed questions',
    icon: '⚡',
    color: '#FF9800',
    difficulty: 'Hard',
    players: 'Single Player',
    time: '15 min',
  },
  {
    id: 'word_search',
    title: 'Word Search',
    description: 'Find hidden Izon words',
    icon: '🔍',
    color: '#9C27B0',
    difficulty: 'Medium',
    players: 'Single Player',
    time: '10 min',
    disabled: true, // Mark as disabled
  },
  {
    id: 'flashcards',
    title: 'Flashcards',
    description: 'Quick flashcard review session',
    icon: '🃏',
    color: '#E91E63',
    difficulty: 'Easy',
    players: 'Single Player',
    time: '5 min',
  },
  {
    id: 'hangman',
    title: 'Hangman',
    description: 'Guess the Izon word before it\'s too late',
    icon: '🔤',
    color: '#00BCD4',
    difficulty: 'Medium',
    players: 'Single Player',
    time: '10 min',
  },
];

// ============================================================================
// WORD SEARCH GAME COMPONENT
// ============================================================================

const WordSearchGame = ({ questions, onComplete, onClose, theme, isDarkMode }) => {
  return (
    <View style={[styles.gameModalContent, { backgroundColor: theme.card }]}>
      <Text style={{ fontSize: 20, textAlign: 'center', margin: 40, color: theme.text }}>
        Word Search Game{"\n\n"}(Coming Soon — Grid implementation)
      </Text>
      <TouchableOpacity style={[styles.spellingButton, { backgroundColor: theme.primary }]} onPress={onClose}>
        <Text style={styles.spellingButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// MATCH GAME COMPONENT
// ============================================================================

const MatchGame = ({ sessionId, questions, onComplete, onClose, maxScore, theme, isDarkMode }) => {
  const [gameWords, setGameWords] = useState([]);
  const [selectedPair, setSelectedPair] = useState(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [startTime] = useState(Date.now());

// ... rest of useEffect ...

useEffect(() => {
  const pairs = [];
  questions.forEach(q => {
    const id = q.questionId || q.id;
    // Map 'native' to whatever the target language word is
    const native = q.native || q.izon || q.izonWord || q.questionData?.native || q.questionData?.izon;
    const english = q.english || q.englishTranslation || q.questionData?.english;

    if (native && id) {
      pairs.push({ id, text: native, type: 'native', matched: false });
      pairs.push({ id, text: english, type: 'english', matched: false });
    }
  });
  setGameWords(pairs.sort(() => Math.random() - 0.5));
}, [questions]);

// ... rest of methods ...

  const handleWordSelect = (word) => {
    if (word.matched) return;

    if (!selectedPair) {
      setSelectedPair(word);
      haptics.impactLight();
    } else if (selectedPair.id === word.id && selectedPair.type !== word.type) {
      // Match found
      const updatedWords = gameWords.map(w =>
        w.id === word.id || w.id === selectedPair.id ? { ...w, matched: true } : w
      );
      setGameWords(updatedWords);
      const newScore = score + 10;
      setScore(newScore);
      setAnswers([...answers, { questionId: word.id, answer: word.text, isCorrect: true }]);
      setSelectedPair(null);
      haptics.notificationSuccess();
    } else {
      setSelectedPair(null);
      haptics.notificationError();
    }
  };

  const hasSubmitted = useRef(false);

const handleComplete = async () => {
  if (hasSubmitted.current) return;
  hasSubmitted.current = true;
  const timeSpent = Math.floor((Date.now() - startTime) / 1000);
  await onComplete(answers, score, timeSpent);
};


  useEffect(() => {
    const allMatched = gameWords.length > 0 && gameWords.every(w => w.matched);
    if (allMatched && gameWords.length > 0) {
      handleComplete();
    }
  }, [gameWords]);

// Inside MatchGame return
return (
  <View style={{ flex: 1, backgroundColor: theme.card }}>
    <LinearGradient colors={theme.headerGradient} style={styles.gameModalHeader}>
       <Text style={styles.gameModalTitle}>Match the Words</Text>
       <TouchableOpacity onPress={onClose}>
         <Ionicons name="close" size={28} color="#fff" />
       </TouchableOpacity>
    </LinearGradient>

    <ScrollView 
      contentContainerStyle={{ padding: 15, paddingBottom: 30 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.gameScore, { backgroundColor: isDarkMode ? '#252525' : '#f5f5f5' }]}>
        <Text style={[styles.gameScoreText, { color: theme.primary }]}>Score: {score}/{maxScore}</Text>
      </View>

      <View style={styles.matchGrid}>
        {gameWords.map((word, index) => (
          <TouchableOpacity
            key={`${word.id}-${word.type}-${index}`}
            style={[
              styles.matchCard,
              { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5', borderColor: isDarkMode ? '#333' : '#e0e0e0' },
              (selectedPair?.id === word.id && selectedPair?.type === word.type) && styles.matchCardSelected,
              word.matched && styles.matchCardMatched,
            ]}
            onPress={() => handleWordSelect(word)}
            disabled={word.matched}
          >
            <Text style={[styles.matchCardText, { color: theme.text }]}>{word.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  </View>
);
};

// ============================================================================
// SPELLING GAME COMPONENT
// ============================================================================

const SpellingGame = ({ questions, onComplete, onClose, maxScore, theme, isDarkMode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userSpelling, setUserSpelling] = useState('');
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [startTime] = useState(Date.now());

  const currentWord = questions[currentIndex];

  if (!currentWord) return <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 50 }} />;

// ... rest of methods ...

  // Matching your data structure fallback
  const targetSpelling = currentWord.izonWord || currentWord.izon || currentWord.questionData?.izon || "";
  const promptEnglish = currentWord.englishTranslation || currentWord.english || currentWord.questionData?.english || "";

  const checkSpelling = () => {
    if (!userSpelling.trim()) return;

    const isCorrect = userSpelling.toLowerCase().trim() === targetSpelling.toLowerCase().trim();

    const currentAnswer = { 
      questionId: currentWord.questionId || currentWord.id, 
      answer: userSpelling, 
      isCorrect: isCorrect 
    };

    if (isCorrect) {
      const newScore = score + 10;
      setScore(newScore);
      setFeedback('Correct! +10 points');
      haptics.notificationSuccess();

      const updatedAnswers = [...answers, currentAnswer];
      setAnswers(updatedAnswers);

      setTimeout(() => {
        if (currentIndex + 1 < questions.length) {
          setCurrentIndex(currentIndex + 1);
          setUserSpelling('');
          setFeedback('');
        } else {
          const timeSpent = Math.floor((Date.now() - startTime) / 1000);
          onComplete(updatedAnswers, newScore, timeSpent);
        }
      }, 600);
    } else {
      setFeedback(`Incorrect. Try again!`);
      haptics.notificationError();
    }
  };

  return (
    <View style={[styles.gameModalContent, { backgroundColor: theme.card }]}>
      <LinearGradient colors={theme.headerGradient} style={styles.gameModalHeader}>
        <Text style={styles.gameModalTitle}>Spelling Bee</Text>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
      </LinearGradient>

      <View style={[styles.gameScore, { backgroundColor: isDarkMode ? '#252525' : '#f5f5f5' }]}>
        <Text style={[styles.gameScoreText, { color: theme.primary }]}>Score: {score}/{maxScore}</Text>
        <Text style={[styles.gameProgress, { color: theme.subText }]}>Word {currentIndex + 1}/{questions.length}</Text>
      </View>

      <View style={styles.spellingContainer}>
        <Text style={[styles.spellingPrompt, { color: theme.text }]}>Spell "{promptEnglish}" in Izon:</Text>
        <TextInput
          style={[styles.spellingInput, { backgroundColor: isDarkMode ? '#1a1a1a' : '#fafafa', color: theme.text, borderColor: theme.border }]}
          value={userSpelling}
          onChangeText={setUserSpelling}
          placeholder="Type here..."
          placeholderTextColor={isDarkMode ? '#555' : '#999'}
          autoCapitalize="none"
        />
        <TouchableOpacity style={[styles.spellingButton, { backgroundColor: theme.primary }]} onPress={checkSpelling}>
          <Text style={styles.spellingButtonText}>Check Spelling</Text>
        </TouchableOpacity>
        {feedback ? <Text style={[styles.spellingFeedback, feedback.includes('Correct') ? styles.successText : styles.errorText]}>{feedback}</Text> : null}
      </View>
    </View>
  );
};
// ============================================================================
// QUIZ GAME COMPONENT
// ============================================================================

const QuizGame = ({ questions, onComplete, onClose, maxScore, theme, isDarkMode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [startTime] = useState(Date.now());

  const currentQuestion = questions[currentIndex];

  // SAFE EXTRACTION - These variables must be used in the JSX below
  const data = currentQuestion?.questionData || {};
  const options = data.options || [];
  const correctAnswer = data.correctAnswer;
  const questionText = data.question || "Question missing";

  const handleAnswer = (selectedIndex) => {   
    const isCorrect = options[selectedIndex] === correctAnswer;
    setSelectedOption(selectedIndex);

    const currentAnswer = { 
      questionId: currentQuestion.questionId || currentQuestion.id, 
      answer: options[selectedIndex], // Sending the string, not the index
      isCorrect: isCorrect 
    };

    const updatedAnswers = [...answers, currentAnswer];
    const newScore = isCorrect ? score + 10 : score;

    if (isCorrect) {
      setScore(newScore);
      haptics.notificationSuccess();
    } else {
      haptics.notificationError();
    }

    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(currentIndex + 1);
        setSelectedOption(null);
        setAnswers(updatedAnswers);
      } else {
        const timeSpent = Math.floor((Date.now() - startTime) / 1000);
        onComplete(updatedAnswers, newScore, timeSpent);
      }
    }, 800);
  };

  return (
    <View style={[styles.gameModalContent, { backgroundColor: theme.card }]}>
      <LinearGradient colors={theme.headerGradient} style={styles.gameModalHeader}>
        <Text style={styles.gameModalTitle}>Quick Quiz</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={[styles.gameScore, { backgroundColor: isDarkMode ? '#252525' : '#f5f5f5' }]}>
        <Text style={[styles.gameScoreText, { color: theme.primary }]}>Score: {score}/{maxScore}</Text>
        <Text style={[styles.gameProgress, { color: theme.subText }]}>
          Question {currentIndex + 1}/{questions.length}
        </Text>
      </View>

      <View style={styles.quizContainer}>
        {/* FIXED: Use questionText instead of currentQuestion.question */}
        <Text style={[styles.quizQuestion, { color: theme.text }]}>{questionText}</Text>

        {/* FIXED: Use options instead of currentQuestion.options */}
        {options.map((option, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.quizOption,
              { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5', borderColor: isDarkMode ? '#333' : '#e0e0e0' },
              selectedOption === idx && styles.quizOptionSelected,
            ]}
            onPress={() => handleAnswer(idx)}
            disabled={selectedOption !== null}
          >
            <Text style={[
              styles.quizOptionText,
              { color: theme.text },
              selectedOption === idx && styles.quizOptionTextSelected,
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
// ============================================================================
// FLASHCARDS GAME COMPONENT
// ============================================================================

const FlashcardsGame = ({ questions, onComplete, onClose, maxScore, theme, isDarkMode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [startTime] = useState(Date.now());
  const hasSubmitted = useRef(false);

  const currentCard = questions[currentIndex];
  const izon = currentCard.izonWord || currentCard.izon || currentCard.questionData?.izon;
  const english = currentCard.englishTranslation || currentCard.english || currentCard.questionData?.english;

  const handleProgress = (known) => {
    const newScore = known ? score + 10 : score;
    const currentAnswer = { 
      questionId: currentCard.id || currentCard.questionId, 
      answer: known ? 'known' : 'unknown', 
      isCorrect: known 
    };
    const updatedAnswers = [...answers, currentAnswer];

    if (currentIndex + 1 < questions.length) {
      setScore(newScore);
      setAnswers(updatedAnswers);
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
      haptics.impactMedium();
    } else {
      if (hasSubmitted.current) return;
      hasSubmitted.current = true;
      onComplete(updatedAnswers, newScore, Math.floor((Date.now() - startTime) / 1000));
    }
  };

  return (
    <View style={[styles.gameModalContent, { backgroundColor: theme.card }]}>
      <LinearGradient colors={theme.headerGradient} style={styles.gameModalHeader}>
        <Text style={styles.gameModalTitle}>Flashcards</Text>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
      </LinearGradient>

      <View style={[styles.gameScore, { backgroundColor: isDarkMode ? '#252525' : '#f5f5f5' }]}>
        <Text style={[styles.gameScoreText, { color: theme.primary }]}>Progress: {currentIndex + 1}/{questions.length}</Text>
      </View>

      <View style={styles.flashcardContainer}>
        <TouchableOpacity style={[styles.flashcard, { backgroundColor: theme.card }]} onPress={() => setIsFlipped(!isFlipped)}>
          <LinearGradient colors={isFlipped ? ['#4CAF50', '#2E7D32'] : (isDarkMode ? ['#252525', '#1a1a1a'] : ['#fff', '#f9f9f9'])} style={styles.flashcardGradient}>
            <Text style={[styles.flashcardText, { color: theme.text }, isFlipped && {color: '#fff'}]}>{isFlipped ? english : izon}</Text>
            <Text style={[styles.flashcardHint, { color: theme.subText }]}>Tap to flip</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.flashcardActions}>
          <TouchableOpacity style={[styles.flashcardButton, styles.dontKnowButton]} onPress={() => handleProgress(false)}>
            <Text style={styles.flashcardButtonText}>Review Later</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.flashcardButton, styles.knowButton]} onPress={() => handleProgress(true)}>
            <Text style={styles.flashcardButtonText}>I Know This</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
// ============================================================================
// HANGMAN GAME COMPONENT
// ============================================================================

const HangmanGame = ({ questions, onComplete, onClose, maxScore, theme, isDarkMode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [guessedLetters, setGuessedLetters] = useState([]);
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [startTime] = useState(Date.now());
  const maxWrong = 6;
  const [isLocked, setIsLocked] = useState(false);

  const currentWord = questions[currentIndex];
  const izonWord = (currentWord?.izonWord || currentWord?.izon || currentWord?.questionData?.izon || "").toLowerCase();
  const englishHint = currentWord?.englishTranslation || currentWord?.english || currentWord?.questionData?.english || "";

  const displayWord = izonWord.split('').map(l => (guessedLetters.includes(l) || l === ' ' ? l : '_')).join(' ');

  const handleGuess = (letter) => {
    if (isLocked || guessedLetters.includes(letter) || wrongGuesses >= maxWrong) return;
    const newGuesses = [...guessedLetters, letter];
    setGuessedLetters(newGuesses);

    if (!izonWord.includes(letter)) {
      setWrongGuesses(prev => prev + 1);
      haptics.notificationError();
    } else {
      haptics.impactLight();
    }
  };

  useEffect(() => {
    const isWon = izonWord.split('').every(l => guessedLetters.includes(l) || l === ' ');
    const isLost = wrongGuesses >= maxWrong;

    if (isWon || isLost) {
      
      setIsLocked(true);
      const isCorrect = isWon;
      const newScore = isWon ? score + 20 : score;
      const currentAnswer = { 
        questionId: currentWord.questionId || currentWord.id || currentWord._id, 
        answer: izonWord, 
        isCorrect 
      };

      const updatedAnswers = [...answers, currentAnswer];

      if (isWon) {
        setScore(newScore);
        haptics.notificationSuccess();
      }

      setTimeout(() => {
        if (currentIndex + 1 < questions.length) {
          setCurrentIndex(prev => prev + 1);
          setGuessedLetters([]);
          setWrongGuesses(0);
          setAnswers(updatedAnswers);
          setIsLocked(false);
        } else {
          onComplete(updatedAnswers, newScore, Math.floor((Date.now() - startTime) / 1000));
        }
      }, 1500);
    }
  }, [guessedLetters, wrongGuesses]);

  return (
    <View style={[styles.gameModalContent, { backgroundColor: theme.card }]}>
      <LinearGradient colors={theme.headerGradient} style={styles.gameModalHeader}>
        <Text style={styles.gameModalTitle}>Hangman</Text>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
      </LinearGradient>
      <View style={[styles.gameScore, { backgroundColor: isDarkMode ? '#252525' : '#f5f5f5' }]}>
        <Text style={[styles.gameScoreText, { color: theme.primary }]}>Score: {score}/{maxScore}</Text>
        <Text style={[styles.gameProgress, { color: theme.subText }]}>Lives: {maxWrong - wrongGuesses}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.hangmanScrollContainer}>
        <View style={[styles.hangmanDrawing, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f0f0f0' }]}>
           <Text style={{fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlign: 'center', color: theme.text}}>
             {wrongGuesses > 0 ? " O " : ""}{"\n"}
             {wrongGuesses > 1 ? "/" : ""}{wrongGuesses > 2 ? "|" : ""}{wrongGuesses > 3 ? "\\" : ""}{"\n"}
             {wrongGuesses > 4 ? "/" : ""} {wrongGuesses > 5 ? "\\" : ""}
           </Text>
        </View>
        <Text style={[styles.hangmanWord, { color: theme.text }]}>{displayWord}</Text>
        <Text style={[styles.hangmanHint, { color: theme.subText }]}>Hint: {englishHint}</Text>
        <View style={styles.keyboard}>
          {'aàáäbcdeèéëfghiìíïjklmnoòóöpqrstuùúüvwxyzɩ'.split('').map(l => (
            <TouchableOpacity 
              key={l} 
              onPress={() => handleGuess(l)}
              disabled={guessedLetters.includes(l)}
              style={[
                styles.keyButton, 
                { backgroundColor: isDarkMode ? '#252525' : '#e0e0e0' },
                guessedLetters.includes(l) && styles.keyButtonDisabled
              ]}
            >
              <Text style={[styles.keyButtonText, { color: theme.text }]}>{l.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// ============================================================================
// MAIN GAMES SCREEN
// ============================================================================

export default function GamesScreen({ navigation }) {
  const [selectedGame, setSelectedGame] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [gameSession, setGameSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedLeaderboardGame, setSelectedLeaderboardGame] = useState('quiz');
  const [refreshing, setRefreshing] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [gameResult, setGameResult] = useState(null);

  const { activeLanguage } = useContext(LanguageContext); // e.g., { code: 'izon', name: 'Izon' }
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in GamesScreen.js:', contextValue);
  const { isDarkMode, theme } = contextValue;
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    loadStats();
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const loadStats = async () => {
    try {
      const response = await gamesAPI.getStats();
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load game stats:', error);
    }
  };

const loadLeaderboard = async (gameType) => {
  try {
    const response = await gamesAPI.getLeaderboard(gameType, { limit: 10 });
    // If you're testing offline, ensure your mock or local API returns data here
    if (response.data.success) {
      setLeaderboard(response.data.data.leaderboard || []);
    }
  } catch (error) {
    console.error('Leaderboard error:', error);
    setLeaderboard([]); // Clear state on error to show "No scores yet"
  }
};

const onRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    await Promise.all([
      loadStats(),
      showLeaderboard ? loadLeaderboard(selectedLeaderboardGame) : Promise.resolve()
    ]);
  } catch (e) {
    console.error(e);
  } finally {
    setRefreshing(false);
  }
}, [showLeaderboard, selectedLeaderboardGame]);


const handleGamePress = async (gameId) => {
  setLoading(true);
  try {
    const response = await gamesAPI.startGame({
      gameType: gameId, // Make sure this is 'match', 'spelling', etc.
      difficulty: 'medium',
      lang: activeLanguage?.code,
      questionCount: getQuestionCountForGame(gameId),
    });
    
    if (response.data.success) {
      setGameSession(response.data.data);
      setSelectedGame(gameId); // This MUST match your switch cases
      setModalVisible(true);
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to start game');
  } finally {
    setLoading(false);
  }
};


  const getQuestionCountForGame = (gameId) => {
    const counts = {
      match: 4,
      spelling: 5,
      quiz: 5,
      word_search: 5,
      flashcards: 10,
      hangman: 3,
    };
    return counts[gameId] || 5;
  };

  const handleGameComplete = async (answers, score, timeSpent) => {
    try {
      
    // Ensure answers array contains objects with 'questionId' and 'answer'
    const formattedAnswers = answers.map(a => ({
      questionId: a.questionId,
      answer: a.answer
    }));

    const response = await gamesAPI.submitGame({
      sessionId: gameSession.sessionId,
      answers: formattedAnswers,
      timeSpent,
    });
      
      if (response.data.success) {
        setGameResult(response.data.data);
        setModalVisible(false);
        setResultModalVisible(true);
        await loadStats();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save game results');
    }
  };
  
// Update this function in GamesScreen
const handleLeaderboardPress = async (gameType) => {
  // If gameType isn't a string (e.g. called from header button), default to 'quiz'
  const type = typeof gameType === 'string' ? gameType : 'quiz'; 
  setSelectedLeaderboardGame(type);
  setShowLeaderboard(true);
  await loadLeaderboard(type);
  haptics.impactLight();
};

  const renderGameCard = (game) => (
    <Animated.View key={game.id} style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.gameCard, game.disabled && { opacity: 0.5 }]}
        onPress={() => !game.disabled && handleGamePress(game.id)}
        disabled={loading || game.disabled}
      >
        <LinearGradient
          colors={[game.color, game.color + 'CC']}
          style={styles.gameCardGradient}
        >
          <Text style={styles.gameIcon}>{game.icon}</Text>
          <Text style={styles.gameTitle}>{game.title}</Text>
          <Text style={styles.gameDescription}>{game.description}</Text>
          {game.disabled && <Text style={{ color: '#fff', fontSize: 10 }}>Coming Soon</Text>}
          <View style={styles.gameTags}>
            <View style={styles.gameTag}>
              <MaterialIcons name="star" size={12} color="#FFD700" />
              <Text style={styles.gameTagText}>{game.difficulty}</Text>
            </View>
            <View style={styles.gameTag}>
              <MaterialIcons name="person" size={12} color="#fff" />
              <Text style={styles.gameTagText}>{game.players}</Text>
            </View>
            <View style={styles.gameTag}>
              <MaterialIcons name="timer" size={12} color="#fff" />
              <Text style={styles.gameTagText}>{game.time}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.leaderboardIcon}
            onPress={(e) => {
              e.stopPropagation();
              handleLeaderboardPress(game.id);
            }}
          >
            <MaterialIcons name="leaderboard" size={16} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );


const renderGameComponent = () => {
  if (!gameSession?.questions?.length) {
    return (
      <View style={{ padding: 50, alignItems: 'center', backgroundColor: theme.card }}>
        <Text style={{ color: theme.text }}>No questions found in session!</Text>
      </View>
    );
  }

  const props = {
    questions: gameSession.questions,
    onComplete: handleGameComplete,
    onClose: () => setModalVisible(false),
    maxScore: gameSession.maxScore,
  };

  // DIAGNOSTIC WRAPPER: Wrap everything in a themed View
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, minHeight: 300 }}>
      {(() => {
        switch (selectedGame) {
          case 'match': return <MatchGame {...props} theme={theme} isDarkMode={isDarkMode} />;
          case 'spelling': return <SpellingGame {...props} theme={theme} isDarkMode={isDarkMode} />;
          case 'quiz': return <QuizGame {...props} theme={theme} isDarkMode={isDarkMode} />;
          case 'flashcards': return <FlashcardsGame {...props} theme={theme} isDarkMode={isDarkMode} />;
          case 'hangman': return <HangmanGame {...props} theme={theme} isDarkMode={isDarkMode} />;
          case 'word_search': return <WordSearchGame {...props} theme={theme} isDarkMode={isDarkMode} />;
          default: return <Text style={{ color: theme.text }}>Unknown Game: {selectedGame}</Text>;
        }
      })()}
    </View>
  );
};



  const StatCard = ({ title, value, icon, color }) => (
    <View style={[styles.statCard, { backgroundColor: theme.card }]}>
      <MaterialIcons name={icon} size={24} color={color} />
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.subText }]}>{title}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

      <LinearGradient
        colors={theme.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Learning Games</Text>
          <TouchableOpacity style={styles.statsButton} onPress={handleLeaderboardPress}>
            <MaterialIcons name="leaderboard" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>Learn Izon while having fun!</Text>
      </LinearGradient>

      {/* Stats Section */}
      {stats && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.statsScroll}
        >
          <StatCard title="Games Played" value={stats.overall?.totalGamesPlayed || 0} icon="sports-esports" color="#4CAF50" />
          <StatCard title="Win Rate" value={`${stats.overall?.winRate || 0}%`} icon="emoji-events" color="#FFD700" />
          <StatCard title="Total Score" value={stats.overall?.totalScore || 0} icon="stars" color="#FF9800" />
          <StatCard title="Best Game" value={stats.byGame?.quiz?.bestScore || 0} icon="school" color="#2196F3" />
        </ScrollView>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gamesGrid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />}
      >
        {GAMES.map(renderGameCard)}
      </ScrollView>

      {/* Game Modal */}
<Modal
  visible={modalVisible}
  transparent={true}
  animationType="slide"
>
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' }}>
    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
       {renderGameComponent()}
    </View>
  </View>
</Modal>


      {/* Result Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={resultModalVisible}
        onRequestClose={() => setResultModalVisible(false)}
      >
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? 'dark' : 'light'} style={styles.resultOverlay}>
          <View style={[styles.resultContent, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={gameResult?.passed ? ['#4CAF50', '#2E7D32'] : ['#FF9800', '#F57C00']}
              style={styles.resultGradient}
            >
              <Text style={styles.resultEmoji}>
                {gameResult?.passed ? '🎉' : '📚'}
              </Text>
              <Text style={styles.resultTitle}>
                {gameResult?.passed ? 'Great Job!' : 'Keep Practicing!'}
              </Text>
              <Text style={styles.resultScore}>
                Score: {gameResult?.score}/{gameResult?.maxScore}
              </Text>
              <Text style={styles.resultPercentage}>
                {Math.round(gameResult?.percentage)}%
              </Text>
              <View style={styles.resultStats}>
                <View style={styles.resultStat}>
                  <MaterialIcons name="stars" size={20} color="#FFD700" />
                  <Text style={styles.resultStatText}>+{gameResult?.pointsEarned} XP</Text>
                </View>
                <View style={styles.resultStat}>
                  <MaterialIcons name="whatshot" size={20} color="#FF6B6B" />
                  <Text style={styles.resultStatText}>+{gameResult?.expEarned} EXP</Text>
                </View>
              </View>
              {gameResult?.achievements?.length > 0 && (
                <View style={[styles.resultAchievements, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)' }]}>
                  <Text style={styles.resultAchievementTitle}>🏆 New Achievements</Text>
                  {gameResult.achievements.map((ach, idx) => (
                    <Text key={idx} style={styles.resultAchievementText}>• {ach.name}</Text>
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={[styles.resultButton, { backgroundColor: isDarkMode ? theme.card : '#fff' }]}
                onPress={() => setResultModalVisible(false)}
              >
                <Text style={[styles.resultButtonText, { color: gameResult?.passed ? '#4CAF50' : '#FF9800' }]}>Continue</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </BlurView>
      </Modal>

      {/* Leaderboard Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showLeaderboard}
        onRequestClose={() => setShowLeaderboard(false)}
      >
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient colors={theme.headerGradient} style={styles.gameModalHeader}>
              <Text style={styles.gameModalTitle}>
                {GAMES.find(g => g.id === selectedLeaderboardGame)?.title || 'Game'} Leaderboard
              </Text>
              <TouchableOpacity onPress={() => setShowLeaderboard(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.leaderboardList}>
              {leaderboard.length === 0 ? (
                <View style={styles.emptyLeaderboard}>
                  <MaterialIcons name="emoji-events" size={60} color={isDarkMode ? '#444' : '#ccc'} />
                  <Text style={[styles.emptyLeaderboardText, { color: theme.text }]}>No scores yet</Text>
                  <Text style={[styles.emptyLeaderboardSubtext, { color: theme.subText }]}>Play the game to appear here!</Text>
                </View>
              ) : (
                leaderboard.map((entry, index) => (
                  <View key={entry.userId} style={[styles.leaderboardEntry, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.leaderboardRank, { color: theme.subText }]}>#{index + 1}</Text>
                    <View style={styles.leaderboardUser}>
                      <View style={[styles.leaderboardAvatar, { backgroundColor: isDarkMode ? '#1a2e21' : '#4CAF50' }]}>
                        {entry.avatar ? (
                          <Image source={{ uri: entry.avatar }} style={styles.leaderboardAvatarImage} />
                        ) : (
                          <Text style={styles.leaderboardAvatarText}>
                            {entry.username?.charAt(0)?.toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.leaderboardUsername, { color: theme.text }]}>{entry.username}</Text>
                    </View>
                    <Text style={[styles.leaderboardScore, { color: theme.primary }]}>{entry.bestScore} pts</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Starting game...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  statsButton: { padding: 8 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 5 },
  statsScroll: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 15 },
  statCard: { backgroundColor: '#fff', borderRadius: 15, padding: 15, alignItems: 'center', marginRight: 12, minWidth: 100, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1a4c2e', marginTop: 8 },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4, textAlign: 'center' },
  content: { flex: 1, padding: 15 },
  gamesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 30 },
  gameCard: { width: (width - 45) / 2, marginBottom: 15, borderRadius: 15, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  gameCardGradient: { padding: 20, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  gameIcon: { fontSize: 48, marginBottom: 15 },
  gameTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' },
  gameDescription: { fontSize: 12, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 12 },
  gameTags: { flexDirection: 'row', gap: 8 },
  gameTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  gameTagText: { fontSize: 10, color: '#fff' },
  leaderboardIcon: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 15 },
modalOverlay: { 
  flex: 1, 
  backgroundColor: 'rgba(0,0,0,0.7)', 
  justifyContent: 'center', // Centers vertically
  alignItems: 'center',     // Centers horizontally
},
modalContent: { 
  backgroundColor: '#ffffff', 
  borderRadius: 25, 
  width: '92%', 
  height: '75%', // Reduced slightly to avoid bottom nav bars
  overflow: 'hidden',
  elevation: 10,
},
  gameModalContent: { flex: 1 },
  gameModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  gameModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  gameScore: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#f5f5f5' },
  gameScoreText: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },
  gameProgress: { fontSize: 14, color: '#666' },
matchGrid: { 
  flexDirection: 'row', 
  flexWrap: 'wrap', 
  justifyContent: 'space-between', // Changed for better alignment
  padding: 10,
},
matchCard: { 
  width: '47%', // Fits 2 per row with spacing
  aspectRatio: 1.5, // Keeps cards rectangular and uniform
  backgroundColor: '#f5f5f5', 
  borderRadius: 12, 
  justifyContent: 'center', 
  alignItems: 'center', 
  borderWidth: 2, 
  borderColor: '#e0e0e0',
  marginBottom: 15,
  padding: 10
},
matchCardText: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#333',
  textAlign: 'center'
},
  spellingContainer: { padding: 20, gap: 15 },
  spellingPrompt: { fontSize: 18, fontWeight: '500', color: '#333', textAlign: 'center' },
  spellingInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 15, fontSize: 16, backgroundColor: '#fafafa' },
  spellingButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center' },
  spellingButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  spellingFeedback: { fontSize: 14, textAlign: 'center' },
  successText: { color: '#4CAF50' },
  errorText: { color: '#f44336' },
  quizContainer: { padding: 20, gap: 15 },
  quizQuestion: { fontSize: 20, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 20 },
  quizOption: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  quizOptionSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  quizOptionText: { fontSize: 16, color: '#333', textAlign: 'center' },
  quizOptionTextSelected: { color: '#fff' },
  flashcardContainer: { padding: 30, alignItems: 'center' },
  flashcard: { width: width - 60, height: 200, borderRadius: 20, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  flashcardGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  flashcardText: { fontSize: 24, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  flashcardTextFlipped: { color: '#fff' },
  flashcardHint: { fontSize: 12, color: '#999', marginTop: 10, position: 'absolute', bottom: 15 },
  flashcardActions: { flexDirection: 'row', gap: 15, marginTop: 30 },
  flashcardButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25 },
  knowButton: { backgroundColor: '#4CAF50' },
  dontKnowButton: { backgroundColor: '#f44336' },
  flashcardButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    hangmanScrollContainer: { 
    padding: 20, 
    alignItems: 'center',
    paddingBottom: 40 // Important for bottom clearance
  },
  hangmanDrawing: { 
    width: 120, // Slightly smaller to save space
    height: 120, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 60
  },
  hangmanWord: { 
    fontSize: 24, // Reduced from 28
    fontWeight: 'bold', 
    letterSpacing: 6, 
    marginBottom: 5,
    textAlign: 'center'
  },
  keyboard: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'center', 
    gap: 6, // Slightly tighter gap
    marginTop: 15,
    width: '100%'
  },
  keyButton: { 
    width: 38, // Slightly smaller to fit more screens
    height: 38, 
    borderRadius: 8, // Changed from circle to rounded square to save width
    backgroundColor: '#e0e0e0', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 2
  },

  keyButtonDisabled: { backgroundColor: '#ccc', opacity: 0.5 },
  keyButtonText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#fff', fontSize: 16 },
  resultOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resultContent: { width: width - 40, borderRadius: 20, overflow: 'hidden' },
  resultGradient: { padding: 30, alignItems: 'center' },
  resultEmoji: { fontSize: 60, marginBottom: 15 },
  resultTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  resultScore: { fontSize: 16, color: '#fff', marginBottom: 5 },
  resultPercentage: { fontSize: 48, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  resultStats: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  resultStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resultStatText: { color: '#fff', fontSize: 14 },
  resultAchievements: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 15, borderRadius: 10, marginBottom: 20, width: '100%' },
  resultAchievementTitle: { color: '#fff', fontWeight: 'bold', marginBottom: 8 },
  resultAchievementText: { color: '#fff', fontSize: 12, marginBottom: 4 },
  resultButton: { backgroundColor: '#fff', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  resultButtonText: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold' },
  leaderboardList: { padding: 20 },
  leaderboardEntry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  leaderboardRank: { width: 50, fontSize: 16, fontWeight: 'bold', color: '#666' },
  leaderboardUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  leaderboardAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  leaderboardAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  leaderboardAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  leaderboardUsername: { fontSize: 14, fontWeight: '500', color: '#333' },
  leaderboardScore: { fontSize: 14, fontWeight: 'bold', color: '#4CAF50' },
  emptyLeaderboard: { alignItems: 'center', paddingVertical: 60 },
  emptyLeaderboardText: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 15, marginBottom: 8 },
  emptyLeaderboardSubtext: { fontSize: 14, color: '#999', textAlign: 'center' },
});
