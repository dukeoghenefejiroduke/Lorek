import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';

import { ThemeContext, lightTheme } from '../context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
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
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { BlurView } from 'expo-blur';

import { communityAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');

// ============================================================================
// COMPONENTS
// ============================================================================

const ReplyItem = ({ reply, isLast, onLike, onReply, currentUser }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(reply.likes?.length || 0);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleLike = () => {
    haptics.impactLight();
    if (liked) {
      setLikeCount(likeCount - 1);
    } else {
      setLikeCount(likeCount + 1);
    }
    setLiked(!liked);
    onLike(reply._id);
  };

  const handleReply = () => {
    if (!replyText.trim()) {
      Alert.alert('Error', 'Please enter a reply');
      return;
    }
    onReply(reply._id, replyText);
    setReplyText('');
    setShowReplyInput(false);
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

  return (
    <View style={[styles.replyItem, !isLast && styles.replyItemBorder]}>
      <View style={styles.replyHeader}>
        <TouchableOpacity style={styles.replyAvatar}>
          {reply.user?.profile?.avatar?.thumbnail ? (
            <Image source={{ uri: reply.user.profile.avatar.thumbnail }} style={styles.replyAvatarImage} />
          ) : (
            <Text style={styles.replyAvatarText}>
              {reply.user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          )}
        </TouchableOpacity>
        <View style={styles.replyUserInfo}>
          <Text style={styles.replyUserName}>{reply.user?.username}</Text>
          <Text style={styles.replyTime}>{formatTime(reply.createdAt)}</Text>
        </View>
      </View>

      <Text style={styles.replyContent}>{reply.content}</Text>

      <View style={styles.replyActions}>
        <TouchableOpacity style={styles.replyAction} onPress={handleLike}>
          <MaterialIcons name={liked ? 'favorite' : 'favorite-border'} size={18} color={liked ? '#f44336' : '#999'} />
          <Text style={styles.replyActionText}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.replyAction} onPress={() => setShowReplyInput(!showReplyInput)}>
          <MaterialIcons name="reply" size={18} color="#999" />
          <Text style={styles.replyActionText}>Reply</Text>
        </TouchableOpacity>
      </View>

      {showReplyInput && (
        <View style={styles.replyInputContainer}>
          <TextInput
            style={styles.replyInput}
            placeholder="Write a reply..."
            placeholderTextColor="#999"
            value={replyText}
            onChangeText={setReplyText}
            multiline
          />
          <View style={styles.replyInputActions}>
            <TouchableOpacity onPress={() => setShowReplyInput(false)}>
              <Text style={styles.cancelReplyText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitReplyButton} onPress={handleReply}>
              <Text style={styles.submitReplyText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function DiscussionDetailScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const { discussionId } = route.params;

  const [discussion, setDiscussion] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in DiscussionDetailScreen.js:', contextValue);
  const { isDarkMode, theme } = contextValue;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const inputRef = useRef(null);

  useEffect(() => {
    loadDiscussion();
    startAnimations();
  }, [discussionId]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const loadDiscussion = async () => {
    try {
      setLoading(true);
      const response = await communityAPI.getDiscussion(discussionId);
      if (response.data.success) {
        setDiscussion(response.data.data);
        setReplies(response.data.data.replies || []);
      }
    } catch (error) {
      console.error('Failed to load discussion:', error);
      Alert.alert('Error', 'Failed to load discussion');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDiscussion();
    setRefreshing(false);
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim()) {
      Alert.alert('Error', 'Please enter a reply');
      return;
    }

    setSubmitting(true);
    try {
      const response = await communityAPI.replyToDiscussion(discussionId, { content: replyText });
      if (response.data.success) {
        setReplyText('');
        await loadDiscussion();
        haptics.notificationSuccess();
        // Scroll to bottom
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeReply = async (replyId) => {
    try {
      await communityAPI.likeReply(discussionId, replyId);
    } catch (error) {
      console.error('Failed to like reply:', error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${discussion?.title}\n\n${discussion?.content}\n\nJoin the discussion on Lorek App!`,
        title: discussion?.title,
      });
      setShowShareModal(false);
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Error', 'Please provide a reason');
      return;
    }

    setReporting(true);
    try {
      await communityAPI.reportDiscussion(discussionId, { reason: reportReason });
      Alert.alert('Report Submitted', 'Thank you for helping keep our community safe');
      setReportModalVisible(false);
      setReportReason('');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report');
    } finally {
      setReporting(false);
    }
  };

  const handlePin = async () => {
    if (user?.role !== 'admin') return;
    try {
      await communityAPI.pinDiscussion(discussionId, { pinned: !discussion?.pinned });
      await loadDiscussion();
      haptics.notificationSuccess();
    } catch (error) {
      Alert.alert('Error', 'Failed to pin discussion');
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

  const renderReply = ({ item, index }) => (
    <ReplyItem
      reply={item}
      isLast={index === replies.length - 1}
      onLike={handleLikeReply}
      onReply={handleSubmitReply}
      currentUser={user}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading discussion...</Text>
      </View>
    );
  }

  if (!discussion) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={60} color="#f44336" />
        <Text style={styles.errorText}>Discussion not found</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

      {/* Header */}
      <LinearGradient
        colors={['#1a4c2e', '#2e7d32', '#43a047']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Discussion</Text>
          <TouchableOpacity style={styles.menuButton} onPress={() => setShowShareModal(true)}>
            <MaterialIcons name="more-vert" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={replies}
          renderItem={renderReply}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.repliesList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />}
          ListHeaderComponent={
            <Animated.View style={[styles.discussionCard, { backgroundColor: theme.card, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              {/* Pinned Badge */}
              {discussion.pinned && (
                <View style={styles.pinnedBadge}>
                  <MaterialIcons name="push-pin" size={14} color="#fff" />
                  <Text style={styles.pinnedText}>Pinned</Text>
                </View>
              )}

              {/* Author Info */}
              <View style={styles.authorSection}>
                <TouchableOpacity style={styles.authorAvatar}>
                  {discussion.author?.profile?.avatar?.thumbnail ? (
                    <Image source={{ uri: discussion.author.profile.avatar.thumbnail }} style={styles.authorAvatarImage} />
                  ) : (
                    <Text style={styles.authorAvatarText}>
                      {discussion.author?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  )}
                </TouchableOpacity>
                <View style={styles.authorInfo}>
                  <Text style={[styles.authorName, { color: theme.text }]}>{discussion.author?.username}</Text>
                  <Text style={styles.authorTime}>{formatTime(discussion.createdAt)}</Text>
                </View>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{discussion.category}</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={styles.discussionTitle}>{discussion.title}</Text>

              {/* Content */}
              <Text style={styles.discussionContent}>{discussion.content}</Text>

              {/* Stats */}
              <View style={styles.discussionStats}>
                <View style={styles.statItem}>
                  <MaterialIcons name="chat-bubble-outline" size={18} color="#666" />
                  <Text style={[styles.statText, { color: theme.subText }]}>{discussion.replyCount || 0} replies</Text>
                </View>
                <View style={styles.statItem}>
                  <MaterialIcons name="visibility" size={18} color="#666" />
                  <Text style={[styles.statText, { color: theme.subText }]}>{discussion.views || 0} views</Text>
                </View>
              </View>
            </Animated.View>
          }
          ListFooterComponent={
            <View style={styles.replySection}>
              <Text style={[styles.replySectionTitle, { color: theme.text }]}>
                {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
              </Text>
              {replies.length === 0 && (
                <View style={styles.noReplies}>
                  <MaterialIcons name="forum" size={50} color="#ccc" />
                  <Text style={styles.noRepliesText}>No replies yet</Text>
                  <Text style={styles.noRepliesSubtext}>Be the first to join the discussion!</Text>
                </View>
              )}
            </View>
          }
        />

        {/* Reply Input */}
        <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Write a reply..."
              placeholderTextColor="#999"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!replyText.trim() || submitting) && styles.sendButtonDisabled]}
              onPress={handleSubmitReply}
              disabled={!replyText.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.charCount}>{replyText.length}/500</Text>
        </View>
      </KeyboardAvoidingView>

      {/* Share/Report Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showShareModal}
        onRequestClose={() => setShowShareModal(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient colors={['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Options</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              <TouchableOpacity style={styles.modalOption} onPress={handleShare}>
                <MaterialIcons name="share" size={24} color="#4CAF50" />
                <Text style={[styles.modalOptionText, { color: theme.text }]}>Share Discussion</Text>
              </TouchableOpacity>

              {user?.role === 'admin' && (
                <TouchableOpacity style={styles.modalOption} onPress={handlePin}>
                  <MaterialIcons name={discussion.pinned ? 'push-pin' : 'push-pin'} size={24} color="#FF9800" />
                  <Text style={[styles.modalOptionText, { color: theme.text }]}>
                    {discussion.pinned ? 'Unpin Discussion' : 'Pin Discussion'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.modalOption} onPress={() => {
                setShowShareModal(false);
                setReportModalVisible(true);
              }}>
                <MaterialIcons name="flag" size={24} color="#f44336" />
                <Text style={[styles.modalOptionText, styles.reportText]}>Report Discussion</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* Report Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient colors={['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Discussion</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              <Text style={[styles.reportLabel, { color: theme.text }]}>Why are you reporting this discussion?</Text>
              <TextInput
                style={styles.reportInput}
                placeholder="Enter your reason..."
                placeholderTextColor="#999"
                value={reportReason}
                onChangeText={setReportReason}
                multiline
                numberOfLines={4}
              />
              <TouchableOpacity
                style={[styles.reportButton, (!reportReason.trim() || reporting) && styles.reportButtonDisabled]}
                onPress={handleReport}
                disabled={!reportReason.trim() || reporting}
              >
                {reporting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.reportButtonText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 10,
    marginBottom: 20,
  },
  goBackButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  menuButton: {
    padding: 8,
  },
  keyboardView: {
    flex: 1,
  },
  repliesList: {
    padding: 15,
    paddingBottom: 20,
  },
  discussionCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
    alignSelf: 'flex-start',
    marginBottom: 15,
    gap: 4,
  },
  pinnedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  authorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  authorAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  authorAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  authorTime: {
    fontSize: 12,
    color: '#999',
  },
  categoryBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  categoryText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  discussionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a4c2e',
    marginBottom: 15,
    lineHeight: 30,
  },
  discussionContent: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
    marginBottom: 15,
  },
  discussionStats: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
  },
  replySection: {
    marginTop: 10,
  },
  replySectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  noReplies: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noRepliesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 10,
  },
  noRepliesSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 5,
  },
  replyItem: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
  },
  replyItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  replyAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  replyAvatarImage: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
  },
  replyAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  replyUserInfo: {
    flex: 1,
  },
  replyUserName: {
    fontSize: 14,
    fontWeight: '600',
  },
  replyTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  replyContent: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 10,
  },
  replyActions: {
    flexDirection: 'row',
    gap: 15,
  },
  replyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyActionText: {
    fontSize: 12,
    color: '#999',
  },
  replyInputContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  replyInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  replyInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  cancelReplyText: {
    color: '#999',
    fontSize: 14,
  },
  submitReplyButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 15,
  },
  submitReplyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    padding: 12,
    paddingHorizontal: 15,
    fontSize: 15,
    backgroundColor: '#fafafa',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  charCount: {
    fontSize: 10,
    color: '#999',
    textAlign: 'right',
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
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
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
  },
  reportText: {
    color: '#f44336',
  },
  reportLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  reportInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fafafa',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  reportButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  reportButtonDisabled: {
    opacity: 0.7,
  },
  reportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});