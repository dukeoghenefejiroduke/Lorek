import React, { useContext, useState, useEffect, useCallback } from 'react';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import haptics from "../utils/haptics";
import LoadingOverlay from '../components/LoadingOverlay';

import { userAPI, communityAPI, progressAPI, messagesAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');

// ============================================================================
// COMPONENTS
// ============================================================================

const StatCard = ({ icon, label, value, color, theme }) => (
  <View style={[styles.statCard, { backgroundColor: theme.card }]}>
    <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
      <MaterialIcons name={icon} size={22} color={color} />
    </View>
    <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
  </View>
);

const BadgeItem = ({ badge, theme }) => (
  <View style={[styles.badgeItem, { backgroundColor: theme.backgroundElement }]}>
    <Text style={styles.badgeIcon}>{badge.icon || '🏅'}</Text>
    <View style={styles.badgeInfo}>
      <Text style={[styles.badgeName, { color: theme.text }]}>{badge.name}</Text>
      <Text style={styles.badgeDate}>{formatDate(badge.dateEarned)}</Text>
    </View>
  </View>
);

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function UserProfileScreen({ navigation, route }) {
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in UserProfileScreen.js:', contextValue);
  const { theme } = contextValue;
  const { user: currentUser } = useContext(AuthContext);
  const { userId } = route.params;
  
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  const isOwnProfile = currentUser?._id === userId;

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      
      const profileResponse = await userAPI.getUserProfile(userId);
      const statsResponse = await userAPI.getUserStats(userId);
      const badgesResponse = await userAPI.getUserBadges(userId);
      const activityResponse = await userAPI.getUserActivity(userId);
      
      if (profileResponse.data.success) {
        setProfile(profileResponse.data.data);
      }
      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }
      if (badgesResponse.data.success) {
        setBadges(badgesResponse.data.data);
      }
      if (activityResponse.data.success) {
        setRecentActivity(activityResponse.data.data);
      }
      
      if (!isOwnProfile && currentUser) {
        const friendsResponse = await communityAPI.getFriends();
        if (friendsResponse.data.success) {
          const isFriendExists = friendsResponse.data.data.some(f => f.id === userId);
          setIsFriend(isFriendExists);
          
          const requestsResponse = await communityAPI.getFriendRequests();
          if (requestsResponse.data.success) {
            const requestExists = requestsResponse.data.data.some(r => r.from?.id === userId);
            setFriendRequestSent(requestExists);
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to load user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserProfile();
    setRefreshing(false);
  };

  const handleSendFriendRequest = async () => {
    haptics.impactMedium();
    setSendingRequest(true);
    
    try {
      await communityAPI.sendFriendRequest(userId);
      setFriendRequestSent(true);
      Alert.alert('Request Sent', `Friend request sent to ${profile?.username}`);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to send friend request');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out ${profile?.username}'s profile on Lorek App!\n\nLevel: ${stats?.level || 1} | Points: ${stats?.totalPoints || 0} | Streak: ${stats?.streak || 0} days`,
        title: `${profile?.username}'s Profile`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

const handleMessage = async () => { 
  try {
    const response = await messagesAPI.createConversation({
      userId: userId
    });
    
    if (response.data.success) {
      navigation.replace('ChatDetail', {
        conversationId: response.data.data._id,
        otherUser: profile,
      });
    }
  } catch (error) {
    Alert.alert('Error', 'Could not open conversation');
    console.error(error);
  } 
};
   
  if (loading) {
    return <LoadingOverlay visible={loading} message="Loading profile..." />;
  }

  if (!profile) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
        <MaterialIcons name="person-off" size={60} color={theme.subText} />
        <Text style={[styles.errorText, { color: theme.text }]}>User not found</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

      <LinearGradient
        colors={['#1a4c2e', '#2e7d32', '#43a047']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isOwnProfile ? 'My Profile' : profile?.username}
          </Text>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareProfile}>
            <MaterialIcons name="share" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />}
      >
        <View style={[styles.profileHeader, { backgroundColor: theme.card }]}>
          <View style={styles.avatarContainer}>
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={['#4CAF50', '#2E7D32']}
                style={styles.avatarPlaceholder}
              >
                <Text style={styles.avatarText}>
                  {profile?.username?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </LinearGradient>
            )}
          </View>
          
          <Text style={[styles.username, { color: theme.text }]}>{profile?.username}</Text>
          {profile?.fullName && (
            <Text style={[styles.fullName, { color: theme.subText }]}>{profile.fullName}</Text>
          )}
          {profile?.bio && (
            <Text style={[styles.bio, { color: theme.subText }]}>{profile.bio}</Text>
          )}
          
          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              {!isFriend && !friendRequestSent ? (
                <TouchableOpacity
                  style={styles.addFriendButton}
                  onPress={handleSendFriendRequest}
                  disabled={sendingRequest}
                >
                  {sendingRequest ? (
                    <LoadingOverlay visible={sendingRequest} message="Sending..." />
                  ) : (
                    <>
                      <MaterialIcons name="person-add" size={20} color="#fff" />
                      <Text style={styles.addFriendText}>Add Friend</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : friendRequestSent && !isFriend ? (
                <View style={styles.requestSentButton}>
                  <MaterialIcons name="pending" size={20} color="#4CAF50" />
                  <Text style={styles.requestSentText}>Request Sent</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
                  <MaterialIcons name="message" size={20} color="#fff" />
                  <Text style={styles.messageText}>Message</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {stats && (
          <View style={styles.statsGrid}>
            <StatCard icon="stars" label="Total Points" value={stats.totalPoints || 0} color="#FFD700" theme={theme} />
            <StatCard icon="whatshot" label="Day Streak" value={stats.streak || 0} color="#FF6B6B" theme={theme} />
            <StatCard icon="school" label="Words Learned" value={stats.wordsLearned || 0} color="#4CAF50" theme={theme} />
            <StatCard icon="menu-book" label="Lessons" value={stats.lessonsCompleted || 0} color="#2196F3" theme={theme} />
          </View>
        )}

        {stats && (
          <View style={[styles.levelCard, { backgroundColor: theme.card }]}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelTitle}>Level {stats.level || 1}</Text>
              <Text style={[styles.levelPoints, { color: theme.subText }]}>{stats.totalPoints || 0} / {(stats.level || 1) * 100} XP</Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${((stats.totalPoints || 0) / ((stats.level || 1) * 100)) * 100}%` }
                ]} 
              />
            </View>
          </View>
        )}

        {badges.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                <FontAwesome5 name="medal" size={16} color="#FFD700" /> Badges & Achievements
              </Text>
              <Text style={[styles.sectionCount, { color: theme.subText }]}>{badges.length} total</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {badges.map((badge, index) => (
                <BadgeItem key={index} badge={badge} theme={theme} />
              ))}
            </ScrollView>
          </View>
        )}

        {recentActivity.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              <MaterialIcons name="history" size={16} color="#666" /> Recent Activity
            </Text>
            {recentActivity.map((activity, index) => (
              <View key={index} style={[styles.activityItem, { borderBottomColor: theme.border }]}>
                <View style={styles.activityIcon}>
                  {activity.type === 'lesson' && <MaterialIcons name="school" size={20} color="#4CAF50" />}
                  {activity.type === 'badge' && <FontAwesome5 name="medal" size={16} color="#FFD700" />}
                  {activity.type === 'streak' && <MaterialIcons name="whatshot" size={20} color="#FF6B6B" />}
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityText, { color: theme.text }]}>{activity.description}</Text>
                  <Text style={[styles.activityTime, { color: theme.subText }]}>{formatDate(activity.timestamp)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center' },
  shareButton: { padding: 8 },
  scrollContent: { paddingBottom: 30 },
  profileHeader: { alignItems: 'center', padding: 20, marginBottom: 15 },
  avatarContainer: { marginBottom: 15 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#FFD700' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFD700' },
  avatarText: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  username: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  fullName: { fontSize: 16, marginBottom: 8 },
  bio: { fontSize: 14, textAlign: 'center', marginBottom: 15, lineHeight: 20 },
  actionButtons: { flexDirection: 'row', gap: 12 },
  addFriendButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, gap: 8 },
  addFriendText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  requestSentButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, gap: 8 },
  requestSentText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  messageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2196F3', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, gap: 8 },
  messageText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 15, gap: 10 },
  statCard: { borderRadius: 15, padding: 15, alignItems: 'center', width: (width - 45) / 2, elevation: 3 },
  statIconContainer: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  levelCard: { borderRadius: 15, padding: 20, marginHorizontal: 15, marginBottom: 15, elevation: 3 },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  levelTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a4c2e' },
  levelPoints: { fontSize: 12 },
  progressBar: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  section: { borderRadius: 15, padding: 20, marginHorizontal: 15, marginBottom: 15, elevation: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  sectionCount: { fontSize: 12 },
  badgeItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, marginRight: 10, minWidth: 150 },
  badgeIcon: { fontSize: 28, marginRight: 10 },
  badgeInfo: { flex: 1 },
  badgeName: { fontSize: 14, fontWeight: '600' },
  badgeDate: { fontSize: 10, color: '#999', marginTop: 2 },
  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  activityIcon: { width: 35, alignItems: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 14, marginBottom: 4 },
  activityTime: { fontSize: 11, color: '#999' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 18, marginTop: 10, marginBottom: 20 },
  goBackButton: { backgroundColor: '#4CAF50', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 },
  goBackButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
