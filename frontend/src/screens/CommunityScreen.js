import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import haptics from '../utils/haptics';
import { AuthContext } from '../context/AuthContext';
import { communityAPI } from '../services/api';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';

const { width } = Dimensions.get('window');
export default function CommunityScreen({ navigation }) {
  const { user } = useContext(AuthContext); 
  const { activeLanguage } = useContext(LanguageContext);
  
   const contextValue = useContext(ThemeContext) || {};
   console.log('DEBUG: Accessing ThemeContext in CommunityScreen.js:', contextValue);
   const { isDarkMode, theme } = contextValue;
  
  const isModerator = user?.role === 'admin' || user?.role === 'moderator';

  const COMMUNITY_TABS = [
    { id: 'feed', name: 'Feed', icon: 'people' },
    { id: 'friends', name: 'Friends', icon: 'group' },
    { id: 'leaderboard', name: 'Leaderboard', icon: 'emoji-events' },
    { id: 'discussions', name: 'Discussions', icon: 'forum' },
    ...(isModerator ? [{ id: 'reviews', name: 'Reviews', icon: 'rate-review' }] : []),
  ];

  // ... (existing state)
  const [pendingContributions, setPendingContributions] = useState([]);
  const [activeTab, setActiveTab] = useState('feed');
  // ... (existing state)

  // ... (existing load functions)

  const loadPendingContributions = async () => {
    try {
      const response = await communityAPI.getPendingContributions();
      if (response.data.success) {
        setPendingContributions(response.data.data);
      }
    } catch (e) {
      console.error('Failed to load contributions', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews') {
      loadPendingContributions();
    }
    // ... (existing useEffect)
  }, [activeTab]);

  const handleReview = async (contributionId, decision) => {
    try {
      await communityAPI.reviewContribution(contributionId, { decision });
      // Refresh list
      loadPendingContributions();
      haptics.notificationSuccess();
    } catch (e) {
      Alert.alert('Error', 'Failed to submit review');
    }
  };

  const renderReviewsTab = () => (
    <FlatList
      data={pendingContributions}
      renderItem={({ item }) => (
        <View style={[styles.postCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.postContent, { color: theme.text }]}>
            {item.data.text || `Audio URL: ${item.data.url}`}
          </Text>
          <Text style={styles.postTimestamp}>Type: {item.type}</Text>
          <View style={styles.requestActions}>
            <TouchableOpacity style={[styles.requestButton, styles.acceptButton]} onPress={() => handleReview(item._id, 'approve')}>
              <Text style={styles.acceptButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.requestButton, styles.rejectButton]} onPress={() => handleReview(item._id, 'reject')}>
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.feedList}
    />
  );

  // ... (rest of the component)

  const [posts, setPosts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [creatingPost, setCreatingPost] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadComments = async (postId) => {
    try {
      setLoadingComments(true);
      const res = await communityAPI.getComments(postId);
      if (res.data.success) {
        setComments(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (commentModalVisible && selectedPost) {
      loadComments(selectedPost._id);
    }
  }, [commentModalVisible, selectedPost]);

  const handleOpenComments = (post) => {
    setSelectedPost(post);
    setComments([]);
    setCommentModalVisible(true);
  };
  
  // Pagination
  const [feedPage, setFeedPage] = useState(1);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const [pendingRequests, setPendingRequests] = useState({}); // { userId: true/false }

  useEffect(() => {
    loadInitialData();
    startAnimations();
  }, []);

  useEffect(() => {
    if (activeTab === 'feed') {
      loadFeed(true);
    } else if (activeTab === 'friends') {
      loadFriends();
      loadFriendRequests();
    } else if (activeTab === 'discussions') {
      loadDiscussions();
    } else if (activeTab === 'leaderboard') {
      loadLeaderboard();
    }
  }, [activeTab]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([
      loadFeed(true),
      loadFriends(),
      loadFriendRequests(),
      loadDiscussions(),
      loadLeaderboard(),
    ]);
    setLoading(false);
  };

  const loadFeed = async (reset = false) => {
    try {
      if (reset) {
        setFeedPage(1);
        setHasMoreFeed(true);
      }
      
      const page = reset ? 1 : feedPage;
      const response = await communityAPI.getFeed({ page, limit: 20 });
      
      if (response.data.success) {
        const newPosts = response.data.data;
        
        if (reset) {
          setPosts(newPosts);
        } else {
          setPosts(prev => {
            // 1. Create a Set of existing IDs for O(1) lookup
            const existingIds = new Set(prev.map(post => post._id));
            
            // 2. Filter out posts that already exist in the state
            const filteredNewPosts = newPosts.filter(post => !existingIds.has(post._id));
            
            // 3. Append only the unique posts
            return [...prev, ...filteredNewPosts];
          });
        }
        
        setHasMoreFeed(newPosts.length === 20);
        if (!reset) setFeedPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to load feed:', error);
      Alert.alert('Error', 'Failed to load feed');
    }
  };

  const loadMoreFeed = () => {
    if (hasMoreFeed && !loadingMore && activeTab === 'feed') {
      setLoadingMore(true);
      loadFeed(false).finally(() => setLoadingMore(false));
    }
  };

  const loadFriends = async () => {
    try {
      const response = await communityAPI.getFriends();
      if (response.data.success) {
        setFriends(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

 const loadFriendRequests = async () => {
  try {
    // Fetch both simultaneously
    const [incomingRes, outgoingRes] = await Promise.all([
      communityAPI.getFriendRequests(),
      communityAPI.getSentRequests()
    ]);

    const pendingMap = {};

    // 1. Mark people who sent YOU a request
    if (incomingRes.data.success) {
      setFriendRequests(incomingRes.data.data);
      incomingRes.data.data.forEach(req => {
        pendingMap[req.from.id] = true;
      });
    }

    // 2. Mark people YOU sent a request to
    if (outgoingRes.data.success) {
      outgoingRes.data.data.forEach(targetUserId => {
        pendingMap[targetUserId] = true;
      });
    }

    setPendingRequests(prev => ({ ...prev, ...pendingMap }));
  } catch (error) {
    console.error('Failed to load friend requests:', error);
  }
};

  const loadDiscussions = async () => {
    try {
      const response = await communityAPI.getDiscussions({ limit: 20 });
      if (response.data.success) {
        setDiscussions(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load discussions:', error);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await communityAPI.getFriendsLeaderboard?.({ limit: 10 }) || 
                       await communityAPI.getLeaderboard?.({ limit: 10 });
      if (response?.data?.success) {
        setLeaderboard(response.data.data.leaderboard || response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      // Fallback to sample data
      setLeaderboard([
        { rank: 1, username: 'User 1', points: 950, avatar: null },
        { rank: 2, username: 'User 2', points: 850, avatar: null },
        { rank: 3, username: 'User 3', points: 750, avatar: null },
      ]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  const handleLike = async (postId) => {
    haptics.impactLight();
    
    // Optimistic update
    setPosts(prev =>
      prev.map(post =>
        post._id === postId
          ? {
              ...post,
              likedByUser: !post.likedByUser,
              likeCount: post.likedByUser ? post.likeCount - 1 : post.likeCount + 1,
            }
          : post
      )
    );
    
    try {
      await communityAPI.likePost(postId);
    } catch (error) {
      // Revert on error
      setPosts(prev =>
        prev.map(post =>
          post._id === postId
            ? {
                ...post,
                likedByUser: !post.likedByUser,
                likeCount: post.likedByUser ? post.likeCount + 1 : post.likeCount - 1,
              }
            : post
        )
      );
      Alert.alert('Error', 'Failed to like post');
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) {
      Alert.alert('Error', 'Please enter some content');
      return;
    }

    setCreatingPost(true);
    
    try {
      const response = await communityAPI.createPost({
        content: newPostContent,
        lessonId: selectedLesson,
      });
      
      if (response.data.success) {
        setPosts(prev => [response.data.data, ...prev]);
        setNewPostContent('');
        setSelectedLesson(null);
        setPostModalVisible(false);
        haptics.notificationSuccess();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setCreatingPost(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedPost) return;
    
    setSubmittingComment(true);
    
    try {
      const response = await communityAPI.addComment(selectedPost._id, { content: commentText });
      
      if (response.data.success) {
        // Update post comment count
        setPosts(prev =>
          prev.map(post =>
            post._id === selectedPost._id
              ? { ...post, commentCount: (post.commentCount || 0) + 1 }
              : post
          )
        );
        setComments(prev => [response.data.data, ...prev]);
        setCommentText('');
        haptics.notificationSuccess();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

const handleSendFriendRequest = async (userId) => {
  if (pendingRequests[userId]) return;

  // Optimistic Update: Set to true immediately
  setPendingRequests(prev => ({ ...prev, [userId]: true }));

  try {
    const response = await communityAPI.sendFriendRequest(userId);
    if (response.data.success) {
      haptics.notificationSuccess();
    }
  } catch (error) {
    const errorData = error.response?.data;
    
    // Check for your specific backend error message
    if (errorData?.error === "Friend request already exists") {
      // If it exists, leave it as 'true' so the button stays "Pending"
      setPendingRequests(prev => ({ ...prev, [userId]: true }));
    } else {
      // For any other error, revert so they can try again
      setPendingRequests(prev => ({ ...prev, [userId]: false }));
      Alert.alert('Error', errorData?.error || 'Failed to send request');
    }
  }
};

const handleAcceptFriendRequest = async (requestId) => {
  try {
    await communityAPI.acceptFriendRequest(requestId);
    // CRITICAL: Refresh both lists
    await loadFriendRequests(); 
    await loadFriends(); 
    haptics.notificationSuccess();
  } catch (error) {
    Alert.alert('Error', 'Failed to accept request');
  }
};

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

const renderPost = ({ item }) => {
  const targetUserId = item.user?._id || item.user?.id;
  const isMe = targetUserId === user?.id;

  const isAlreadyFriend = friends.some(f => 
    f.id === targetUserId || f._id === targetUserId
  );

  const isPending = pendingRequests[targetUserId];

  return (
    <Animated.View style={[styles.postCard, { backgroundColor: theme.card, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={[styles.postAvatar, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('UserProfile', { userId: item.user?._id })}
        >
          {item.user?.profile?.avatar?.thumbnail ? (
            <Image source={{ uri: item.user.profile.avatar.thumbnail }} style={styles.postAvatarImage} />
          ) : (
            <Text style={styles.postAvatarText}>
              {item.user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.postUserInfo}>
          <View style={styles.userNameContainer}>
            <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: item.user?._id })}>
              <Text style={[styles.postUserName, { color: theme.text }]}>{item.user?.username}</Text>
            </TouchableOpacity>
            {!isMe && (
              <TouchableOpacity 
                style={[
                  styles.miniAddButton, 
                  (isPending || isAlreadyFriend) && { backgroundColor: theme.border },
                  !isPending && !isAlreadyFriend && { backgroundColor: theme.primary + '20' }
                ]} 
                onPress={() => handleSendFriendRequest(targetUserId)}
                disabled={isPending || isAlreadyFriend}
              >
                {isAlreadyFriend ? (
                  <>
                    <MaterialIcons name="people" size={16} color={theme.primary} />
                    <Text style={[styles.miniAddButtonText, {color: theme.primary}]}>Friends</Text>
                  </>
                ) : isPending ? (
                  <>
                    <MaterialIcons name="hourglass-empty" size={16} color={theme.subText} />
                    <Text style={[styles.miniAddButtonText, {color: theme.subText}]}>Pending</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="person-add" size={16} color={theme.primary} />
                    <Text style={[styles.miniAddButtonText, {color: theme.primary}]}>Connect</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.postTimestamp, { color: theme.subText }]}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>

      <Text style={[styles.postContent, { color: theme.text }]}>{item.content}</Text>

      {item.lesson && (
        <View style={[styles.postLessonBadge, { backgroundColor: theme.primary + '20' }]}>
          <MaterialIcons name="school" size={16} color={theme.primary} />
          <Text style={[styles.postLessonText, { color: theme.primary }]}>Lesson: {item.lesson?.title?.english}</Text>
        </View>
      )}

      <View style={[styles.postActions, { borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.postAction} onPress={() => handleLike(item._id)}>
          <MaterialIcons
            name={item.likedByUser ? 'favorite' : 'favorite-border'}
            size={22}
            color={item.likedByUser ? theme.error : theme.subText}
          />
          <Text style={[styles.postActionText, { color: theme.subText }]}>{item.likeCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.postAction} 
          onPress={() => {
            setSelectedPost(item);
            setCommentModalVisible(true);
          }}
        >
          <MaterialIcons name="chat-bubble-outline" size={22} color={theme.subText} />
          <Text style={[styles.postActionText, { color: theme.subText }]}>{item.commentCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.postAction}>
          <MaterialIcons name="share" size={22} color={theme.subText} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

  const renderFriendCard = ({ item }) => (
    <Animated.View style={[styles.friendCard, { backgroundColor: theme.card, opacity: fadeAnim }]}>
      <TouchableOpacity 
        style={[styles.friendAvatar, { backgroundColor: theme.secondary }]}
        onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
      >
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.friendAvatarImage} />
        ) : (
          <Text style={styles.friendAvatarText}>{item.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        )}
      </TouchableOpacity>
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: theme.text }]}>{item.name}</Text>
        <View style={styles.friendStreak}>
          <MaterialIcons name="whatshot" size={14} color={theme.error} />
          <Text style={[styles.friendStreakText, { color: theme.subText }]}>{item.streak || 0} day streak</Text>
        </View>
      </View>
      <TouchableOpacity 
         style={styles.messageButton}
        onPress={() => navigation.navigate('NewMessage', { recipient: item })}>
     <MaterialIcons name="message" size={20} color={theme.primary} />
    </TouchableOpacity>
    </Animated.View>
  );

  const renderFriendRequest = ({ item }) => (
    <Animated.View style={[styles.requestCard, { backgroundColor: theme.card, opacity: fadeAnim }]}>
      <View style={[styles.requestAvatar, { backgroundColor: theme.primary }]}>
        {item.from?.avatar ? (
          <Image source={{ uri: item.from.avatar }} style={styles.requestAvatarImage} />
        ) : (
          <Text style={styles.requestAvatarText}>{item.from?.username?.charAt(0)?.toUpperCase() || 'U'}</Text>
        )}
      </View>
      <View style={styles.requestInfo}>
        <Text style={[styles.requestName, { color: theme.text }]}>{item.from?.username}</Text>
        <Text style={[styles.requestTime, { color: theme.subText }]}>{formatTime(item.createdAt)}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity 
          style={[styles.requestButton, styles.acceptButton, { backgroundColor: theme.primary }]}
          onPress={() => handleAcceptFriendRequest(item.id)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.requestButton, styles.rejectButton, { backgroundColor: theme.border, borderColor: theme.border }]}>
          <Text style={[styles.rejectButtonText, { color: theme.text }]}>Reject</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderDiscussionCard = ({ item }) => (
    <Animated.View style={[styles.discussionCard, { backgroundColor: theme.card, opacity: fadeAnim }]}>
      <View style={styles.discussionHeader}>
        <FontAwesome5 name="comments" size={20} color={theme.primary} />
        <Text style={[styles.discussionTitle, { color: theme.text }]}>{item.title}</Text>
      </View>
      <Text style={[styles.discussionPreview, { color: theme.subText }]} numberOfLines={2}>
        {item.content?.substring(0, 100)}...
      </Text>
      <View style={styles.discussionMeta}>
        <Text style={[styles.discussionAuthor, { color: theme.subText }]}>By {item.author?.username}</Text>
        <Text style={[styles.discussionStats, { color: theme.subText }]}>
          {item.replyCount || 0} replies • {formatTime(item.lastActive)}
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.joinDiscussionButton, { backgroundColor: theme.primary + '20' }]}
        onPress={() => navigation.navigate('DiscussionDetail', { discussionId: item._id })}
      >
        <Text style={[styles.joinDiscussionText, { color: theme.primary }]}>Join Discussion</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderLeaderboardItem = ({ item, index }) => (
    <View style={[styles.leaderboardItem, { borderBottomColor: theme.border }]}>
      <Text style={[styles.leaderboardRank, { color: theme.subText }]}>#{item.rank || index + 1}</Text>
      <View style={styles.leaderboardUser}>
        <View style={[styles.leaderboardAvatar, { backgroundColor: isDarkMode ? '#1a2e21' : '#4CAF50' }]}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.leaderboardAvatarImage} />
          ) : (
            <Text style={styles.leaderboardAvatarText}>
              {item.username?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          )}
        </View>
        <Text style={[styles.leaderboardUsername, { color: theme.text }]}>{item.username}</Text>
      </View>
      <Text style={styles.leaderboardPoints}>{item.points || item.value || 0} XP</Text>
    </View>
  );

  const renderFriendsTab = () => (
    <ScrollView
      style={styles.tabContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />}
    >
      {friendRequests.length > 0 && (
        <View style={[styles.requestsSection, { borderBottomColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Friend Requests ({friendRequests.length})</Text>
          <FlatList
            data={friendRequests}
            renderItem={renderFriendRequest}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}
      
      <View style={styles.friendsSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Friends ({friends.length})</Text>
        {friends.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="people-outline" size={60} color={isDarkMode ? '#444' : '#ccc'} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No friends yet</Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>Connect with other learners!</Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            renderItem={renderFriendCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}
      </View>
    </ScrollView>
  );

  const renderLeaderboardTab = () => (
    <View style={[styles.leaderboardContainer, { backgroundColor: theme.card }]}>
      <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.leaderboardHeader}>
        <FontAwesome5 name="crown" size={30} color="#fff" />
        <Text style={styles.leaderboardTitle}>Friends Leaderboard</Text>
        <Text style={styles.leaderboardSubtitle}>Top learners among your friends</Text>
      </LinearGradient>

      <FlatList
        data={leaderboard}
        renderItem={renderLeaderboardItem}
        keyExtractor={(item, index) => item.userId || index.toString()}
        contentContainerStyle={styles.leaderboardList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FontAwesome5 name="trophy" size={60} color={isDarkMode ? '#444' : '#ccc'} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No leaderboard data</Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>Add friends to see rankings!</Text>
          </View>
        }
      />
    </View>
  );

  const renderDiscussionsTab = () => (
    <FlatList
      data={discussions}
      renderItem={renderDiscussionCard}
      keyExtractor={(item) => item._id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.discussionsList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />}
      ListHeaderComponent={
        <TouchableOpacity 
          style={styles.newDiscussionButton}
          onPress={() => navigation.navigate('CreateDiscussion')}
        >
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={styles.newDiscussionText}>Start New Discussion</Text>
        </TouchableOpacity>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <MaterialIcons name="forum" size={60} color={isDarkMode ? '#444' : '#ccc'} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No discussions yet</Text>
          <Text style={[styles.emptyText, { color: theme.subText }]}>Be the first to start a discussion!</Text>
        </View>
      }
    />
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={[styles.loadingText, { color: theme.subText }]}>Loading community...</Text>
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
          <Text style={styles.headerTitle}>Community</Text>
          <TouchableOpacity style={styles.searchButton}>
            <Ionicons name="search" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>Connect with fellow {activeLanguage?.name || 'Izon'} learners</Text>

      </LinearGradient>

      <View style={[styles.tabsContainer, { backgroundColor: theme.card, shadowColor: isDarkMode ? '#000' : '#000' }]}>
        {COMMUNITY_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { borderBottomWidth: 2, borderBottomColor: theme.primary }]}
            onPress={() => {
              haptics.impactLight();
              setActiveTab(tab.id);
            }}
          >
            <MaterialIcons name={tab.icon} size={22} color={activeTab === tab.id ? theme.primary : theme.subText} />
            <Text style={[styles.tabText, { color: activeTab === tab.id ? theme.primary : theme.subText }]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'feed' && (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.feedList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />}
          onEndReached={loadMoreFeed}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.loadMoreIndicator} color="#4CAF50" /> : null
          }
        />
      )}

      {activeTab === 'friends' && renderFriendsTab()}
      {activeTab === 'leaderboard' && renderLeaderboardTab()}
      {activeTab === 'discussions' && renderDiscussionsTab()}
      {activeTab === 'reviews' && renderReviewsTab()}

      {activeTab === 'feed' && (
        <TouchableOpacity style={styles.fab} onPress={() => setPostModalVisible(true)}>
          <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.fabGradient}>
            <MaterialIcons name="add" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Create Post Modal */}
      <Modal animationType="slide" transparent visible={postModalVisible} onRequestClose={() => setPostModalVisible(false)}>
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient colors={theme.headerGradient} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity onPress={() => setPostModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              <TextInput
                style={[styles.postInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                placeholder="What would you like to share?"
                placeholderTextColor={theme.subText}
                value={newPostContent}
                onChangeText={setNewPostContent}
                multiline
                numberOfLines={5}
              />
              <TouchableOpacity
                style={[styles.postButton, { backgroundColor: theme.primary }, creatingPost && styles.postButtonDisabled]}
                onPress={handleCreatePost}
                disabled={creatingPost}
              >
                {creatingPost ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.postButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>

      {/* Comment Modal */}
      <Modal animationType="slide" transparent visible={commentModalVisible} onRequestClose={() => setCommentModalVisible(false)}>
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient colors={theme.headerGradient} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              <Text style={[styles.commentPostPreview, { backgroundColor: theme.background, color: theme.subText }]}>{selectedPost?.content?.substring(0, 100)}...</Text>
              
              {loadingComments ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 15 }} />
              ) : (
                <FlatList
                  data={comments}
                  keyExtractor={(item) => item._id}
                  style={styles.commentsList}
                  renderItem={({ item }) => (
                    <View style={[styles.commentItem, { borderBottomColor: theme.border }]}>
                      <View style={styles.commentHeader}>
                        <Text style={[styles.commentUser, { color: theme.text }]}>{item.user?.username}</Text>
                        <Text style={[styles.commentTimestamp, { color: theme.subText }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                      </View>
                      <Text style={[styles.commentText, { color: theme.subText }]}>{item.content}</Text>
                    </View>
                  )}
                  ListEmptyComponent={<Text style={[styles.emptyComments, { color: theme.subText }]}>No comments yet. Be the first to reply!</Text>}
                />
              )}

              <View style={styles.commentInputWrapper}>
                <TextInput
                  style={[styles.commentInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="Write your comment..."
                  placeholderTextColor={theme.subText}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.commentSendBtn, { backgroundColor: theme.primary }, submittingComment && styles.postButtonDisabled]}
                  onPress={handleAddComment}
                  disabled={submittingComment}
                >
                  {submittingComment ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>
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
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  searchButton: { padding: 8 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 5 },
  
  tabsContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  tabText: { fontSize: 14 },
  
  feedList: { padding: 15, gap: 15, paddingBottom: 80 },
  postCard: { borderRadius: 15, padding: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  postAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  postAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  postUserInfo: { flex: 1 },
  postUserName: { fontSize: 16, fontWeight: 'bold' },
  postTimestamp: { fontSize: 12, marginTop: 2 },
  postContent: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  postLessonBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, alignSelf: 'flex-start', marginBottom: 12 },
  postLessonText: { fontSize: 12 },
  postActions: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12, gap: 20 },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postActionText: { fontSize: 14 },
  
  friendsSection: { padding: 15 },
  requestsSection: { padding: 15, borderBottomWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  friendCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 12, elevation: 2 },
  friendAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  friendAvatarImage: { width: 50, height: 50, borderRadius: 25 },
  friendAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  friendStreak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  friendStreakText: { fontSize: 12 },
  messageButton: { padding: 8 },
  
  requestCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 12, elevation: 2 },
  requestAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  requestAvatarImage: { width: 50, height: 50, borderRadius: 25 },
  requestAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  requestInfo: { flex: 1 },
  requestName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  requestTime: { fontSize: 12 },
  requestActions: { flexDirection: 'row', gap: 8 },
  requestButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  acceptButtonText: { fontSize: 12, fontWeight: '600' },
  rejectButtonText: { fontSize: 12 },
  
  discussionsList: { padding: 15, gap: 12, paddingBottom: 80 },
  discussionCard: { padding: 15, borderRadius: 15, elevation: 2 },
  discussionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  discussionTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  discussionPreview: { fontSize: 14, marginBottom: 10, lineHeight: 20 },
  discussionMeta: { marginBottom: 12 },
  discussionAuthor: { fontSize: 12, marginBottom: 4 },
  discussionStats: { fontSize: 11 },
  joinDiscussionButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, alignSelf: 'flex-start' },
  joinDiscussionText: { fontSize: 12, fontWeight: '600' },
  newDiscussionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, marginBottom: 15, gap: 8 },
  newDiscussionText: { fontSize: 16, fontWeight: '600' },
  
  leaderboardContainer: { flex: 1, margin: 15, borderRadius: 20, overflow: 'hidden', elevation: 3 },
  leaderboardHeader: { padding: 20, alignItems: 'center' },
  leaderboardTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  leaderboardSubtitle: { fontSize: 12, color: '#fff', opacity: 0.9, marginTop: 4 },
  leaderboardList: { padding: 15 },
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  leaderboardRank: { width: 40, fontSize: 16, fontWeight: 'bold' },
  leaderboardUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  leaderboardAvatar: { width: 35, height: 35, borderRadius: 17.5, justifyContent: 'center', alignItems: 'center' },
  leaderboardAvatarImage: { width: 35, height: 35, borderRadius: 17.5 },
  leaderboardAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  leaderboardUsername: { fontSize: 14, fontWeight: '500' },
  leaderboardPoints: { fontSize: 14, fontWeight: 'bold' },
  
  fab: { position: 'absolute', bottom: 20, right: 20 },
  fabGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalBody: { padding: 20 },
  postInput: { borderWidth: 1, borderRadius: 10, padding: 15, fontSize: 16, minHeight: 120, textAlignVertical: 'top', marginBottom: 15 },
  commentPostPreview: { padding: 12, borderRadius: 10, marginBottom: 15, fontSize: 14 },
  commentInput: { flex: 1, minHeight: 45, maxHeight: 100, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 14, borderWidth: 1 },
  commentsList: { maxHeight: 300, marginVertical: 10 },
  commentItem: { paddingVertical: 10, borderBottomWidth: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentUser: { fontSize: 13, fontWeight: 'bold' },
  commentText: { fontSize: 14, lineHeight: 18 },
  emptyComments: { textAlign: 'center', marginVertical: 20, fontStyle: 'italic' },
  commentInputWrapper: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 },
  commentSendBtn: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  postButton: { padding: 15, borderRadius: 10, alignItems: 'center' },
  postButtonDisabled: { opacity: 0.7 },
  postButtonText: { fontSize: 16, fontWeight: 'bold' },
  
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  loadMoreIndicator: { paddingVertical: 20 },
  userNameContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniAddButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  miniAddButtonText: { fontSize: 12, fontWeight: '600' },
});