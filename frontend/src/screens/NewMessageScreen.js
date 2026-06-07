import React, { useState, useEffect } from 'react';
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
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { communityAPI, messagesAPI } from '../services/api';

const UserItem = ({ user, onSelect, loading }) => {
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in NewMessageScreen.js:', contextValue);
  const { theme } = contextValue;
  return (
    <TouchableOpacity 
      style={[styles.userItem, { backgroundColor: theme.card }]} 
      onPress={() => onSelect(user)}
      disabled={loading}
    >
      <View style={styles.userAvatar}>
        {user.profile?.avatar?.thumbnail ? (
          <Image source={{ uri: user.profile.avatar.thumbnail }} style={styles.userAvatarImage} />
        ) : (
          <Text style={styles.userAvatarText}>{user.username?.charAt(0)?.toUpperCase() || 'U'}</Text>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.text }]}>{user.username}</Text>
        <Text style={styles.userBio} numberOfLines={1}>
          {user.profile?.bio || 'Learning Izon'}
        </Text>
      </View>
      {loading && <ActivityIndicator size="small" color="#4CAF50" />}
    </TouchableOpacity>
  );
};

export default function NewMessageScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectingUser, setSelectingUser] = useState(null); // Track which user is being clicked
  
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in NewMessageScreen.js:', contextValue);
  const { theme } = contextValue;

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const response = await communityAPI.getFriends();
      if (response.data.success) {
        setFriends(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = async (user) => {
    haptics.impactLight();
    setSelectingUser(user.id);
    try {
      // Use the POST /conversation endpoint to get or create the conversation
      const response = await messagesAPI.createConversation({
        userId: user.id
      });
      
      if (response.data.success) {
        haptics.notificationSuccess();
        navigation.replace('ChatDetail', {
          conversationId: response.data.data._id, // Mongo ID from the backend
          otherUser: user,
        });
      }
    } catch (error) {
      haptics.notificationError();
      Alert.alert('Error', 'Could not open conversation');
      console.error(error);
    } finally {
      setSelectingUser(null);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.profile?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading friends...</Text>
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
          <Text style={styles.headerTitle}>New Message</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
        <MaterialIcons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredFriends}
        renderItem={({ item }) => (
          <UserItem
            user={item}
            onSelect={handleUserSelect}
            loading={selectingUser === item.id}
          />
        )}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="people-outline" size={60} color="#ccc" />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No friends found</Text>
            <Text style={styles.emptyText}>Add friends to start messaging</Text>
          </View>
        }
      />
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 15, paddingHorizontal: 15, borderRadius: 10, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 10, fontSize: 16 },
  selectedContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 10, gap: 10 },
  selectedLabel: { fontSize: 14 },
  selectedUser: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, gap: 8 },
  selectedUserName: { fontSize: 14, color: '#4CAF50', fontWeight: '600' },
  listContent: { paddingHorizontal: 15, paddingBottom: 80 },
  userItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 10, elevation: 2 },
  userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  userAvatarImage: { width: 50, height: 50, borderRadius: 25 },
  userAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  userBio: { fontSize: 12, color: '#999' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center' },
  messageContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 15, borderTopWidth: 1, borderTopColor: '#e0e0e0', gap: 10 },
  messageInput: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20, padding: 12, paddingHorizontal: 15, fontSize: 15, backgroundColor: '#fafafa', maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});