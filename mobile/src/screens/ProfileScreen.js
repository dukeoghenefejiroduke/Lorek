import React, { useContext, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Linking,
  Image,
  Switch,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  Modal,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from "../utils/haptics";
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { AuthContext } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';

import { progressAPI, gamificationAPI, userAPI, notificationAPI } from '../services/api';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { isDarkMode, toggleTheme, theme } = useContext(ThemeContext);
  const { user, logout } = useContext(AuthContext);
  const navigation = useNavigation();

  // State
  const [notifications, setNotifications] = useState(true);
  const [profileImage, setProfileImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  const [liveStats, setLiveStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Sample user stats
  const userStats = {
    streak: 12,
    points: 2450,
    lessonsCompleted: 18,
    wordsLearned: 187,
    achievements: 8,
    rank: 'Bronze Learner',
    nextRank: 'Silver Learner',
    rankProgress: 65,
  };

useEffect(() => {
  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [progressRes, profileRes] = await Promise.all([
        progressAPI.get(),
        userAPI.getProfile()
      ]);

      if (progressRes.data?.data) {
        const data = progressRes.data.data;
        setLiveStats({
          streak: data.progress?.currentStreak || 0,
          points: data.progress?.totalPoints || 0,
          lessonsCompleted: data.progress?.completedLessons || 0,
          wordsLearned: data.vocabulary?.totalLearned || 0,
          rank: data.rank?.rank || 'New Learner',
          rankProgress: data.progress?.completionRate || 0, 
          nextRank: data.rank?.nextRank || 'Rising Star',
          achievements: data.achievements?.total || 0,
        });
      }
      
      if (profileRes.data?.avatarUrl) {
        setProfileImage(profileRes.data.avatarUrl);
      }
    } catch (error) {
      console.error("Failed to fetch profile data:", error);
      setLiveStats(userStats);
    } finally {
      setLoading(false);
    }
  };

  fetchProfileData();
}, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 20000, useNativeDriver: true })
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleLogout = () => {
    haptics.impactMedium();
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => { haptics.notificationSuccess(); logout(); }, style: 'destructive' },
    ]);
  };

const uploadImage = async (uri) => {
  try {
    const formData = new FormData();
    formData.append('avatar', {
      uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      type: 'image/jpeg',
      name: 'profile_avatar.jpg',
    });

    const response = await userAPI.uploadAvatar(formData);
    if (response.data) {
      setProfileImage(response.data.url);
      haptics.notificationSuccess();
    }
  } catch (error) {
    Alert.alert('Upload Failed', 'Could not sync.');
  }
};

const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (!result.canceled) {
    setShowImageModal(false);
    await uploadImage(result.assets[0].uri);
  }
};

const takePhoto = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please grant camera permissions.');
    return;
  }

  const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });

  if (!result.canceled) {
    setShowImageModal(false);
    await uploadImage(result.assets[0].uri);
  }
};

  const MenuItem = ({ icon, label, onPress, value, badge, color = theme.primary }) => (
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: theme.border }]}
      onPress={() => { haptics.impactLight(); onPress(); }}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: `${color}20` }]}>
        <Text style={styles.menuIcon}>{icon}</Text>
      </View>
      <Text style={[styles.menuText, { color: theme.text }]}>{label}</Text>
      {value && <Text style={[styles.menuValue, { color: theme.subText }]}>{value}</Text>}
      {badge && <View style={[styles.menuBadge, { backgroundColor: color }]}><Text style={styles.menuBadgeText}>{badge}</Text></View>}
      <MaterialIcons name="chevron-right" size={20} color={theme.subText} />
    </TouchableOpacity>
  );

  const StatCard = ({ icon, value, label, color }) => (
    <Animated.View style={[styles.statCard, { opacity: fadeAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.card }]}>
      <LinearGradient colors={[`${color}20`, `${color}10`]} style={styles.statGradient}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
      </LinearGradient>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={isDarkMode ? '#000' : theme.headerGradient[1]} />

      <Animated.View style={[styles.backgroundPattern, { transform: [{ rotate }] }]}>
        <Text style={[styles.patternText, { color: theme.text }]}>⚡ 𖦹 🔱 ⚡ 𖦹 🔱</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <LinearGradient colors={theme.headerGradient} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettingsModal(true)}>
              <Ionicons name="settings-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile')}>
              <MaterialIcons name="edit" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity style={styles.avatar} onPress={() => setShowImageModal(true)} activeOpacity={0.8}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.avatarGradient}>
                  <Text style={styles.avatarText}>{user?.username?.charAt(0)?.toUpperCase() || '?'}</Text>
                </LinearGradient>
              )}
              <View style={styles.avatarBadge}><MaterialIcons name="camera-alt" size={14} color="#fff" /></View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.username}>{user?.username || 'User'}</Text>
            <Text style={styles.email}>{user?.email || 'email@example.com'}</Text>
            <View style={styles.rankBadge}>
              <FontAwesome5 name="crown" size={12} color="#FFD700" />
              <Text style={styles.rankText}>{liveStats?.rank || 'New Learner'}</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <StatCard icon="🔥" value={liveStats?.streak || 0} label="Day Streak" color="#FF6B6B" />
          <StatCard icon="⭐" value={liveStats?.points || 0} label="Points" color="#FFD700" />
          <StatCard icon="📚" value={liveStats?.lessonsCompleted || 0} label="Lessons" color="#4CAF50" />
          <StatCard icon="📖" value={liveStats?.wordsLearned || 0} label="Words" color="#2196F3" />
        </View>

        <Animated.View style={[styles.rankCard, { backgroundColor: theme.card, opacity: fadeAnim }]}>
          <View style={styles.rankHeader}>
            <View>
              <Text style={[styles.rankTitle, { color: theme.subText }]}>Next Rank</Text>
              <Text style={[styles.rankName, { color: theme.primary }]}>{liveStats?.nextRank || '...'}</Text>
            </View>
            <FontAwesome5 name="medal" size={30} color={theme.accent} />
          </View>
          <View style={styles.rankProgress}>
            <View style={[styles.rankProgressBar, { backgroundColor: theme.border }]}>
              <View style={[styles.rankProgressFill, { width: `${Math.min(100, Math.max(0, liveStats?.rankProgress || 0))}%`, backgroundColor: theme.primary }]} />
            </View>
            <Text style={[styles.rankProgressText, { color: theme.subText }]}>{liveStats?.rankProgress || 0}% Complete</Text>
          </View>
        </Animated.View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Account</Text>
          <MenuItem icon="✨" label="Go Premium" onPress={() => navigation.navigate('Premium')} color="#FFD700" />
          <MenuItem icon="👤" label="Edit Profile" onPress={() => navigation.navigate('EditProfile')} color="#4CAF50" />
          <MenuItem icon="🏆" label="Achievements" onPress={() => navigation.navigate('Achievements')} value={`${userStats.achievements} earned`} color="#FFD700" />
          <MenuItem icon="📊" label="Progress" onPress={() => navigation.navigate('Progress')} color="#2196F3" />
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Learning Preferences</Text>
          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Mode</Text>
            <Switch value={isDarkMode} onValueChange={toggleTheme} trackColor={{ false: '#767577', true: theme.primary }} />
          </View>
          <MenuItem icon="🎯" label="Daily Goal" onPress={() => navigation.navigate('DailyGoal')} value="20 min" color="#FF9800" />
          <MenuItem icon="⏰" label="Reminders" onPress={() => navigation.navigate('Reminders')} value="9:00 AM" color="#9C27B0" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundPattern: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  patternText: { fontSize: 40 },
  scrollContent: { flexGrow: 1, paddingBottom: 30 },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, alignItems: 'center' },
  headerContent: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  settingsButton: { padding: 8 },
  editButton: { padding: 8 },
  avatarContainer: { marginBottom: 15 },
  avatar: { position: 'relative' },
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#FFD700' },
  avatarGradient: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFD700' },
  avatarText: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#4CAF50', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  username: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 5 },
  email: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 10 },
  rankBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, alignSelf: 'center', gap: 6 },
  rankText: { color: '#FFD700', fontSize: 12, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 15, marginTop: -20 },
  statCard: { width: (width - 50) / 2, marginBottom: 10, borderRadius: 15, overflow: 'hidden' },
  statGradient: { padding: 15, alignItems: 'center' },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
  statLabel: { fontSize: 11 },
  rankCard: { marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 15 },
  rankHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rankTitle: { fontSize: 14, marginBottom: 4 },
  rankName: { fontSize: 18, fontWeight: 'bold' },
  rankProgress: { marginTop: 8 },
  rankProgressBar: { height: 6, borderRadius: 3, marginBottom: 4 },
  rankProgressFill: { height: '100%', borderRadius: 3 },
  rankProgressText: { fontSize: 11, textAlign: 'right' },
  section: { marginHorizontal: 15, marginBottom: 15, borderRadius: 15, overflow: 'hidden' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', paddingHorizontal: 20, paddingVertical: 12, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1 },
  menuIconContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuIcon: { fontSize: 18 },
  menuText: { flex: 1, fontSize: 16 },
  menuValue: { fontSize: 14, marginRight: 8 },
  menuBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginRight: 8 },
  menuBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1 },
  settingLabel: { fontSize: 16 },
});
