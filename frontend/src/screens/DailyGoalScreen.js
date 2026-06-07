import React, { useState, useEffect, useRef, useContext } from 'react';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gamificationAPI, progressAPI, cultureAPI } from '../services/api';
import { LanguageContext } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

const DailyGoalScreen = ({ navigation }) => {
  const { activeLanguage } = useContext(LanguageContext);
  const [goal, setGoal] = useState(20);
  const [loading, setLoading] = useState(false);
  const [dailyProverb, setDailyProverb] = useState('');
  
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in DailyGoalScreen.js:', contextValue);
  const { isDarkMode, theme } = contextValue;
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const goals = [
    { 
      id: 'casual',
      label: '🌱 Casual', 
      xp: 10, 
      description: 'Light learning, perfect for beginners',
      icon: 'seedling',
      color: '#4CAF50',
      gradient: ['#4CAF50', '#2E7D32'],
      timeCommitment: '5-10 mins',
      achievements: ['First Steps', 'Daily Learner']
    },
    { 
      id: 'regular',
      label: '📚 Regular', 
      xp: 20, 
      description: 'Consistent progress, recommended for most learners',
      icon: 'book-open',
      color: '#2196F3',
      gradient: ['#2196F3', '#1565C0'],
      timeCommitment: '10-15 mins',
      achievements: ['Consistent', 'Week Warrior']
    },
    { 
      id: 'serious',
      label: '⚡ Serious', 
      xp: 30, 
      description: 'Faster progress for dedicated learners',
      icon: 'bolt',
      color: '#FF9800',
      gradient: ['#FF9800', '#F57C00'],
      timeCommitment: '15-20 mins',
      achievements: ['Dedicated', 'XP Hunter']
    },
    { 
      id: 'intense',
      label: '🔥 Intense', 
      xp: 50, 
      description: 'Maximum progress for language enthusiasts',
      icon: 'fire',
      color: '#F44336',
      gradient: ['#F44336', '#C62828'],
      timeCommitment: '20-30 mins',
      achievements: ['Intense Learner', 'XP Master']
    },
  ];

  useEffect(() => {
    loadSavedGoal();
    loadInitialData();
    
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
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

    // Rotate animation for background pattern
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

useEffect(() => {
  const fetchProverb = async () => {
    try {
      const res = await cultureAPI.getProverbOfDay({ lang: activeLanguage?.code || 'IZON' });
      if (res.data?.success && res.data.data) {
        setDailyProverb(res.data.data.izon || res.data.data.text);
      }
    } catch (e) { 
      console.warn('Failed to fetch daily proverb', e);
    }
  };
  fetchProverb();
}, [activeLanguage]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Get current streak/points/goal from gamification
      const statsRes = await gamificationAPI.getUserStats();
      if (statsRes.data?.data?.dailyGoal) {
        setGoal(statsRes.data.data.dailyGoal);
      }
    } catch (error) {
      console.error('Failed to sync with server, falling back to local', error);
      loadSavedGoal(); // Fallback to AsyncStorage
    } finally {
      setLoading(false);
    }
  };

  const loadSavedGoal = async () => {
    try {
      const savedGoal = await AsyncStorage.getItem('dailyGoal');
      if (savedGoal) {
        setGoal(parseInt(savedGoal));
      }
    } catch (error) {
      console.error('Failed to load goal', error);
    }
  };

const saveGoal = async () => {
  setLoading(true);
  try {
    // Ensure we are sending an object that matches the backend's expected body
    await progressAPI.update({ dailyGoal: goal }); 
    
    // If you have a separate streak update, call it after
    await progressAPI.updateStreak();

    haptics.notificationSuccess();
    
    Alert.alert(
      'Goal Synced! 🚀',
      `Target: ${goal} XP has been set for your journey.`,
      [{ text: "Start Learning", onPress: () => navigation.navigate('Main') }]
    );
  } catch (error) {
    console.error('Sync Error:', error);
    // Fallback for your Vivo Y17 Termux environment
    await AsyncStorage.setItem('dailyGoal', goal.toString());
    Alert.alert('Offline Mode', 'Saved locally. We will sync when the server is reachable.');
  } finally {
    setLoading(false);
  }
};

  const handleSelectGoal = (xp) => {
    setGoal(xp);
    
    // Haptic feedback
    haptics.impactMedium();
  };

  const getGoalDetails = (xp) => {
    return goals.find(g => g.xp === xp) || goals[1];
  };

  const currentGoal = getGoalDetails(goal);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  {/* XP Breakdown */}
  const renderXPBreakdown = () => {
    const lessonsNeeded = Math.ceil(goal / 15);
    const wordsNeeded = Math.ceil(goal / 2);

    return (
      <View style={[styles.xpBreakdown, { backgroundColor: theme.card, borderLeftColor: theme.primary }]}>
        <Text style={[styles.breakdownTitle, { color: theme.text }]}>Daily Path to {goal} XP:</Text>
        
        <View style={[styles.breakdownItem, { borderBottomColor: theme.border }]}>
          <View style={styles.labelGroup}>
            <MaterialIcons name="menu-book" size={18} color="#4CAF50" />
            <Text style={[styles.breakdownLabel, { color: theme.text }]}>Complete {activeLanguage?.name || 'Izon'} Lessons</Text>
          </View>
          <Text style={[styles.breakdownValue, { color: theme.text }]}>{lessonsNeeded} {lessonsNeeded === 1 ? 'lesson' : 'lessons'}</Text>
        </View>

        <View style={[styles.breakdownItem, { borderBottomColor: theme.border }]}>
          <View style={styles.labelGroup}>
            <MaterialIcons name="translate" size={18} color="#2196F3" />
            <Text style={[styles.breakdownLabel, { color: theme.text }]}>Vocabulary Reviews</Text>
          </View>
          <Text style={[styles.breakdownValue, { color: theme.text }]}>{wordsNeeded} words</Text>
        </View>

        <View style={[styles.breakdownItem, { borderBottomColor: theme.border, borderBottomWidth: 0 }]}>
          <View style={styles.labelGroup}>
            <MaterialIcons name="history-edu" size={18} color="#FF9800" />
            <Text style={[styles.breakdownLabel, { color: theme.text }]}>Read a Proverb</Text>
          </View>
          <Text style={[styles.breakdownValue, { color: theme.text }]}>+5 XP</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

      {/* Animated Background Pattern */}
      <Animated.View style={[styles.backgroundPattern, { transform: [{ rotate }] }]}>
        <Text style={[styles.patternText, { color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>⚡ 𖦹 🔱 ⚡ 𖦹 🔱</Text>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#1a4c2e', '#2e7d32', '#43a047']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Daily Goal</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Current Goal Preview */}
          <Animated.View style={[styles.currentGoalPreview, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.currentGoalIcon}>
              <FontAwesome5 name={currentGoal.icon} size={30} color={currentGoal.color} />
            </View>
            <View style={styles.currentGoalInfo}>
              <Text style={styles.currentGoalLabel}>{currentGoal.label}</Text>
              <Text style={styles.currentGoalXP}>{currentGoal.xp} XP / day</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* Main Content */}
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          {/* Inspiration Card */}
          <LinearGradient
            colors={isDarkMode ? ['#333', '#222'] : ['#FFF9C4', '#FFF59D']}
            style={[styles.motivationCard, { borderColor: theme.accent }]}
          >
            <MaterialIcons name="emoji-events" size={24} color={theme.accent} />
            <View style={styles.motivationContent}>
              <Text style={[styles.motivationText, { color: isDarkMode ? '#ddd' : '#856404' }]}>
                {goal === 10 && "Every journey begins with a single step. You've got this! 🌱"}
                {goal === 20 && "Consistency is key. You're building a powerful habit! 📚"}
                {goal === 30 && "Great things come from dedication. Keep pushing! ⚡"}
                {goal === 50 && "Amazing dedication! You're on fire! 🔥"}
              </Text>
              {dailyProverb ? (
                <Text style={[styles.proverbText, { color: theme.primary }]}>
                  "{dailyProverb}"
                </Text>
              ) : null}
            </View>
          </LinearGradient>

          {/* Goal Selection */}
          <Text style={styles.sectionTitle}>Choose Your Goal</Text>
          <Text style={styles.sectionSubtitle}>Select the intensity that fits your lifestyle</Text>

          {goals.map((g, index) => {
            const isSelected = goal === g.xp;
            const animationDelay = index * 100;
            const translateY = slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [animationDelay, 0]
            });

            return (
              <Animated.View
                key={g.id}
                style={[
                  styles.goalWrapper,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY }]
                  }
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.goalCard,
                    { backgroundColor: theme.card },
                    isSelected && styles.selectedCard
                  ]}
                  onPress={() => handleSelectGoal(g.xp)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isSelected ? g.gradient : [theme.card, theme.card]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.goalGradient}
                  >
                    <View style={styles.goalHeader}>
                      <View style={[styles.goalIcon, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${g.color}20` }]}>
                        <FontAwesome5 name={g.icon} size={20} color={isSelected ? '#fff' : g.color} />
                      </View>
                      <View style={styles.goalTitleContainer}>
                        <Text style={[styles.goalLabel, { color: theme.text }, isSelected && styles.selectedText]}>
                          {g.label}
                        </Text>
                        <Text style={[styles.goalDescription, { color: theme.subText }, isSelected && styles.selectedDescription]}>
                          {g.description}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.goalDetails}>
                      <View style={styles.goalDetailItem}>
                        <MaterialIcons name="access-time" size={16} color={isSelected ? '#fff' : theme.subText} />
                        <Text style={[styles.goalDetailText, { color: theme.subText }, isSelected && styles.selectedDetailText]}>
                          {g.timeCommitment}
                        </Text>
                      </View>
                      <View style={styles.goalDetailItem}>
                        <MaterialIcons name="stars" size={16} color={isSelected ? '#fff' : theme.subText} />
                        <Text style={[styles.goalDetailText, { color: theme.subText }, isSelected && styles.selectedDetailText]}>
                          {g.xp} XP
                        </Text>
                      </View>
                    </View>

                    {/* Achievements Preview */}
                    <View style={styles.achievementPreview}>
                      {g.achievements.map((ach, i) => (
                        <View key={i} style={[styles.achievementTag, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : theme.background }]}>
                          <Text style={[styles.achievementTagText, { color: theme.subText }, isSelected && styles.selectedAchievementText]}>
                            {ach}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {isSelected && (
                      <View style={styles.selectedCheck}>
                        <MaterialIcons name="check-circle" size={24} color="#fff" />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          {renderXPBreakdown()}

          {/* Save Button */}
          <TouchableOpacity style={styles.saveButton} onPress={saveGoal}>
            <LinearGradient
              colors={['#4CAF50', '#2E7D32']}
              style={styles.saveGradient}
            >
              <MaterialIcons name="save" size={20} color="#fff" />
              <Text style={styles.saveText}>Save Goal</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Info Text */}
          <Text style={styles.infoText}>
            You can always adjust your goal later in settings
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  currentGoalPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 15,
    marginTop: 10,
  },
  currentGoalIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  currentGoalInfo: {
    flex: 1,
  },
  currentGoalLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  currentGoalXP: {
    color: '#FFD700',
    fontSize: 14,
  },
  content: {
    padding: 20,
  },
  motivationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF9C4',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  motivationContent: {
    flex: 1,
    marginLeft: 12,
  },
  motivationText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  proverbText: {
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 15,
  },
  goalWrapper: {
    marginBottom: 12,
  },
  goalCard: {
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedCard: {
    elevation: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  goalGradient: {
    padding: 15,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goalTitleContainer: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  selectedText: {
    color: '#fff',
  },
  goalDescription: {
    fontSize: 12,
  },
  selectedDescription: {
    color: 'rgba(255,255,255,0.9)',
  },
  goalDetails: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 15,
  },
  goalDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goalDetailText: {
    fontSize: 12,
  },
  selectedDetailText: {
    color: '#fff',
  },
  achievementPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  achievementTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  achievementTagText: {
    fontSize: 9,
  },
  selectedAchievementText: {
    color: '#fff',
  },
  selectedCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  xpBreakdown: {
    borderRadius: 15,
    padding: 15,
    marginTop: 25,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  breakdownLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  saveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 15,
    marginBottom: 20,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});


export default DailyGoalScreen;
