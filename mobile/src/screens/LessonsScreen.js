import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  ScrollView,
  Modal,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { BlurView } from 'expo-blur';
import { lessonAPI } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext, lightTheme as theme } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';
import ScreenHeader from '../components/ScreenHeader';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { handleGlobalError } from '../utils/errorHandler';
import LoadingOverlay from '../components/LoadingOverlay';

const { width } = Dimensions.get('window');

const LessonsScreen = ({ navigation }) => {
  const { activeLanguage } = useContext(LanguageContext);
  const [lessons, setLessons] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, totalPoints: 0 });
  const [languageSwitcherVisible, setLanguageSwitcherVisible] = useState(false);

   const { isDarkMode, theme } = useContext(ThemeContext);

  // Use useMemo for filtering logic to avoid unnecessary re-renders and simplify code
  const filteredLessons = useMemo(() => {
    const lessonsArray = Array.isArray(lessons) ? lessons : [];
    let filtered = [...lessonsArray];

    // Apply level filter
    if (filter !== 'all') {
      filtered = filtered.filter(lesson => lesson?.level === filter);
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(lesson =>
        lesson?.title?.english?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lesson?.description?.english?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [lessons, filter, searchQuery]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

const interpolatedRotate = rotateAnim.interpolate({
  inputRange: [0, 1],
  outputRange: ['0deg', '360deg'],  // Full circle over 20 seconds
});

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
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
    fetchLessons();
  }, [activeLanguage]);

const fetchLessons = async () => {
  try {
    setLoading(true);
     const response = await lessonAPI.getAll({  lang: activeLanguage?.code || 'IZON'
     });
    
    // CHANGE THIS LINE: access .data.data
    const data = response.data?.data || []; 
    
    setLessons(data);
    
    // Calculate stats using the correct 'data' variable
    const total = data.length;
    const completed = data.filter(l => l.userProgress?.completed).length;
    const inProgress = data.filter(l => l.userProgress && !l.userProgress.completed).length;
    
    // Note: Backend uses 'estimatedTime.rewards.points' or similar, 
    // adjust this reduce based on your Lesson Model XP field
    const totalPoints = data.reduce((acc, l) => acc + (l.rewards?.points || 0), 0);
    
    setStats({ total, completed, inProgress, totalPoints });
  } catch (error) {
    handleGlobalError(error, 'Lessons Fetch');
    setLessons([]); 
  } finally {
    setLoading(false);
  }
};


  const handleLessonPress = (lesson) => {
    haptics.impactLight();
    setSelectedLesson(lesson);
    setModalVisible(true);
  };

  const startLesson = (lesson) => {
    setModalVisible(false);
    navigation.navigate('LessonDetail', { lessonId: lesson._id });
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'beginner': return ['#4CAF50', '#2E7D32'];
      case 'intermediate': return ['#FF9800', '#F57C00'];
      case 'advanced': return ['#F44336', '#C62828'];
      default: return ['#2196F3', '#1565C0'];
    }
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'beginner': return '🌱';
      case 'intermediate': return '🌿';
      case 'advanced': return '🌳';
      default: return '📚';
    }
  };

  const renderProgressBar = (progress) => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { width: `${progress}%` }]} />
    </View>
  );

  const renderLessonCard = ({ item, index }) => {
    const levelColors = getLevelColor(item.level);
    const progress = item.progress || 0;
    const animationDelay = index * 100;

    return (
      <Animated.View
        style={[
          styles.cardWrapper,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [animationDelay, 0]
              })
            }]
          }
        ]}
      >
        <TouchableOpacity
          style={styles.lessonCard}
          onPress={() => handleLessonPress(item)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={levelColors}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Level Badge */}
            <View style={styles.levelBadge}>
              <Text style={styles.levelIcon}>{getLevelIcon(item.level)}</Text>
              <Text style={styles.levelText}>{item.level}</Text>
            </View>

            {/* Lesson Content */}
            <View style={styles.cardContent}>
              <Text style={styles.lessonTitle}>{item.title.english}</Text>
              <Text style={styles.lessonDescription} numberOfLines={2}>
                {item.description.english}
              </Text>

              {/* Stats Row */}
              <View style={styles.lessonStats}>
                <View style={styles.statItem}>
                  <MaterialIcons name="menu-book" size={14} color="#fff" />
                  <Text style={styles.statText}>{item.vocabulary?.length || 0} words</Text>
                </View>
                <View style={styles.statItem}>
                  <MaterialIcons name="timer" size={14} color="#fff" />
                  <Text style={styles.statText}>{item.duration || 15} min</Text>
                </View>
                <View style={styles.statItem}>
                  <MaterialIcons name="stars" size={14} color="#fff" />
                  <Text style={styles.statText}>{item.points || 10} XP</Text>
                </View>
              </View>

              {/* Progress Bar */}
              {progress > 0 && (
                <View style={styles.progressSection}>
                  {renderProgressBar(progress)}
                  <Text style={styles.progressText}>{progress}% Complete</Text>
                </View>
              )}

              {/* Start Button */}
              <View style={styles.startButtonContainer}>
                <Text style={styles.startButtonText}>
                  {progress > 0 ? 'Continue' : 'Start Lesson'}
                </Text>
                <MaterialIcons name="arrow-forward" size={16} color="#fff" />
              </View>
            </View>

            {/* Decorative Elements */}
            <View style={styles.cardDecoration}>
              <View style={styles.circle1} />
              <View style={styles.circle2} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <View>
      <ScreenHeader 
        title="Learning Path"
        showLanguageSelector={true}
        onLanguagePress={() => setLanguageSwitcherVisible(true)}
        onBackPress={() => navigation.goBack()}
      />
      
      {/* Stats Overview */}
      <View style={[styles.statsContainer, { paddingHorizontal: 20 }]}>
        <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={[styles.statNumber, { color: theme.accent }]}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Lessons</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={[styles.statNumber, { color: theme.accent }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={[styles.statNumber, { color: theme.accent }]}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={[styles.statNumber, { color: theme.accent }]}>{stats.totalPoints}</Text>
          <Text style={styles.statLabel}>Total XP</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterScroll, { paddingHorizontal: 20 }]}
      >
        {['all', 'beginner', 'intermediate', 'advanced'].map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.filterChip,
              filter === level && { backgroundColor: theme.accent },
            ]}
            onPress={() => {
              setFilter(level);
              haptics.impactLight();
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === level && { color: theme.headerGradient[0] },
              ]}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (loading) {
    return <LoadingOverlay visible={loading} message="Loading lessons..." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={isDarkMode ? '#000' : '#1a4c2e'} />

      {/* Animated Background Pattern */}
      <Animated.View style={[styles.backgroundPattern, { transform: [{ rotate: interpolatedRotate }], opacity: isDarkMode ? 0.03 : 0.05 }]}>
        <Text style={[styles.patternText, { color: theme.text }]}>⚡ 𖦹 🔱 ⚡ 𖦹 🔱</Text>
      </Animated.View>

      <FlatList
        data={filteredLessons}
        renderItem={renderLessonCard}
        keyExtractor={(item) => item._id}
         contentContainerStyle={[styles.list, { paddingBottom: 200 }]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: theme.surface }]}>
              <FontAwesome5 name="book-open" size={40} color={theme.subText} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Lessons Found</Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>
              {filter !== 'all' 
                ? `No ${filter} lessons are available at this moment. Try another level!` 
                : 'We are working on adding more lessons. Check back soon for new content!'}
            </Text>
            <TouchableOpacity 
              style={[styles.emptyButton, { backgroundColor: theme.primary }]}
              onPress={() => setFilter('all')}
            >
              <Text style={styles.emptyButtonText}>View All Lessons</Text>
            </TouchableOpacity>
          </View>
        }
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* Lesson Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={selectedLesson ? getLevelColor(selectedLesson.level) : theme.headerGradient}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Lesson Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            {selectedLesson && (
              <ScrollView style={styles.modalBody}>
                {/* Lesson Icon */}
                <View style={styles.modalIconContainer}>
                  <View style={[styles.modalIcon, { backgroundColor: theme.card, shadowColor: '#000' }]}>
                    <Text style={styles.modalIconText}>
                      {getLevelIcon(selectedLesson.level)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.modalLessonTitle, { color: theme.text }]}>{selectedLesson.title.english}</Text>
                
                <View style={[styles.modalLevelBadge, { backgroundColor: `${theme.success}20` }]}>
                  <Text style={[styles.modalLevelText, { color: theme.success }]}>{selectedLesson.level}</Text>
                </View>

                <Text style={[styles.modalDescription, { color: theme.subText }]}>{selectedLesson.description.english}</Text>

                {/* Lesson Stats Grid */}
                <View style={[styles.modalStatsGrid, { backgroundColor: theme.background }]}>
                  <View style={styles.modalStatItem}>
                    <MaterialIcons name="menu-book" size={24} color={theme.success} />
                    <Text style={[styles.modalStatValue, { color: theme.text }]}>
                      {selectedLesson.vocabulary?.length || 0}
                    </Text>
                    <Text style={[styles.modalStatLabel, { color: theme.subText }]}>Words</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <MaterialIcons name="timer" size={24} color={theme.warning} />
                    <Text style={[styles.modalStatValue, { color: theme.text }]}>
                      {selectedLesson.duration || 15}
                    </Text>
                    <Text style={[styles.modalStatLabel, { color: theme.subText }]}>Minutes</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <MaterialIcons name="stars" size={24} color={theme.accent} />
                    <Text style={[styles.modalStatValue, { color: theme.text }]}>
                      {selectedLesson.points || 10}
                    </Text>
                    <Text style={[styles.modalStatLabel, { color: theme.subText }]}>XP</Text>
                  </View>
                </View>

                {/* Lesson Content Preview */}
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: theme.text }]}>What you'll learn</Text>
                  {selectedLesson.vocabulary?.slice(0, 5).map((word, index) => (
                    <View key={index} style={[styles.wordItem, { borderBottomColor: theme.border }]}>
                      <Text style={[styles.wordIzon, { color: theme.text }]}>{word.izon}</Text>
                      <Text style={[styles.wordEnglish, { color: theme.subText }]}> - {word.english}</Text>
                    </View>
                  ))}
                  {selectedLesson.vocabulary?.length > 5 && (
                    <Text style={[styles.moreText, { color: theme.subText }]}>+{selectedLesson.vocabulary.length - 5} more words</Text>
                  )}
                </View>

                {/* Prerequisites */}
                {selectedLesson.prerequisites?.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Prerequisites</Text>
                    {selectedLesson.prerequisites.map((pre, index) => (
                      <View key={index} style={styles.prerequisiteItem}>
                        <MaterialIcons name="check-circle" size={16} color={theme.success} />
                        <Text style={[styles.prerequisiteText, { color: theme.subText }]}>{pre}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.startLessonButton, { backgroundColor: theme.primary }]}
                    onPress={() => startLesson(selectedLesson)}
                  >
                    <Text style={styles.startLessonText}>
                      {selectedLesson.progress > 0 ? 'Continue Lesson' : 'Start Lesson'}
                    </Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.saveButton, { borderColor: theme.primary }]}
                  >
                    <MaterialIcons name="bookmark-border" size={20} color={theme.primary} />
                    <Text style={[styles.saveButtonText, { color: theme.primary }]}>Save for Later</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </BlurView>
      </Modal>
      <LanguageSwitcher
        visible={languageSwitcherVisible}
        onClose={() => setLanguageSwitcherVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Background color is handled dynamically in the component
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
    marginBottom: 15,
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
  searchButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: 12,
    flex: 0.23,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  statLabel: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  activeFilterChip: {
    backgroundColor: '#FFD700',
  },
  filterChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#1a4c2e',
  },
  list: {
    paddingBottom:100,
  },
  cardWrapper: {
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  lessonCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 20,
    position: 'relative',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 15,
    gap: 6,
  },
  levelIcon: {
    fontSize: 14,
  },
  levelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardContent: {
    gap: 12,
  },
  lessonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  lessonDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  lessonStats: {
    flexDirection: 'row',
    gap: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  progressSection: {
    marginTop: 5,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },
  progressText: {
    color: '#fff',
    fontSize: 11,
    opacity: 0.8,
    textAlign: 'right',
  },
  startButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cardDecoration: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  circle1: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  circle2: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 0,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
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
  modalIconContainer: {
    alignItems: 'center',
    marginTop: -50,
    marginBottom: 15,
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalIconText: {
    fontSize: 40,
  },
  modalLessonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalLevelBadge: {
    alignSelf: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 15,
  },
  modalLevelText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
  },
  modalStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  wordItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  wordIzon: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  wordEnglish: {
    fontSize: 16,
    color: '#666',
  },
  moreText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  prerequisiteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  prerequisiteText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  modalActions: {
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  startLessonButton: {
    backgroundColor: '#4CAF50',
  },
  startLessonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  saveButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LessonsScreen;
