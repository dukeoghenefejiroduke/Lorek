import React, { useContext, useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Text,
  Image,
  Platform,
  Modal,
  TextInput,  
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import haptics from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

//Notifications
import { notificationAPI } from '../services/api';

import { streakService } from '../services/streakService';

import PremiumScreen from '../screens/PremiumScreen';
// ── Existing screens ────────────────────────────────────────────────
import HomeScreen          from '../screens/HomeScreen';
import LessonsScreen       from '../screens/LessonsScreen';
import VocabularyScreen    from '../screens/VocabularyScreen';
import PracticeScreen      from '../screens/PracticeScreen';
import ProgressScreen      from '../screens/ProgressScreen';
import ProfileScreen       from '../screens/ProfileScreen';
import LoginScreen         from '../screens/LoginScreen';
import RegisterScreen      from '../screens/RegisterScreen';
import TranslatorScreen    from '../screens/TranslatorScreen';
import AdminScreen         from '../screens/AdminScreen';
import LeaderboardScreen   from '../screens/LeaderboardScreen';
import ReferralScreen      from '../screens/ReferralScreen';
import ConversationScreen  from '../screens/ConversationScreen';

// ── NEW screens added from ProfileScreen ────────────────────────────
import EditProfileScreen   from '../screens/EditProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import DailyGoalScreen     from '../screens/DailyGoalScreen';
import AboutAppScreen      from '../screens/AboutAppScreen';
import OnboardingScreen    from '../screens/OnboardingScreen';

import ApiKeyScreen      from '../screens/ApiKeyScreen';
import LessonDetailScreen from '../screens/LessonDetailScreen';

import CultureScreen from '../screens/CultureScreen';
import CommunityScreen from '../screens/CommunityScreen';
import GamesScreen from '../screens/GamesScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import CreateDiscussionScreen from '../screens/CreateDiscussionScreen';
import DiscussionDetailScreen from '../screens/DiscussionDetailScreen';
import TermsScreen from '../screens/TermsScreen';
import SearchScreen from '../screens/SearchScreen';

import NewMessageScreen from '../screens/NewMessageScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import MessagesScreen from '../screens/MessagesScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import MyContributionsScreen from '../screens/MyContributionsScreen';
import AchievementScreen from '../screens/AchievementScreen';
import RemindersScreen from '../screens/RemindersScreen';
import VocabularyDetailScreen from '../screens/VocabularyDetailScreen';

const { width, height } = Dimensions.get('window');
const Stack = createNativeStackNavigator();

const SCREENS_WITH_LANGUAGE_SELECTOR = ['Home', 'Lessons', 'Vocabulary', 'Practice', 'Progress', 'Leaderboard', 'Translator'];

// Enhanced menu items with categories
const menuItemsLoggedOut = [
  {
    category: 'Authentication',
    items: [
      { name: 'Login', icon: 'log-in', screen: LoginScreen, color: '#4CAF50', gradient: ['#4CAF50', '#2E7D32'] },
      { name: 'Register', icon: 'person-add', screen: RegisterScreen, color: '#2196F3', gradient: ['#2196F3', '#1565C0'] },
    ]
  }
];

function MainApp({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useContext(AuthContext);
  const { activeLanguage } = useContext(LanguageContext);
  
  const menuItemsLoggedIn = useMemo(() => [
    {
      category: 'Learning',
      items: [
        { name: 'Home', icon: 'home', screen: HomeScreen, color: '#4CAF50', gradient: ['#4CAF50', '#2E7D32'] },
        { name: 'Lessons', icon: 'book', screen: LessonsScreen, color: '#2196F3', gradient: ['#2196F3', '#1565C0'] },
        { name: 'Vocabulary', icon: 'list', screen: VocabularyScreen, color: '#FF9800', gradient: ['#FF9800', '#F57C00'] },
        { name: 'Practice', icon: 'pencil', screen: PracticeScreen, color: '#9C27B0', gradient: ['#9C27B0', '#6A1B9A'] },
      ]
    },
    {
      category: 'Progress',
      items: [
        { name: 'Progress', icon: 'stats-chart', screen: ProgressScreen, color: '#00BCD4', gradient: ['#00BCD4', '#0097A7'] },
        { name: 'Leaderboard', icon: 'trophy', screen: LeaderboardScreen, color: '#FFD700', gradient: ['#FFD700', '#FFA500'] },
        { name: 'Referral', icon: 'share-social', screen: ReferralScreen, color: '#E91E63', gradient: ['#E91E63', '#C2185B'] },
      ]
    },
    {
      category: 'Tools',
      items: [
        { name: 'Translator', icon: 'language', screen: TranslatorScreen, color: '#607D8B', gradient: ['#607D8B', '#455A64'] },
        { name: 'Conversation', icon: 'chatbubbles', screen: ConversationScreen, color: '#795548', gradient: ['#795548', '#5D4037'] },
        { name: 'Culture', icon: 'leaf', screen: CultureScreen, route: 'Culture', color: '#009688', gradient: ['#009688', '#00695C'] },
        { name: 'Games', icon: 'game-controller', screen: GamesScreen, route: 'Games', color: '#673AB7', gradient: ['#673AB7', '#4527A0'] },
      ]
    },
    {
      category: 'Community',
      items: [
        { name: 'Community', icon: 'people', screen: CommunityScreen, route: 'Community', color: '#00ACC1', gradient: ['#00ACC1', '#00838F'] },
        { name: 'Messages', icon: 'mail', screen: MessagesScreen, route: 'Messages', color: '#5C6BC0', gradient: ['#5C6BC0', '#3949AB'] },
      ]
    },
    {
      category: 'Account',
      items: [
        { name: 'Profile', icon: 'person', screen: ProfileScreen, color: '#3F51B5', gradient: ['#3F51B5', '#303F9F'] },
        { name: 'Premium', icon: 'star', screen: PremiumScreen, route: 'Premium', color: '#FFD700', gradient: ['#FFD700', '#FFA500'] },
        ...(user && user.role === 'admin' ? [{ name: 'Admin', icon: 'settings-sharp', screen: AdminScreen, color: '#F44336', gradient: ['#F44336', '#D32F2F'] }] : []),
      ]
    }
  ], [user]);

   const { isDarkMode, theme } = useContext(ThemeContext);
  
  const [unreadCount, setUnreadCount] = useState(0); 
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  const [currentScreen, setCurrentScreen] = React.useState('Home');
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState('Learning');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageSwitcherVisible, setLanguageSwitcherVisible] = useState(false);

  const menuData = user ? menuItemsLoggedIn : menuItemsLoggedOut;

 useEffect(() => {
    let isMounted = true;

    if (user) {
      const initializeAppData = async () => {
        try {
          // 1. Sync Streak (Only once on mount/user change)
          const streakData = await streakService.syncOnAppLaunch();
          if (isMounted) {
          }
          
          // 2. Load Notifications
          await loadNotifications();
        } catch (err) {
        }
      };

      initializeAppData();
    }
    
    // Setup initial screen
    setCurrentScreen(menuData[0]?.items[0]?.name || 'Home');
    
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 10, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start();
    
    setMenuVisible(false);

    return () => { isMounted = false; };
  }, [user?.id]); // Only re-run if the specific user ID ChangePasswordScreen

  // Make loadNotifications use the local state
  const loadNotifications = async () => {
    try {
      const response = await notificationAPI.getAll({ limit: 50 });
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  // Refresh count when returning from Notifications screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) {
        loadNotifications();
        refreshUser(); // Fetch fresh Lesson, Streak, and Mastery stats
      }
    });
    
    return unsubscribe;
  }, [navigation, user]);
  
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const toggleMenu = () => {
    haptics.impactMedium();
    const newValue = menuVisible ? 0 : 1;
    
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: newValue,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: newValue ? 1 : 0.8,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => setMenuVisible(!menuVisible));
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 0.8,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => setMenuVisible(false));
  };

  const selectItem = (item) => {
    haptics.impactLight();

    if (item.screen) {
      setCurrentScreen(item.name);
    } else if (item.route) {
      setCurrentScreen(item.name);
      navigation.navigate(item.route);
    }

    closeMenu();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => {
            haptics.notificationWarning();
            logout();
          }
        }
      ]
    );
  };

  const menuTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  const menuScale = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const menuOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  const getCurrentScreenComponent = () => {
    for (const category of menuData) {
      const found = category.items.find(item => item.name === currentScreen);
      if (found) return found.screen;
    }
    return HomeScreen;
  };

  const ScreenComponent = getCurrentScreenComponent();
  const screenNavigation = useMemo(() => ({
    ...navigation,
    goBack: () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }

      setCurrentScreen('Home');
    },
  }), [navigation]);

  // ── When not logged in → show auth flow only ───────────────────────
  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login"    component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
     <StatusBar 
       barStyle={isDarkMode ? "light-content" : "dark-content"} 
       backgroundColor={isDarkMode ? "#000" : theme.headerGradient[0]} 
     />

      {/* Custom Header */}
      <LinearGradient
        colors={theme.headerGradient}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.headerLogo}
            />
            <View>
              <Text style={styles.headerTitle}>{activeLanguage?.name || 'Izon'} Language</Text>
              <Text style={styles.headerSubtitle}>Learn • Preserve • Grow</Text>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            {SCREENS_WITH_LANGUAGE_SELECTOR.includes(currentScreen) && (
              <TouchableOpacity 
                style={[styles.languageButton, { backgroundColor: 'rgba(255,255,255,0.14)' }]}
                onPress={() => setLanguageSwitcherVisible(true)}
              >
                <FontAwesome5 name="language" size={18} color={theme.accent} />
                <Text style={styles.languageButtonText}>
                  {activeLanguage?.code || 'IZON'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.headerIcon}
              onPress={() => navigation.navigate('Search')}
            >
              <Ionicons name="search" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerIcon}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications" size={24} color="#fff" />
             {unreadCount > 0 && 
              <View style={[styles.notificationBadge, { backgroundColor: theme.error }]}>
                <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
              </View>
             }
            </TouchableOpacity>
          </View>
        </View>

<View style={[styles.quickStats, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
  <View style={styles.quickStat}>
    {/* Use optional chaining to prevent crashes if user data is still loading */}
    <Text style={[styles.quickStatValue, { color: theme.accent }]}>
       {user?.progress?.lessonStats?.totalCompleted ?? 0}
    </Text>
    <Text style={styles.quickStatLabel}>Lessons</Text>
  </View>
  <View style={styles.quickStat}>
    <Text style={[styles.quickStatValue, { color: theme.accent }]}>
        {user?.progress?.streak?.current ?? 0}
    </Text>
    <Text style={styles.quickStatLabel}>Streak</Text>
  </View>
  <View style={styles.quickStat}>
    <Text style={[styles.quickStatValue, { color: theme.accent }]}>
      {user?.progress?.completionRate ?? 0}%
    </Text>
    <Text style={styles.quickStatLabel}>Mastery</Text>
  </View>
</View>

      </LinearGradient>

      <SafeAreaView style={{ flex: 1 }}>
        <ScreenComponent key={currentScreen} navigation={screenNavigation} />
      </SafeAreaView>

      {/* Quick Actions Menu */}
      <Animated.View 
        style={[
          styles.quickActions,
          {
            transform: [{ translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [100, 0]
            }) }],
            opacity: slideAnim
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => {
            haptics.impactLight();
            setCurrentScreen('Practice');
          }}
        >
          <LinearGradient
            colors={['#4CAF50', '#2E7D32']}
            style={styles.quickActionGradient}
          >
            <MaterialIcons name="flash-on" size={20} color="#fff" />
          </LinearGradient>
          <Text style={[styles.quickActionText, { color: theme.subText }]}>Quick Practice</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => navigation.navigate('DailyGoal')}
        >
          <LinearGradient
            colors={['#2196F3', '#1565C0']}
            style={styles.quickActionGradient}
          >
            <MaterialIcons name="track-changes" size={20} color="#fff" />
          </LinearGradient>
          <Text style={[styles.quickActionText, { color: theme.subText }]}>Daily Goal</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => navigation.navigate('Reminders')}
        >
          <LinearGradient
            colors={['#FF9800', '#F57C00']}
            style={styles.quickActionGradient}
          >
            <MaterialIcons name="alarm" size={20} color="#fff" />
          </LinearGradient>
          <Text style={[styles.quickActionText, { color: theme.subText }]}>Reminders</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main Menu Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={menuVisible}
        onRequestClose={toggleMenu}
      >
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? "dark" : "light"} style={StyleSheet.absoluteFill}>
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={toggleMenu}
          />
          
          <Animated.View
            style={[
              styles.menuContainer,
              {
                backgroundColor: theme.card,
                transform: [
                  { translateY: menuTranslateY },
                  { scale: menuScale }
                ],
                opacity: menuOpacity,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={[styles.menuHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.menuHeaderLeft}>
                <Image 
                  source={require('../../assets/icon.png')} 
                  style={styles.menuLogo}
                />
                <View>
                  <Text style={[styles.menuHeaderTitle, { color: theme.text }]}>Navigation Menu</Text>
                  <Text style={[styles.menuHeaderSubtitle, { color: theme.subText }]}>
                    {user?.username || 'Guest'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.menuCloseButton}
                onPress={toggleMenu}
              >
                <Ionicons name="close" size={24} color={theme.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuCategories}>
              {menuData.map((category, index) => (
                <View key={category.category} style={styles.menuCategory}>
                  <Text style={[styles.menuCategoryTitle, { color: theme.subText }]}>{category.category}</Text>
                  <View style={styles.menuCategoryItems}>
                    {category.items.map((item) => (
                      <TouchableOpacity
                        key={item.name}
                        style={[
                          styles.menuItem,
                          currentScreen === item.name && { transform: [{ scale: 1.05 }] },
                        ]}
                        onPress={() => selectItem(item)}
                      >
                        <LinearGradient
                          colors={item.gradient}
                          style={styles.menuItemIcon}
                        >
                          <Ionicons name={item.icon} size={20} color="#fff" />
                        </LinearGradient>
                        <Text style={[styles.menuItemText, { color: theme.text }
                        ]}>
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={[styles.menuFooter, { borderTopColor: theme.border }]}>
              <TouchableOpacity 
                style={[styles.menuFooterButton, { backgroundColor: theme.background }]}
                onPress={() => navigation.navigate('AboutApp')}
              >
                <Ionicons name="information-circle" size={20} color={theme.subText} />
                <Text style={[styles.menuFooterText, { color: theme.subText }]}>About</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuFooterButton, { backgroundColor: theme.background }]}
                onPress={handleLogout}
              >
                <Ionicons name="log-out" size={20} color={theme.error} />
                <Text style={[styles.menuFooterText, { color: theme.error }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </BlurView>
      </Modal>

      {/* FAB */}
      <Animated.View style={[
        styles.fabContainer,
        {
          transform: [
            { scale: scaleAnim },
            { rotate }
          ]
        }
      ]}>
        <TouchableOpacity 
          style={styles.fab}
          onPress={toggleMenu}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={theme.headerGradient}
            style={styles.fabGradient}
          >
            <Ionicons
              name={menuVisible ? 'close' : 'menu'}
              size={32}
              color="white"
            />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Search Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={searchVisible}
        onRequestClose={() => setSearchVisible(false)}
      >
        <BlurView intensity={90} style={styles.searchModalOverlay}>
          <View style={styles.searchModalContent}>
            <View style={styles.searchHeader}>
              <TouchableOpacity onPress={() => setSearchVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.searchTitle}>Search</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search words, lessons..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.searchResults}>
              <Text style={styles.searchResultsPlaceholder}>
                Start typing to search...
              </Text>
            </View>
          </View>
        </BlurView>
      </Modal>

      <LanguageSwitcher
        visible={languageSwitcherVisible}
        onClose={() => setLanguageSwitcherVisible(false)}
        onLanguageChange={() => {
          refreshUser?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  headerIcon: {
    position: 'relative',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  languageButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6B6B',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 12,
  },
  quickStat: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  quickActions: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    zIndex: 80,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  quickActionText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    zIndex: 100,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
  },
  menuContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: height * 0.8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  menuHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  menuHeaderSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  menuCloseButton: {
    padding: 8,
  },
  menuCategories: {
    padding: 20,
  },
  menuCategory: {
    marginBottom: 20,
  },
  menuCategoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 1,
  },
  menuCategoryItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuItem: {
    alignItems: 'center',
    width: (width - 80) / 4,
  },
  menuItemActive: {
    transform: [{ scale: 1.05 }],
  },
  menuItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  menuItemText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  menuItemTextActive: {
    color: '#1a4c2e',
    fontWeight: '600',
  },
  menuFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  menuFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  menuFooterText: {
    fontSize: 14,
    color: '#666',
  },
  searchModalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  searchModalContent: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    margin: 20,
    paddingHorizontal: 15,
    borderRadius: 25,
    height: 50,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchResultsPlaceholder: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 14,
  },
});

// ── Root navigator ───────────────────────────────────────────────────
export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext);
  const [onboardingComplete, setOnboardingComplete] = useState(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await AsyncStorage.getItem('hasCompletedOnboarding');
      setOnboardingComplete(completed === 'true');
    };
    checkOnboarding();
  }, []);

  if (loading || onboardingComplete === null) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!onboardingComplete && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
      <Stack.Screen name="Main" component={MainApp} />

      {/* Deep navigation screens */}
      <Stack.Group screenOptions={{ 
        presentation: 'card',
        animation: 'slide_from_right',
      }}>

        <Stack.Screen name="EditProfile"   component={EditProfileScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="DailyGoal"     component={DailyGoalScreen} />
        <Stack.Screen name="AboutApp"      component={AboutAppScreen} />
        <Stack.Screen name="Conversation" component={ConversationScreen} />
        <Stack.Screen name="Lessons" component={LessonsScreen} />
        <Stack.Screen name="Vocabulary" component={VocabularyScreen} />
        <Stack.Screen name="Practice" component={PracticeScreen} />
        <Stack.Screen name="Progress" component={ProgressScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ApiKey" component={ApiKeyScreen} />
       <Stack.Screen name="LessonDetail" component={LessonDetailScreen} options={{ headerShown: false }} />
       
       <Stack.Screen name="Culture" component={CultureScreen} options={{ headerShown: false }} />
       <Stack.Screen name="Community" component={CommunityScreen} options={{ headerShown: false }} />
       <Stack.Screen name="Games" component={GamesScreen} options={{ headerShown: false }} />
       <Stack.Screen  name="CreateDiscussion" component={CreateDiscussionScreen} options={{ headerShown: false }} />
       <Stack.Screen name="ChangePassword" component={ChangePasswordScreen}  options={{ headerShown: false }} />
       <Stack.Screen name="DiscussionDetail" component={DiscussionDetailScreen}  options={{ headerShown: false }} />
       <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false }}/>
       <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }}/>
       <Stack.Screen name="PrivacyPolicy" component={TermsScreen} options={{ headerShown: false }}/>
       <Stack.Screen name="Reminders" component={RemindersScreen} options={{ headerShown: false }}/>
       <Stack.Screen name="VocabularyDetail" component={VocabularyDetailScreen} options={{ headerShown: false }}/>
       
       <Stack.Screen name="Messages" component={MessagesScreen} options={{ headerShown: false }} />
       <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }}/>
      <Stack.Screen name="MyContributions" component={MyContributionsScreen} options={{ headerShown: false }}/>
      <Stack.Screen name="Achievements" component={AchievementScreen} options={{ headerShown: false }}/>

       <Stack.Screen name="achievements" component={AchievementScreen} options={{ headerShown: false }}/>
       <Stack.Screen name="Premium" component={PremiumScreen} options={{ headerShown: false }}/>

      </Stack.Group>

      {/* Modal screens */}
      <Stack.Group screenOptions={{ 
        presentation: 'modal',
        animation: 'slide_from_bottom',
      }}>
        <Stack.Screen name="Translator" component={TranslatorScreen} />
        <Stack.Screen name="Referral" component={ReferralScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
      </Stack.Group>
    </Stack.Navigator>
  );
}
