import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import haptics from '../utils/haptics';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import { handleGlobalError } from '../utils/errorHandler';
import SafeAreaContainer from '../components/SafeAreaContainer';


// Import the new API modules
import { gamificationAPI, vocabularyAPI, communityAPI, progressAPI } from '../services/api'; 
import LanguageSwitcher from '../components/LanguageSwitcher';
import { LanguageContext } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in HomeScreen.js:', contextValue);
  const { theme, isDarkMode, toggleTheme } = contextValue;
  
  if (!theme) {
    console.warn('DEBUG: ThemeContext value is missing or incomplete in HomeScreen:', { theme, isDarkMode });
    return null; // Or a fallback UI
  }
  
  const { activeLanguage } = useContext(LanguageContext);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // State
  const [currentTip, setCurrentTip] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(false);
  
  // Dynamic Data State
  const [stats, setStats] = useState({
    streak: 0,
    points: 0,
    words: 0,
    accuracy: '0%'
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [achievements, setAchievements] = useState([]);

  // Daily tips
  const dailyTips = useMemo(() => [
    "💡 Try practicing for 15 minutes daily",
    "🗣️ Speak out loud to improve pronunciation",
    "📝 Write down new words you learn",
    "👥 Find a language partner to practice with",
    `🎧 Listen to ${activeLanguage?.name || 'Izon'} music to train your ear`,
  ], [activeLanguage?.name]);

  const features = useMemo(() => [
    { title: 'Lessons', icon: '📚', screen: 'Lessons', gradient: ['#4CAF50', '#2E7D32'], description: 'Structured learning path' },
    { title: 'Vocabulary', icon: '📖', screen: 'Vocabulary', gradient: ['#2196F3', '#1565C0'], description: 'Build your word bank' },
    { title: 'Practice', icon: '✍️', screen: 'Practice', gradient: ['#FF9800', '#F57C00'], description: 'Speak & listen exercises' },
    { title: 'Culture', icon: '🏛️', screen: 'Culture', gradient: ['#9C27B0', '#6A1B9A'], description: `Learn ${activeLanguage?.name || 'Izon'} traditions` },
    { title: 'Community', icon: '👥', screen: 'Community', gradient: ['#E91E63', '#C2185B'], description: 'Connect with others' },
    { title: 'Games', icon: '🎮', screen: 'Games', gradient: ['#00BCD4', '#0097A7'], description: 'Learn through play' },
  ], [activeLanguage?.name]);

  useEffect(() => {
    fetchDashboardData();

    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Rotate animation for cultural pattern
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();

    const tipInterval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % dailyTips.length);
    }, 5000);

    const welcomeTimeout = setTimeout(() => setShowWelcome(false), 3000);

    return () => {
      clearInterval(tipInterval);
      clearTimeout(welcomeTimeout);
    };
  }, [dailyTips.length]);

  const handleFeaturePress = (feature) => {
    haptics.impactLight();
    navigation.navigate(feature.screen);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, vocabStats, badgesRes, feedRes] = await Promise.all([
        progressAPI.get(),
        vocabularyAPI.getStats(),
        gamificationAPI.getBadges(),
        communityAPI.getFeed({ limit: 3 })
      ]);

      // This matches the nesting in your ProgressScreen code
      const progressData = statsRes.data?.data;

      setStats({
        // progress?.progress?.currentStreak
        streak: progressData?.progress?.currentStreak || 0,
        
        // progress?.progress?.totalPoints
        points: progressData?.progress?.totalPoints || 0,
        
        // Using vocabulary stats from vocabStats directly since we have it
        words: vocabStats.data?.data?.total || 0,
        
        // progress?.statistics?.averageScore
        accuracy: progressData?.statistics?.averageScore 
          ? `${Math.round(progressData.statistics.averageScore)}%` 
          : '0%'
      });

      // Update achievements and feed using the confirmed working paths
      setAchievements(badgesRes.data?.data || []);
      setRecentActivity(feedRes.data?.data || []);

    } catch (error) {
      handleGlobalError(error, 'HomeScreen Dashboard');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ number, label, icon, color }) => (
    <Animated.View style={[styles.statCard, { opacity: fadeAnim, backgroundColor: theme.card }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <MaterialIcons name={icon} size={24} color={color} />
      </View>
      <View>
        <Text style={[styles.statNumber, { color: theme.text }]}>{number}</Text>
        <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
      </View>
    </Animated.View>
  );

  const AchievementBadge = ({ title, icon, unlocked }) => (
    <View style={[styles.badge, !unlocked && styles.badgeLocked, { backgroundColor: theme.card }]}>
      <Text style={styles.badgeIcon}>{icon || '🏅'}</Text>
      <Text style={[styles.badgeTitle, !unlocked && styles.badgeTitleLocked, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaContainer backgroundColor={theme.background}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#000' : '#1a4c2e'} />

      <Animated.View style={[styles.backgroundPattern, { transform: [{ rotate }] }]}>
        <Text style={[styles.patternText, { color: theme.text, opacity: isDarkMode ? 0.05 : 0.05 }]}>⚡ 𖦹 🔱 ⚡ 𖦹 🔱</Text>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.background }]}>
        {showWelcome && (
          <Animated.View style={[styles.welcomeBanner, { backgroundColor: theme.primary, opacity: fadeAnim }]}>
            <Text style={styles.welcomeText}>Welcome back, {user?.username}! 🎉</Text>
          </Animated.View>
        )}

        <LinearGradient colors={theme.headerGradient} style={styles.header}>
          <Animated.View style={[styles.headerContent, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greeting}>Aua, {user?.username || 'Learner'}! 👋</Text>
                <Text style={styles.subtitle}>Ready to learn {activeLanguage?.name || 'Izon'} today?</Text>
              </View>
              
              <TouchableOpacity style={[styles.profileButton, { marginRight: 10, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }]} onPress={toggleTheme}  >
               <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={20} color={theme.accent} />
             </TouchableOpacity>

              <TouchableOpacity style={[styles.profileButton, { marginRight: 10, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }]} onPress={() => setShowLanguageSwitcher(true)}  >
               <FontAwesome5 name="language" size={20} color={theme.accent} />
             </TouchableOpacity>
              
              <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('EditProfile')}>
                {user?.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={[styles.profilePlaceholder, { backgroundColor: theme.accent }]}>
                    <Text style={[styles.profileInitial, { color: theme.headerGradient[0] }]}>{user?.username?.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Animated.View style={[styles.tipContainer, { backgroundColor: 'rgba(255,255,255,0.2)', opacity: fadeAnim }]}>
              <Ionicons name="bulb" size={20} color={theme.accent} />
              <Text style={styles.tipText}>{dailyTips[currentTip]}</Text>
            </Animated.View>
          </Animated.View>
        </LinearGradient>

        {/* Dynamic Stats */}
        <Animated.View style={[styles.statsSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <StatCard number={stats.streak} label="Streak" icon="whatshot" color="#FF6B6B" />
          <StatCard number={stats.points} label="Points" icon="stars" color="#FFD700" />
          <StatCard number={stats.words} label="Words" icon="menu-book" color="#4CAF50" />
          <StatCard number={stats.accuracy} label="Accuracy" icon="check-circle" color="#2196F3" />
        </Animated.View>

        {/* Continue Learning */}
        <Animated.View style={[styles.continueCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient colors={['#FF6B6B', '#FF8E53']} style={styles.continueGradient}>
            <View style={styles.continueContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.continueTitle}>Continue Learning</Text>
                <Text style={styles.continueSubtitle}>Recent Lesson</Text>
                <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                  <View style={[styles.progressFill, { width: '40%', backgroundColor: theme.accent }]} />
                </View>
              </View>
              <TouchableOpacity style={[styles.continueButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => navigation.navigate('Lessons')}>
                <Text style={styles.continueButtonText}>Resume</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Premium Promotion */}
        {(!user?.isPremium) && (
          <Animated.View style={[styles.premiumCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity onPress={() => navigation.navigate('Premium')} activeOpacity={0.9}>
              <LinearGradient
                colors={theme.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumGradient}
              >
                <View style={styles.premiumContent}>
                  <View style={styles.premiumTextContainer}>
                    <View style={styles.premiumBadge}>
                      <FontAwesome5 name="crown" size={10} color={theme.accent} />
                      <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                    </View>
                    <Text style={styles.premiumTitle}>Unlock Everything</Text>
                    <Text style={styles.premiumSubtitle}>AI tutor, Offline mode & more</Text>
                  </View>
                  <View style={styles.premiumAction}>
                    <Text style={styles.premiumActionText}>Upgrade</Text>
                    <MaterialIcons name="chevron-right" size={20} color="#fff" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Features Grid */}
        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Learning Tools</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <Animated.View key={index} style={[styles.featureWrapper, { opacity: fadeAnim }]}>
                <TouchableOpacity style={styles.featureCard} onPress={() => handleFeaturePress(feature)}>
                  <LinearGradient colors={feature.gradient} style={styles.featureGradient}>
                    <Text style={styles.featureIcon}>{feature.icon}</Text>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>{feature.description}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Achievements from API */}
        <View style={styles.achievementsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Achievements</Text>
            <TouchableOpacity onPress={() => navigation.navigate('achievements')}>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {achievements.length > 0 ? achievements.map((ach, i) => (
              <AchievementBadge key={i} title={ach.name} icon={ach.icon} unlocked={ach.unlocked} />
            )) : (
              <AchievementBadge title="First Steps" icon="👶" unlocked={false} />
            )}
          </ScrollView>
        </View>

{/* Community Activity from API */}
<View style={styles.communitySection}>
  <Text style={[styles.sectionTitle, { color: theme.text }]}>Community Activity</Text>
  <View style={[styles.activityCard, { backgroundColor: theme.card }]}>
    {recentActivity.length > 0 ? (
      recentActivity.map((post, index) => (
        <View key={post._id || index} style={[styles.activityItem, { borderBottomColor: theme.border }]}>
          <View style={[styles.activityAvatar, { backgroundColor: theme.primary + '20' }]}>
            {post.user?.profile?.avatar?.thumbnail ? (
              <Image 
                source={{ uri: post.user.profile.avatar.thumbnail }} 
                style={styles.activityAvatarImage} 
              />
            ) : (
              <View style={[styles.activityAvatarPlaceholder, { backgroundColor: theme.primary + '40' }]}>
                <Text style={styles.activityAvatarText}>
                  {post.user?.username?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.activityContent}>
            <Text style={[styles.activityName, { color: theme.text }]}>{post.user?.username || 'Learner'}</Text>
            <Text style={[styles.activityText, { color: theme.subText }]} numberOfLines={1}>{post.content}</Text>
          </View>
        </View>
      ))
    ) : (
      <View style={styles.emptyActivityContainer}>
        <Ionicons name="chatbubbles-outline" size={40} color={theme.subText} />
        <Text style={[styles.activityEmptyText, { color: theme.subText }]}>
          The community is quiet... Be the first to start a conversation!
        </Text>
        <TouchableOpacity style={[styles.emptyActivityButton, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('Community')}>
          <Text style={styles.emptyActivityButtonText}>Go to Forum</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
</View>

      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('Practice')}>
        <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.fabGradient}>
          <Ionicons name="flash" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
      
     <LanguageSwitcher
       visible={showLanguageSwitcher}
       onClose={() => setShowLanguageSwitcher(false)}
       onLanguageChange={(language) => {
         fetchDashboardData(); // Refresh data to reflect potential language-specific content
       }}
     />

     </SafeAreaContainer>
     );
     };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.05,
  },
  patternText: {
    fontSize: 40,
    color: '#1a4c2e',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  welcomeBanner: {
    backgroundColor: '#4CAF50',
    padding: 10,
    alignItems: 'center',
  },
  welcomeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  headerContent: {
    marginTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a4c2e',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 25,
    marginTop: 15,
  },
  tipText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  statsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 15,
    marginTop: -20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    flexDirection: 'row',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a4c2e',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginLeft: 5,
  },
  continueCard: {
    margin: 15,
    marginTop: 0,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  continueGradient: {
    padding: 20,
  },
  continueContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  continueTitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 5,
  },
  continueSubtitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    width: 150,
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },
  progressText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  continueButtonText: {
    color: '#fff',
    marginRight: 5,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionText: {
    marginTop: 5,
    fontSize: 12,
    color: '#666',
  },
  featuresSection: {
    padding: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    color: '#4CAF50',
    fontSize: 14,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  featureWrapper: {
    width: '48%',
    marginBottom: 15,
  },
  featureCard: {
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    aspectRatio: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featureGradient: {
    padding: 20,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  featureDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    textAlign: 'center',
  },
  featureArrow: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  achievementsSection: {
    padding: 15,
  },
  achievementsScroll: {
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    marginRight: 10,
    width: 100,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  badgeLocked: {
    opacity: 0.5,
  },
  badgeIcon: {
    fontSize: 30,
    marginBottom: 5,
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  badgeTitleLocked: {
    color: '#999',
  },
  challengeCard: {
    margin: 15,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  challengeGradient: {
    padding: 20,
  },
  challengeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeTitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 5,
  },
  challengeDescription: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  challengeReward: {
    color: '#fff',
    fontSize: 12,
  },
  challengeBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  communitySection: {
    padding: 15,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  activityAvatarText: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  activityText: {
    fontSize: 12,
    color: '#666',
  },
  activityTime: {
    fontSize: 10,
    color: '#999',
  },
  activityEmptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginVertical: 10,
  },
  emptyActivityContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyActivityButton: {
    marginTop: 10,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyActivityButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
    // Add this to your styles object
  languageButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  premiumCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  premiumGradient: {
    padding: 15,
  },
  premiumContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  premiumTextContainer: {
    flex: 1,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 5,
    gap: 4,
  },
  premiumBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
  },
  premiumTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  premiumSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  premiumAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  premiumActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 2,
  },
});

export default HomeScreen;