import React, { useContext, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';

import { gamificationAPI } from '../services/api';
import haptics from '../utils/haptics';

const { width } = Dimensions.get('window');

const AchievementScreen = () => {
  const navigation = useNavigation();
  const { isDarkMode, theme } = useContext(ThemeContext);
  const { activeLanguage } = useContext(LanguageContext);
  
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState({ totalUnlocked: 0, totalPoints: 0 });
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAchievements();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [activeLanguage]);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      const response = await gamificationAPI.getBadges();
      const data = response.data?.data || [];
      setAchievements(data);
      
      const unlockedCount = data.filter(a => a.unlocked).length;
      setStats({
        totalUnlocked: unlockedCount,
        totalPoints: data.reduce((acc, curr) => acc + (curr.unlocked ? (curr.points || 0) : 0), 0)
      });
    } catch (error) {
      console.error("Failed to load achievements:", error);
    } finally {
      setLoading(false);
    }
  };

  const AchievementCard = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.achievementCard, 
        { backgroundColor: theme.card },
        !item.unlocked && styles.lockedCard
      ]}
      onPress={() => {
        if (!item.unlocked) {
          haptics.notificationWarning();
          alert(`To unlock "${item.name}": ${item.description}`);
        } else {
          haptics.impactMedium();
        }
      }}
    >
      <View style={[styles.iconContainer, { backgroundColor: item.unlocked ? `${item.color || '#4CAF50'}20` : '#f0f0f0' }]}>
        <Text style={[styles.badgeIcon, !item.unlocked && { opacity: 0.3 }]}>
          {item.icon || '🏅'}
        </Text>
        {!item.unlocked && (
          <View style={styles.lockOverlay}>
            <MaterialIcons name="lock" size={16} color="#999" />
          </View>
        )}
      </View>
      <View style={styles.achievementInfo}>
        <Text style={[styles.achievementName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.achievementDesc, { color: theme.subText }]} numberOfLines={2}>
          {item.description}
        </Text>
        {item.unlocked && (
          <Text style={[styles.unlockDate, { color: item.color || '#4CAF50' }]}>
            Earned +{item.points || 50} pts
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <LinearGradient
        colors={isDarkMode ? ['#1a1a1a', '#000'] : ['#1a4c2e', '#2e7d32']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.totalUnlocked}</Text>
            <Text style={styles.statLabel}>Badges</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.totalPoints}</Text>
            <Text style={styles.statLabel}>Points Earned</Text>
          </View>
        </View>
      </LinearGradient>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {unlocked.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Unlocked</Text>
              {unlocked.map((item) => (
                <AchievementCard key={item._id || item.name} item={item} />
              ))}
            </View>
          )}

          {locked.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Road to Mastery</Text>
              {locked.map((item) => (
                <AchievementCard key={item._id || item.name} item={item} />
              ))}
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 15,
  },
  statBox: { alignItems: 'center' },
  statNum: { color: '#FFD700', fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: '#fff', fontSize: 12, opacity: 0.8 },
  divider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.3)' },
  scrollContent: { padding: 20 },
  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 18,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  lockedCard: {
    opacity: 0.8,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  badgeIcon: { fontSize: 30 },
  lockOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
  },
  achievementInfo: { flex: 1 },
  achievementName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  achievementDesc: { fontSize: 13, lineHeight: 18 },
  unlockDate: { fontSize: 11, fontWeight: '600', marginTop: 6 },
});

export default AchievementScreen;
