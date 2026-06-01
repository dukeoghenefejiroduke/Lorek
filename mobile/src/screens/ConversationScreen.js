import React, { useState, useRef, useEffect, useContext } from 'react';
import { ThemeContext, lightTheme as theme } from '../context/ThemeContext';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { StatusBar } from 'expo-status-bar';
import { LanguageContext } from '../context/LanguageContext';
import api from '../services/api';

const { width } = Dimensions.get('window');

// Expanded scenario data with multiple scenes
const SCENARIO_DATA = {
  market: {
    id: 'market',
    title: "At the Market (Oru-ama yo)",
    icon: 'shopping-basket',
    color: '#4CAF50',
    description: "Practice buying and selling at a local market",
    messages: [
      { 
        id: '1', 
        sender: 'bot', 
        text: "Aua, i bini duba?", 
        translation: "Greetings, how are you?",
        audio: 'market_greeting_1',
        image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400'
      },
    ],
    options: [
      { 
        id: 'a', 
        text: "E duba emi. Irie?", 
        translation: "I am fine. And you?",
        nextStep: '2',
        context: "Polite response",
        difficulty: 'beginner'
      },
      { 
        id: 'b', 
        text: "E bere duba.", 
        translation: "I am very well.",
        nextStep: '2',
        context: "Enthusiastic response",
        difficulty: 'beginner'
      }
    ],
    vocabulary: [
      { word: "oru", meaning: "market", example: "Mie oru-ama bo." },
      { word: "bini", meaning: "how", example: "I bini duba?" }
    ]
  }
};

const ConversationScreen = ({ route }) => {
  const { activeLanguage } = useContext(LanguageContext);
  const { isDarkMode, theme } = useContext(ThemeContext);
  const scenarioId = route?.params?.scenarioId || 'market';
  const scenario = SCENARIO_DATA[scenarioId];
  
  const [chat, setChat] = useState([]);
  const [options, setOptions] = useState([]);
  const [currentStep, setCurrentStep] = useState('1');
  const [isTyping, setIsTyping] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showVocab, setShowVocab] = useState(false);
  const [sound, setSound] = useState();
  const [recording, setRecording] = useState();
  const [isRecording, setIsRecording] = useState(false);
  const [userScore, setUserScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  
  const flatListRef = useRef();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeConversation();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
    animatePulse();
  }, []);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const animatePulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const initializeConversation = () => {
    setChat([{
      ...scenario.messages[0],
      timestamp: new Date().toISOString(),
      status: 'delivered'
    }]);
    setOptions(scenario.options);
  };

  const handleSelection = async (option) => {
    // Haptic feedback
    haptics.impactMedium();

    // Add user message
    const userMsg = {
      id: Math.random().toString(),
      sender: 'user',
      text: option.text,
      translation: option.translation,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    setChat(prev => [...prev, userMsg]);
    setOptions([]);
    setIsTyping(true);
    
    // Update score
    setUserScore(prev => prev + 10);
    setStreak(prev => prev + 1);

    // Scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);

    // Simulate typing delay
    setTimeout(async () => {
      // Generate contextual bot response
      const botResponse = await generateBotResponse(option);
      
      // Speak the response
      if (Platform.OS !== 'web') {
        Speech.speak(botResponse.text, {
          language: 'ig', // Izon language code
          pitch: 1,
          rate: 0.8,
        });
      }

      setChat(prev => [...prev, { ...botResponse, status: 'delivered' }]);
      setIsTyping(false);
      
      // Check if conversation continues
      if (option.nextStep && scenario[`step_${option.nextStep}`]) {
        setOptions(scenario[`step_${option.nextStep}`].options);
      }

      // Success haptic
      haptics.notificationSuccess();
    }, 1500);
  };

  const generateBotResponse = async (userOption) => {
    // This would ideally call an AI service
    const responses = {
      a: {
        id: Math.random().toString(),
        sender: 'bot',
        text: "Mie duba emi. Ye nua wo?",
        translation: "I'm fine. What do you need?",
        context: "The vendor asks what you want to buy",
        suggestions: ["Tari", "Fin", "Anga"]
      },
      b: {
        id: Math.random().toString(),
        sender: 'bot',
        text: "Ebere! Mie oru-ama bo.",
        translation: "Great! I'm at the market.",
        context: "The vendor welcomes you to the market",
        suggestions: ["Nda ye", "Bara"]
      }
    };
    
    return responses[userOption.id] || {
      id: Math.random().toString(),
      sender: 'bot',
      text: "Izon emi! Ye nua.",
      translation: "That's good! Thank you.",
      context: "The vendor appreciates your response"
    };
  };

  const playAudio = async (audioFile) => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/audio/sample.mp3') // Replace with actual audio files
      );
      setSound(sound);
      await sound.playAsync();
    } catch (error) {
      console.error('Failed to play audio', error);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    // Here you would send the recording to a speech recognition service
    Alert.alert('Recording Saved', 'Your pronunciation has been recorded for analysis');
  };

  const renderChatItem = ({ item, index }) => {
    const isUser = item.sender === 'user';
    
    return (
      <Animated.View
        style={[
          styles.messageWrapper,
          isUser ? styles.userWrapper : styles.botWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {!isUser && (
          <View style={styles.botAvatar}>
            <Text style={styles.botAvatarText}>🤖</Text>
          </View>
        )}
        
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => {
            setSelectedMessage(item);
            setModalVisible(true);
            haptics.impactLight();
          }}
        >
          <View style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.botBubble,
            item.image && styles.bubbleWithImage
          ]}>
            {item.image && (
              <Image source={{ uri: item.image }} style={styles.messageImage} />
            )}
            <Text style={[
              styles.chatText,
              isUser && styles.userText
            ]}>{item.text}</Text>
            <Text style={styles.translationText}>{item.translation}</Text>
            
            {item.context && (
              <View style={styles.contextTag}>
                <Text style={styles.contextText}>{item.context}</Text>
              </View>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={styles.timestamp}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {isUser && (
                <MaterialIcons 
                  name={item.status === 'sent' ? 'done' : 'done-all'} 
                  size={16} 
                  color={item.status === 'read' ? '#4CAF50' : '#999'} 
                />
              )}
            </View>
          </View>
        </TouchableOpacity>
        
        {!isUser && (
          <TouchableOpacity 
            style={styles.speakerButton}
            onPress={() => {
              Speech.speak(item.text, { language: 'ig' });
              haptics.impactLight();
            }}
          >
            <Ionicons name="volume-high" size={20} color="#4CAF50" />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  const renderTypingIndicator = () => (
    <Animated.View style={[styles.typingContainer, { opacity: fadeAnim }]}>
      <View style={styles.typingBubble}>
        <ActivityIndicator size="small" color="#4CAF50" />
        <Text style={styles.typingText}>Vendor is typing...</Text>
      </View>
    </Animated.View>
  );

  const renderOption = ({ item }) => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={[styles.optionBtn, { borderLeftColor: item.difficulty === 'beginner' ? '#4CAF50' : '#FF9800' }]}
        onPress={() => handleSelection(item)}
        activeOpacity={0.7}
      >
        <View style={styles.optionHeader}>
          <Text style={styles.optionText}>{item.text}</Text>
          {item.difficulty && (
            <View style={[styles.difficultyBadge, { 
              backgroundColor: item.difficulty === 'beginner' ? '#4CAF50' : '#FF9800' 
            }]}>
              <Text style={styles.difficultyText}>{item.difficulty}</Text>
            </View>
          )}
        </View>
        <Text style={styles.optionSub}>{item.translation}</Text>
        {item.context && (
          <View style={styles.optionContext}>
            <MaterialIcons name="info" size={12} color="#666" />
            <Text style={styles.optionContextText}>{item.context}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={scenario.color} />

      {/* Header */}
      <LinearGradient
        colors={[scenario.color, '#2e7d32']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <FontAwesome5 name={scenario.icon} size={20} color="#FFD700" />
            <Text style={styles.headerTitle}>{scenario.title}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => setShowVocab(!showVocab)}
          >
            <MaterialIcons name="menu-book" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.headerSubtitle}>{scenario.description}</Text>

        {/* Score Display */}
        <View style={styles.scoreContainer}>
          <View style={styles.scoreItem}>
            <MaterialIcons name="stars" size={20} color="#FFD700" />
            <Text style={styles.scoreText}>{userScore}</Text>
          </View>
          <View style={styles.scoreItem}>
            <MaterialIcons name="whatshot" size={20} color="#FF6B6B" />
            <Text style={styles.scoreText}>{streak} day streak</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Vocabulary Panel */}
      {showVocab && (
        <Animated.View style={[styles.vocabPanel, { opacity: fadeAnim }]}>
          <Text style={styles.vocabTitle}>Useful Vocabulary</Text>
          {scenario.vocabulary.map((item, index) => (
            <View key={index} style={styles.vocabItem}>
              <Text style={styles.vocabWord}>{item.word}</Text>
              <Text style={styles.vocabMeaning}> - {item.meaning}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Chat Area */}
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={chat}
          keyExtractor={item => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          showsVerticalScrollIndicator={false}
        />

        {isTyping && renderTypingIndicator()}

        {/* Options Panel */}
        {options.length > 0 && (
          <Animated.View style={[styles.optionsPanel, { opacity: fadeAnim }]}>
            <View style={styles.optionsHeader}>
              <Text style={styles.optionsTitle}>Choose your response:</Text>
              <TouchableOpacity onPress={() => setShowHint(!showHint)}>
                <Ionicons name="help-circle" size={24} color={scenario.color} />
              </TouchableOpacity>
            </View>
            
            {showHint && (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>
                  💡 Select the most appropriate response based on the conversation context.
                </Text>
              </View>
            )}
            
            <FlatList
              data={options}
              keyExtractor={item => item.id}
              renderItem={renderOption}
              scrollEnabled={false}
            />
          </Animated.View>
        )}

        {/* Voice Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity 
            style={[styles.voiceButton, isRecording && styles.recordingButton]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Ionicons 
              name={isRecording ? "stop" : "mic"} 
              size={24} 
              color={isRecording ? "#fff" : "#4CAF50"} 
            />
          </TouchableOpacity>
          
          <Text style={styles.inputHint}>
            {isRecording ? 'Recording... Tap to stop' : 'Tap to practice pronunciation'}
          </Text>
          
          <TouchableOpacity 
            style={styles.keyboardButton}
            onPress={() => Alert.alert('Type Response', 'This would open text input')}
          >
            <MaterialIcons name="keyboard" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Message Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[scenario.color, '#2e7d32']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Message Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            
            {selectedMessage && (
              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>{activeLanguage?.name || 'Izon'}:</Text>
                <Text style={styles.modalText}>{selectedMessage.text}</Text>
                
                <Text style={styles.modalLabel}>Translation:</Text>
                <Text style={styles.modalText}>{selectedMessage.translation}</Text>
                
                {selectedMessage.context && (
                  <>
                    <Text style={styles.modalLabel}>Context:</Text>
                    <Text style={styles.modalText}>{selectedMessage.context}</Text>
                  </>
                )}
                
                {selectedMessage.suggestions && (
                  <>
                    <Text style={styles.modalLabel}>Similar Phrases:</Text>
                    <View style={styles.suggestionsList}>
                      {selectedMessage.suggestions.map((sug, i) => (
                        <View key={i} style={styles.suggestionPill}>
                          <Text style={styles.suggestionText}>{sug}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 5,
  },
  menuButton: {
    padding: 8,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 15,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  scoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  vocabPanel: {
    backgroundColor: theme.card,
    padding: 15,
    margin: 15,
    borderRadius: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  vocabTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  vocabItem: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  vocabWord: {
    fontWeight: '600',
    color: theme.text,
  },
  vocabMeaning: {
    color: theme.subText,
  },
  chatContainer: {
    flex: 1,
  },
  chatList: {
    padding: 15,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 15,
    maxWidth: '85%',
  },
  userWrapper: {
    alignSelf: 'flex-end',
  },
  botWrapper: {
    alignSelf: 'flex-start',
  },
  botAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  botAvatarText: {
    fontSize: 20,
  },
  bubble: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: theme.card,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bubbleWithImage: {
    padding: 0,
    overflow: 'hidden',
  },
  userBubble: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: theme.card,
    borderBottomLeftRadius: 4,
  },
  messageImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  chatText: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 4,
  },
  userText: {
    color: '#fff',
  },
  translationText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  contextTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  contextText: {
    fontSize: 10,
    color: '#4CAF50',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 10,
  },
  speakerButton: {
    padding: 8,
    marginLeft: 8,
  },
  typingContainer: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 8,
  },
  typingText: {
    fontSize: 14,
  },
  optionsPanel: {
    padding: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  hintBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  hintText: {
    fontSize: 14,
  },
  optionBtn: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  difficultyText: {
    color: '#fff',
    fontSize: 10,
    textTransform: 'capitalize',
  },
  optionSub: {
    fontSize: 14,
    marginBottom: 5,
  },
  optionContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  optionContextText: {
    fontSize: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  voiceButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: '#f44336',
  },
  inputHint: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  keyboardButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 5,
  },
  modalText: {
    fontSize: 18,
    padding: 12,
    borderRadius: 8,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  suggestionText: {
    color: '#4CAF50',
    fontSize: 14,
  },
});

export default ConversationScreen;
