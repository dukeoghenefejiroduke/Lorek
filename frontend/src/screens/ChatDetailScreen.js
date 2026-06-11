import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useEffect, useContext, useRef } from 'react';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { AuthContext } from '../context/AuthContext';
import { messagesAPI } from '../services/api'; // Ensure this path is correct

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { hour: '2-digit', minute: '2-digit' });
};

const MessageBubble = ({ message, isOwn, showAvatar, theme, isDarkMode }) => {
  return (
    <View style={[styles.messageRow, isOwn ? styles.messageRowOwn : styles.messageRowOther]}>
      {!isOwn && showAvatar && (
        <View style={[styles.messageAvatar, { backgroundColor: theme.primary }]}>
          {message.sender?.profile?.avatar?.thumbnail ? (
            <Image source={{ uri: message.sender.profile.avatar.thumbnail }} style={styles.messageAvatarImage} />
          ) : (
            <Text style={styles.messageAvatarText}>
              {message.sender?.username?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          )}
        </View>
      )}
      <View style={[styles.messageBubble, isOwn ? styles.messageBubbleOwn : [styles.messageBubbleOther, { backgroundColor: theme.card }]]}>
        <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : [styles.messageTextOther, { color: theme.text }]]}>
          {message.content}
        </Text>
        <Text style={[styles.messageTime, isOwn ? { color: 'rgba(255,255,255,0.7)' } : { color: theme.subText }]}>
          {formatTime(message.createdAt)} 
        </Text>
      </View>
    </View>
  );
};

export default function ChatDetailScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in ChatDetailScreen.js:', contextValue);
  const { theme, isDarkMode } = contextValue;
  const { conversationId, otherUser: initialOtherUser } = route.params;
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState(initialOtherUser);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const flatListRef = useRef(null);

  useEffect(() => {
    initialFetch();
  }, [conversationId]);

  const initialFetch = async () => {
    setLoading(true);
    await Promise.all([loadMessages(true), loadConversation()]);
    setLoading(false);
    // Scroll to bottom after initial load
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
  };

  const loadConversation = async () => {
    try {
      const response = await messagesAPI.getConversation(conversationId);
      if (response.data.success) {
        const other = response.data.data.participants?.find(p => p._id !== user?.id);
        if (other) setOtherUser(other);
      }
    } catch (error) {
      console.error('Failed to load conversation details:', error);
    }
  };

  const loadMessages = async (reset = false) => {
    try {
      const currentPage = reset ? 1 : page;
      const response = await messagesAPI.getMessages(conversationId, { page: currentPage, limit: 30 });
      
      if (response.data.success) {
        const newMessages = response.data.data;
        
        if (reset) {
          setMessages(newMessages);
        } else {
          // Prepend older messages for pagination
          setMessages(prev => [...newMessages, ...prev]);
        }
        
        setHasMore(newMessages.length === 30);
        setPage(currentPage + 1);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreMessages = () => {
    if (hasMore && !loadingMore) {
      setLoadingMore(true);
      loadMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;
    
    const messageContent = inputText.trim();
    setInputText('');
    setSending(true);
    
    const tempId = `temp_${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      content: messageContent,
      sender: { _id: user.id, username: user.username },
      createdAt: new Date().toISOString(),
    };

    // Optimistic UI update
    setMessages(prev => [...prev, tempMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    
    try {
      const response = await messagesAPI.sendMessage({
        conversationId,
        content: messageContent,
      });
      
      if (response.data.success) {
        setMessages(prev =>
          prev.map(msg => msg._id === tempId ? response.data.data : msg)
        );
        haptics.impactLight();
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg._id !== tempId));
      Alert.alert('Error', 'Message failed to send.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }) => {
    const isOwn = item.sender?._id === user?.id || item.sender === user?.id;
    // Show avatar if it's the first message in a group from the other user
    const showAvatar = !isOwn && (index === 0 || messages[index - 1]?.sender?._id !== item.sender?._id);
    
    return <MessageBubble message={item} isOwn={isOwn} showAvatar={showAvatar} theme={theme} isDarkMode={isDarkMode} />;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={isDarkMode ? ['#000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => navigation.navigate('UserProfile', { userId: otherUser?._id })}
          >
            <View style={[styles.headerAvatar, { backgroundColor: theme.primary }]}>
              {otherUser?.profile?.avatar?.thumbnail ? (
                <Image source={{ uri: otherUser.profile.avatar.thumbnail }} style={styles.headerAvatarImage} />
              ) : (
                <Text style={styles.headerAvatarText}>{otherUser?.username?.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <Text style={styles.headerTitle}>{otherUser?.username || 'Chat'}</Text>
          </TouchableOpacity>
          <View style={{ width: 40 }} /> 
        </View>
      </LinearGradient>

    {/* WRAP THE LIST AND INPUT TOGETHER */}
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messagesList}
        onHeaderRefresh={loadMoreMessages} // Using header for "pull to load older"
        onEndReachedThreshold={0.1}
        ListHeaderComponent={loadingMore ? <ActivityIndicator color="#4CAF50" /> : null}
        onContentSizeChange={() => {
            // Only auto-scroll to bottom if the user is already near the bottom
            flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />

        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: isDarkMode ? '#1a1a1a' : '#fafafa', color: theme.text, borderColor: theme.border }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.subText}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && { backgroundColor: theme.border }]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="send" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { padding: 8 },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  headerAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  messagesList: { padding: 15, paddingBottom: 20 },
  messageRow: { flexDirection: 'row', marginBottom: 12 },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageAvatar: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  messageAvatarImage: { width: 35, height: 35, borderRadius: 17.5 },
  messageAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 20 },
  messageBubbleOwn: { backgroundColor: '#4CAF50', borderBottomRightRadius: 4 },
  messageBubbleOther: { borderBottomLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1 },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageTextOwn: { color: '#fff' },
  messageTextOther: { },
  messageTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 15, borderTopWidth: 1, gap: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 12, paddingHorizontal: 15, fontSize: 15, maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#ccc' },
  loadMoreIndicator: { marginVertical: 10, alignSelf: 'center' },
});