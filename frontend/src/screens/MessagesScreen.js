import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { AuthContext } from '../context/AuthContext';

import { messagesAPI } from '../services/api';

const formatTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const ConversationItem = ({ item, onPress, currentUser, theme, isDarkMode }) => {
  const otherParticipant = item.participants?.find(p => p._id !== currentUser?.id);
  const lastMessageTime = formatTime(item.lastMessageAt);
  
  return (
    <TouchableOpacity 
      style={[styles.conversationItem, { backgroundColor: theme.card }]} 
      onPress={() => onPress(item)}
    >
      <View style={styles.conversationAvatar}>
        {otherParticipant?.profile?.avatar?.thumbnail ? (
          <Image source={{ uri: otherParticipant.profile.avatar.thumbnail }} style={styles.conversationAvatarImage} />
        ) : (
          <Text style={styles.conversationAvatarText}>
            {otherParticipant?.username?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        )}
        {item.unreadCount > 0 && <View style={[styles.unreadBadge, { borderColor: theme.card }]} />}
      </View>
      
      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={[styles.conversationName, { color: theme.text }, item.unreadCount > 0 && styles.unreadText, item.unreadCount > 0 && isDarkMode && { color: theme.primary }]}>
            {otherParticipant?.username}
          </Text>
          <Text style={[styles.conversationTime, { color: theme.subText }]}>{lastMessageTime}</Text>
        </View>
        <Text style={[styles.conversationLastMessage, { color: theme.subText }, item.unreadCount > 0 && styles.unreadText, item.unreadCount > 0 && isDarkMode && { color: theme.text }]} numberOfLines={1}>
          {item.lastMessageSender === currentUser?.id ? 'You: ' : ''}{item.lastMessage || 'No messages yet'}
        </Text>
      </View>
      
      {item.unreadCount > 0 && (
        <View style={styles.unreadCountBadge}>
          <Text style={styles.unreadCountText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function MessagesScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { isDarkMode, theme } = useContext(ThemeContext);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async (reset = false) => {
    try {
      if (reset) {
        setPage(1);
        setHasMore(true);
      }
      
      const currentPage = reset ? 1 : page;
      const response = await messagesAPI.getConversations({ page: currentPage, limit: 20 });
      
      if (response.data.success) {
        const newConversations = response.data.data;
        
        if (reset) {
          setConversations(newConversations);
        } else {
          setConversations(prev => [...prev, ...newConversations]);
        }
        
        setHasMore(newConversations.length === 20);
        if (!reset) setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loadingMore) {
      setLoadingMore(true);
      loadConversations(false).finally(() => setLoadingMore(false));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations(true);
  };

  const handleConversationPress = (conversation) => {
    haptics.impactLight();
    navigation.navigate('ChatDetail', {
      conversationId: conversation._id,
      otherUser: conversation.participants.find(p => p._id !== user?.id),
    });
  };

  const handleNewMessage = () => {
    haptics.impactLight();
    navigation.navigate('NewMessage');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />
      
      <LinearGradient colors={['#1a4c2e', '#2e7d32', '#43a047']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity style={styles.newButton} onPress={handleNewMessage}>
            <MaterialIcons name="edit" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="chat-bubble-outline" size={60} color={theme.border} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No messages yet</Text>
          <Text style={[styles.emptyText, { color: theme.subText }]}>Start a conversation with a friend!</Text>
          <TouchableOpacity style={styles.startButton} onPress={handleNewMessage}>
            <Text style={styles.startButtonText}>New Message</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={({ item }) => (
            <ConversationItem 
              item={item} 
              onPress={handleConversationPress} 
              currentUser={user}
              theme={theme}
              isDarkMode={isDarkMode}
            />
          )}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore && <ActivityIndicator style={styles.loadMoreIndicator} color="#4CAF50" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  newButton: { padding: 8 },
  listContent: { padding: 15, paddingBottom: 80 },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  conversationAvatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    position: 'relative',
  },
  conversationAvatarImage: { width: 55, height: 55, borderRadius: 27.5 },
  conversationAvatarText: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
  },
  conversationInfo: { flex: 1 },
  conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  conversationName: { fontSize: 16, fontWeight: 'bold' },
  conversationTime: { fontSize: 11 },
  conversationLastMessage: { fontSize: 13 },
  unreadText: { fontWeight: 'bold' },
  unreadCountBadge: {
    backgroundColor: '#4CAF50',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCountText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 15, marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  startButton: { backgroundColor: '#4CAF50', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loadMoreIndicator: {
    paddingVertical: 20,
  },
});