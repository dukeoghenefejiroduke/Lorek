import React, { useEffect, useState, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  StatusBar,
  Modal,
  Easing,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import haptics from '../utils/haptics';
import { ThemeContext, lightTheme as theme } from '../context/ThemeContext';

import { leaderboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const LeaderboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [timeFilter, setTimeFilter] = useState('weekly');
  const [categoryFilter, setCategoryFilter] = useState('points');
  const [userRank, setUserRank] = useState(null);
  
  const { isDarkMode, theme } = useContext(ThemeContext);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const interpolatedRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await leaderboardAPI.getLeaderboard({
        period: timeFilter,
        category: categoryFilter,
        limit: 50,
      });
      
      if (response.data.success) {
        setLeaderboard(response.data.data.leaderboard);
        setUserRank(response.data.data.userRank);
      }
    } catch (error) {
      console.error('Leaderboard fetch failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeFilter, categoryFilter]);

  useEffect(() => {
    loadLeaderboard();
    
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [loadLeaderboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
  };

  const handleFilterChange = (filter, value) => {
    if (filter === 'time') setTimeFilter(value);
    else if (filter === 'category') setCategoryFilter(value);
    haptics.impactLight();
  };

  const getRankColor = (rank) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return theme.primary;
  };

  const getCategoryValue = (item) => {
    switch (categoryFilter) {
      case 'points': return `${item.points} XP`;
      case 'streak': return `${item.streak} days`;
      case 'words': return `${item.words} words`;
      case 'lessons': return `${item.lessons} lessons`;
      case 'accuracy': return `${item.accuracy}%`;
      default: return `${item.points} XP`;
    }
  };

  const renderTopThree = () => {
    const topThree = leaderboard.filter(item => item.rank <= 3);
    if (topThree.length === 0) return null;

    return (
      <Animated.View style={[styles.topThreeContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {topThree[1] && (
          <View style={[styles.topCard, styles.secondPlace, { backgroundColor: theme.card }]}>
             <View style={styles.topRankBadge}><Text style={styles.topRankText}>🥈</Text></View>
             {topThree[1]?.avatar ? <Image source={{ uri: topThree[1].avatar }} style={styles.topAvatar} /> : <View style={[styles.topAvatarPlaceholder, { backgroundColor: '#C0C0C0' }]}><Text style={styles.topAvatarText}>{topThree[1]?.username?.charAt(0)}</Text></View>}
             <Text style={[styles.topName, { color: theme.text }]}>{topThree[1]?.username}</Text>
             <Text style={[styles.topPoints, { color: theme.subText }]}>{getCategoryValue(topThree[1])}</Text>
          </View>
        )}
        {topThree[0] && (
          <View style={[styles.topCard, styles.firstPlace, { backgroundColor: theme.card }]}>
             <View style={styles.crownIcon}><FontAwesome5 name="crown" size={24} color="#FFD700" /></View>
             <View style={styles.topRankBadge}><Text style={styles.topRankText}>🥇</Text></View>
             {topThree[0]?.avatar ? <Image source={{ uri: topThree[0].avatar }} style={styles.topAvatar} /> : <View style={[styles.topAvatarPlaceholder, { backgroundColor: '#FFD700' }]}><Text style={styles.topAvatarText}>{topThree[0]?.username?.charAt(0)}</Text></View>}
             <Text style={[styles.topName, { color: theme.text }]}>{topThree[0]?.username}</Text>
             <Text style={[styles.topPoints, { color: theme.subText }]}>{getCategoryValue(topThree[0])}</Text>
          </View>
        )}
        {topThree[2] && (
          <View style={[styles.topCard, styles.thirdPlace, { backgroundColor: theme.card }]}>
             <View style={styles.topRankBadge}><Text style={styles.topRankText}>🥉</Text></View>
             {topThree[2]?.avatar ? <Image source={{ uri: topThree[2].avatar }} style={styles.topAvatar} /> : <View style={[styles.topAvatarPlaceholder, { backgroundColor: '#CD7F32' }]}><Text style={styles.topAvatarText}>{topThree[2]?.username?.charAt(0)}</Text></View>}
             <Text style={[styles.topName, { color: theme.text }]}>{topThree[2]?.username}</Text>
             <Text style={[styles.topPoints, { color: theme.subText }]}>{getCategoryValue(topThree[2])}</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderItem = ({ item, index }) => {
    const rankColor = getRankColor(item.rank);
    const maxPoints = leaderboard[0]?.points || 1000;

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <TouchableOpacity
          style={[styles.row, { backgroundColor: theme.card }, item.isCurrentUser && { borderWidth: 2, borderColor: theme.primary }]}
          onPress={() => { setSelectedUser(item); setModalVisible(true); haptics.impactLight(); }}
          activeOpacity={0.7}
        >
          <View style={[styles.rankContainer, { backgroundColor: `${rankColor}20` }]}><Text style={[styles.rankText, { color: rankColor }]}>{item.rank}</Text></View>
          <View style={styles.avatarContainer}>
            {item.avatar ? <Image source={{ uri: item.avatar }} style={styles.avatar} /> : <View style={[styles.avatarPlaceholder, { backgroundColor: rankColor }]}><Text style={styles.avatarText}>{item.username?.charAt(0)}</Text></View>}
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.username, { color: theme.text }]}>{item.username}</Text>
            <View style={[styles.progressBarContainer, { backgroundColor: theme.border }]}><View style={[styles.progressBar, { width: `${(item.points / maxPoints) * 100}%`, backgroundColor: rankColor }]} /></View>
          </View>
          <View style={styles.pointsContainer}><Text style={[styles.points, { color: rankColor }]}>{getCategoryValue(item)}</Text></View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.headerGradient[1]} />
      <Animated.View style={[styles.backgroundPattern, { transform: [{ rotate: interpolatedRotate }] }]}>
        <Text style={[styles.patternText, { color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>⚡ 𖦹 🔱 ⚡ 𖦹 🔱</Text>
      </Animated.View>
      <FlatList
        data={leaderboard.filter(item => item.rank > 3)}
        keyExtractor={(item) => item.user?._id.toString() || item.username}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
        ListHeaderComponent={
          <>
            <LinearGradient colors={theme.headerGradient} style={styles.header}>
              <View style={styles.headerContent}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity><Text style={styles.headerTitle}>Leaderboard</Text><View style={{width: 24}}/></View>
            </LinearGradient>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                {['weekly', 'monthly', 'allTime'].map((period) => (
                    <TouchableOpacity key={period} style={[styles.filterChip, { backgroundColor: timeFilter === period ? theme.primary : theme.card }]} onPress={() => handleFilterChange('time', period)}>
                        <Text style={{ color: timeFilter === period ? '#fff' : theme.text }}>{period}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            {renderTopThree()}
          </>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundPattern: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', opacity: 0.05 },
  patternText: { fontSize: 40 },
  header: { paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  topThreeContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', margin: 20 },
  topCard: { width: width * 0.28, padding: 15, borderRadius: 20, alignItems: 'center' },
  firstPlace: { transform: [{ scale: 1.1 }], zIndex: 3 },
  topAvatar: { width: 60, height: 60, borderRadius: 30 },
  topAvatarPlaceholder: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  topAvatarText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  topName: { fontSize: 12, fontWeight: 'bold', marginTop: 10 },
  topPoints: { fontSize: 10 },
  row: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: 15, alignItems: 'center' },
  rankContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankText: { fontSize: 16, fontWeight: 'bold' },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1 },
  username: { fontSize: 14, fontWeight: '600' },
  progressBarContainer: { height: 4, borderRadius: 2, marginTop: 4, width: '100%' },
  progressBar: { height: '100%', borderRadius: 2 },
  pointsContainer: { marginLeft: 10 },
  points: { fontSize: 14, fontWeight: 'bold' },
  filterScroll: { paddingHorizontal: 20, marginVertical: 10 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  list: { paddingBottom: 20 },
});

export default LeaderboardScreen;
