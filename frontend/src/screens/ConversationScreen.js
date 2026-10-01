import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useRef, useEffect, useContext } from 'react';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Keyboard,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
  Modal,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import * as Speech from 'expo-speech';
import { LanguageContext } from '../context/LanguageContext';
import { translatorAPI } from '../services/api';

const { width } = Dimensions.get('window');

const ConversationScreen = ({ route, navigation }) => {
  const { activeLanguage } = useContext(LanguageContext);
  const contextValue = useContext(ThemeContext) || {};
  const { isDarkMode, theme } = contextValue;
  const scenarioTitle = route?.params?.title || "AI Conversation Partner (Grok AI)";
  const scenarioColor = route?.params?.color || '#4CAF50';
  
  const [chat, setChat] = useState([
    {
      id: '1',
      sender: 'bot',
      text: `Aua! I bini duba? Welcome to AI conversation practice in ${activeLanguage?.name || 'Izon'}.`,
      translation: "Greetings! How are you? Welcome to AI conversation practice.",
      timestamp: new Date().toISOString(),
      status: 'delivered'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [converseMode, setConverseMode] = useState('selected'); // 'selected' or 'en'
  const [isTyping, setIsTyping] = useState(false);
  const [showVocab, setShowVocab] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const flatListRef = useRef();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (chat.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chat]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    setInputText('');
    haptics.impactMedium();

    const tempUserMsg = {
      id: Math.random().toString(),
      sender: 'user',
      text: userText,
      translation: converseMode === 'selected' ? `(Translating & sending to AI...)` : null,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    setChat(prev => [...prev, tempUserMsg]);
    setIsTyping(true);

    try {
      const response = await translatorAPI.converse({
        message: userText,
        language: activeLanguage?.code || 'izon',
        inputLanguage: converseMode,
      });

      if (response && response.data && response.data.data) {
        const { userMessage, botMessage } = response.data.data;
        
        setChat(prev => [
          ...prev.slice(0, prev.length - 1),
          userMessage,
          botMessage
        ]);

        if (Platform.OS !== 'web' && botMessage.text) {
          Speech.speak(botMessage.text, {
            language: activeLanguage?.code === 'en' ? 'en' : 'ig',
            pitch: 1,
            rate: 0.9,
          });
        }
      } else {
        throw new Error('Invalid response from AI conversation service');
      }
    } catch (error) {
      console.error('AI conversation error:', error);
      Alert.alert('Conversation Error', error.message || 'Failed to reach AI partner.');
      const fallbackBot = {
        id: Math.random().toString(),
        sender: 'bot',
        text: "E duba emi. Let's keep practicing!",
        translation: "I am fine. Let's keep practicing!",
        timestamp: new Date().toISOString(),
        status: 'delivered'
      };
      setChat(prev => [...prev, fallbackBot]);
    } finally {
      setIsTyping(false);
      haptics.notificationSuccess();
    }
  };

  const renderChatItem = ({ item }) => {
    const isUser = item.sender === 'user';
    const showTranslation = item.translation && activeLanguage?.code !== 'EN';
    
    return (
      <Animated.View
        style={[
          styles.messageWrapper,
          isUser ? styles.userWrapper : styles.botWrapper,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
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
            !isUser && { backgroundColor: theme.card || '#FFFFFF' }
          ]}>
            <Text style={[
              styles.chatText,
              isUser && styles.userText,
              !isUser && { color: theme.text || '#000000' }
            ]}>
              {item.text}
            </Text>

            {showTranslation && (
              <View style={styles.translationContainer}>
                <Text style={styles.translationLabel}>English Translation:</Text>
                <Text style={[styles.translationText, isUser && styles.userTranslationText]}>
                  {item.translation}
                </Text>
              </View>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={[styles.timestamp, isUser && { color: 'rgba(255,255,255,0.7)' }]}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {isUser && (
                <MaterialIcons name="done-all" size={16} color="#4CAF50" />
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
      <View style={[styles.typingBubble, { backgroundColor: theme.card || '#FFFFFF' }]}>
        <ActivityIndicator size="small" color="#4CAF50" />
        <Text style={[styles.typingText, { color: theme.text || '#333' }]}>AI Partner is thinking & translating...</Text>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background || '#f5f5f5' }]}>
      <StatusBar barStyle="light-content" backgroundColor={scenarioColor} />

      {/* Header */}
      <LinearGradient
        colors={[scenarioColor, '#1b5e20']}
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
            <FontAwesome5 name="robot" size={20} color="#FFD700" />
            <Text style={styles.headerTitle}>{scenarioTitle}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => setShowVocab(!showVocab)}
          >
            <MaterialIcons name="translate" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.headerSubtitle}>
          Converse with AI in {activeLanguage?.name || 'Izon'} or English. Automatic translation enabled.
        </Text>

        {/* Mode Selector */}
        <View style={styles.modeContainer}>
          <TouchableOpacity 
            style={[styles.modeBtn, converseMode === 'selected' && styles.modeBtnActive]}
            onPress={() => { setConverseMode('selected'); haptics.impactLight(); }}
          >
            <Text style={[styles.modeText, converseMode === 'selected' && styles.modeTextActive]}>
              Converse in {activeLanguage?.name || 'Izon'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.modeBtn, converseMode === 'en' && styles.modeBtnActive]}
            onPress={() => { setConverseMode('en'); haptics.impactLight(); }}
          >
            <Text style={[styles.modeText, converseMode === 'en' && styles.modeTextActive]}>
              Converse in English
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Vocabulary / Info Banner */}
      {showVocab && (
        <Animated.View style={[styles.vocabPanel, { backgroundColor: theme.card || '#FFFFFF' }]}>
          <Text style={styles.vocabTitle}>Translation & AI Flow Info</Text>
          <Text style={[styles.vocabMeaning, { color: theme.subText || '#666' }]}>
            • If conversing in {activeLanguage?.name || 'Izon'}, your message is translated to English and sent to Grok AI.{'\n'}
            • AI responds in English, which is translated back to {activeLanguage?.name || 'Izon'} for display.{'\n'}
            • English translations appear directly below non-English chat bubbles.
          </Text>
        </Animated.View>
      )}

      {/* Chat Area */}
      <View style={styles.chatContainer}>
        <FlatList
          ref={flatListRef}
          data={chat}
          keyExtractor={item => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
        />

        {isTyping && renderTypingIndicator()}

        {/* Input Bar touching the keyboard directly */}
        <View style={[
          styles.inputBar, 
          { 
            backgroundColor: theme.card || '#FFFFFF', 
            borderTopColor: theme.border || '#e0e0e0',
            marginBottom: keyboardHeight > 0 ? keyboardHeight - (Platform.OS === 'ios' ? 34 : 0) : 0 
          }
        ]}>
          <TextInput
            style={[styles.inputBox, { color: theme.text || '#000', backgroundColor: theme.background || '#f9f9f9' }]}
            placeholder={`Type in ${converseMode === 'selected' ? (activeLanguage?.name || 'Izon') : 'English'}...`}
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={300}
          />
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: scenarioColor }]}
            onPress={handleSendMessage}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Message Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card || '#FFFFFF' }]}>
            <LinearGradient
              colors={[scenarioColor, '#1b5e20']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Message Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            
            {selectedMessage && (
              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>Message:</Text>
                <Text style={[styles.modalText, { color: theme.text || '#000' }]}>{selectedMessage.text}</Text>
                
                {selectedMessage.translation && (
                  <>
                    <Text style={styles.modalLabel}>English Translation:</Text>
                    <Text style={[styles.modalText, { color: theme.text || '#000' }]}>{selectedMessage.translation}</Text>
                  </>
                )}
                
                <Text style={styles.modalLabel}>Timestamp:</Text>
                <Text style={[styles.modalText, { color: theme.subText || '#666', fontSize: 14 }]}>
                  {new Date(selectedMessage.timestamp).toLocaleString()}
                </Text>
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
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 10 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    padding: 6,
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
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 10,
  },
  menuButton: {
    padding: 6,
  },
  modeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 4,
    marginTop: 5,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 16,
  },
  modeBtnActive: {
    backgroundColor: '#ffffff',
  },
  modeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#2e7d32',
  },
  vocabPanel: {
    padding: 15,
    margin: 15,
    borderRadius: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  vocabTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  vocabMeaning: {
    fontSize: 13,
    lineHeight: 18,
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
    maxWidth: '88%',
  },
  userWrapper: {
    alignSelf: 'flex-end',
  },
  botWrapper: {
    alignSelf: 'flex-start',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  botAvatarText: {
    fontSize: 16,
  },
  bubble: {
    padding: 14,
    borderRadius: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userBubble: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    borderBottomLeftRadius: 4,
  },
  chatText: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 6,
  },
  userText: {
    color: '#fff',
  },
  translationContainer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  translationLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  translationText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#555',
  },
  userTranslationText: {
    color: 'rgba(255,255,255,0.85)',
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
    color: '#888',
  },
  speakerButton: {
    padding: 8,
    marginLeft: 4,
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
    elevation: 2,
  },
  typingText: {
    fontSize: 13,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  inputBox: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  modalText: {
    fontSize: 16,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
});

export default ConversationScreen;
