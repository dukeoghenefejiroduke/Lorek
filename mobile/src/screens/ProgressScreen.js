import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
  StatusBar,
  Modal,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from "../utils/haptics";

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { LineChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import { BlurView } from 'expo-blur';

import { AuthContext } from '../context/AuthContext';
import { progressAPI } from '../services/api';
import { format } from 'date-fns';
import { ThemeContext, lightTheme as theme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

// ============================================================================
// CONSTANTS
// ============================================================================

const TIME_RANGES = {
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
};

const CHART_COLORS = {
  primary: '#4CAF50',
  secondary: '#2196F3',
  tertiary: '#FF9800',
  quaternary: '#9C27B0',
};

// ============================================================================
// COMPONENTS
// ============================================================================

const StatCard = ({ icon, value, label, color, subtext, onPress }) => (
  <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.7}>
    <LinearGradient colors={[`${color}20`, `${color}10`]} style={styles.statGradient}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}30` }]}>
        <Text style={styles.statIcon}>{icon}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
    </LinearGradient>
  </TouchableOpacity>
);

const TimeRangeButton = ({ range, label, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.timeRangeButton, isActive && styles.timeRangeActive]}
    onPress={onPress}
  >
    <Text style={[styles.timeRangeText, isActive && styles.timeRangeTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const CategoryProgressItem = ({ category, index }) => (
  <View style={styles.categoryItem}>
    <View style={styles.categoryHeader}>
      <Text style={styles.categoryName}>{category.name}</Text>
      <Text style={styles.categoryPercentage}>{Math.round(category.averageScore || 0)}%</Text>
    </View>
    <View style={styles.categoryProgressBar}>
      <View 
        style={[
          styles.categoryProgressFill, 
          { 
            width: `${Math.min(100, category.averageScore || 0)}%`,
            backgroundColor: CHART_COLORS[Object.keys(CHART_COLORS)[index % Object.keys(CHART_COLORS).length]]
          }
        ]} 
      />
    </View>
    <Text style={styles.categoryStats}>
      {category.completed || 0}/{category.total || 0} completed • {Math.round(category.totalTime / 60 || 0)} min
    </Text>
  </View>
);

const LessonProgressItem = ({ item }) => (
  <View style={styles.lessonItem}>
    <View style={styles.lessonInfo}>
      <Text style={styles.lessonName}>{item.lessonTitle}</Text>
      <View style={styles.lessonMeta}>
        <Text style={[styles.lessonScore, { color: item.score >= 80 ? '#4CAF50' : item.score >= 60 ? '#FF9800' : '#F44336' }]}>
          Score: {item.score}%
        </Text>
        <Text style={styles.lessonAttempts}>• {item.attempts} attempts</Text>
        <Text style={styles.lessonTime}>• {Math.round(item.timeSpent / 60)} min</Text>
      </View>
    </View>
    <View style={styles.lessonProgressContainer}>
      <View style={styles.lessonProgressBar}>
        <View 
          style={[
            styles.lessonProgressFill, 
            { width: `${item.score}%`, backgroundColor: item.score >= 80 ? '#4CAF50' : item.score >= 60 ? '#FF9800' : '#F44336' }
          ]} 
        />
      </View>
    </View>
  </View>
);

const AchievementCard = ({ achievement, onPress }) => {
  const isUnlocked = achievement.unlocked || achievement.dateEarned;
  
  return (
    <TouchableOpacity
      style={[styles.achievementCard, !isUnlocked && styles.achievementLocked]}
      onPress={() => onPress(achievement)}
      activeOpacity={0.7}
    >
      <View style={[styles.achievementIconContainer, { backgroundColor: `${achievement.tier === 'gold' ? '#FFD700' : achievement.tier === 'silver' ? '#C0C0C0' : '#CD7F32'}20` }]}>
        <Text style={styles.achievementIcon}>{achievement.icon}</Text>
      </View>
      <View style={styles.achievementInfo}>
        <Text style={styles.achievementTitle}>{achievement.name}</Text>
        <Text style={styles.achievementDesc}>{achievement.description}</Text>
        {isUnlocked ? (
          <View style={styles.achievementUnlockedBadge}>
            <MaterialIcons name="check-circle" size={14} color="#4CAF50" />
            <Text style={styles.achievementUnlockedText}>Unlocked</Text>
          </View>
        ) : (
          <View style={styles.achievementProgress}>
            <View style={styles.achievementProgressBar}>
              <View style={[styles.achievementProgressFill, { width: `${achievement.progress || 0}%` }]} />
            </View>
            <Text style={styles.achievementProgressText}>
              {Math.round(achievement.progress || 0)}%
            </Text>
          </View>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={20} color="#ccc" />
    </TouchableOpacity>
  );
};

const MilestoneItem = ({ milestone }) => (
  <View style={styles.milestoneItem}>
    <Text style={styles.milestoneLabel}>{milestone.badge?.name || milestone.type}</Text>
    <View style={styles.milestoneProgress}>
      <View style={styles.milestoneProgressBar}>
        <View style={[styles.milestoneProgressFill, { width: `${milestone.percentage}%` }]} />
      </View>
      <Text style={styles.milestoneValue}>
        {milestone.current}/{milestone.target}
      </Text>
    </View>
  </View>
);

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function ProgressScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  
  // State
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState(TIME_RANGES.WEEK);
  const [graphData, setGraphData] = useState(null);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [categoryProgress, setCategoryProgress] = useState(null);
  
  const { isDarkMode, theme } = useContext(ThemeContext);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const StatCard = ({ icon, value, label, color, subtext, onPress }) => (
    <TouchableOpacity 
      style={[styles.statCard, { backgroundColor: theme.card }]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <LinearGradient 
        colors={isDarkMode ? [`${color}30`, `${color}15`] : [`${color}20`, `${color}10`]} 
        style={styles.statGradient}
      >
        <View style={[styles.statIconContainer, { backgroundColor: `${color}30` }]}>
          <Text style={styles.statIcon}>{icon}</Text>
        </View>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
        {subtext && <Text style={[styles.statSubtext, { color: theme.subText, opacity: 0.7 }]}>{subtext}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );

  const TimeRangeButton = ({ range, label, isActive, onPress }) => (
    <TouchableOpacity
      style={[
        styles.timeRangeButton, 
        isActive && { backgroundColor: theme.primary }
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.timeRangeText, 
        { color: isActive ? '#fff' : theme.subText }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const CategoryProgressItem = ({ category, index }) => (
    <View style={styles.categoryItem}>
      <View style={styles.categoryHeader}>
        <Text style={[styles.categoryName, { color: theme.text }]}>{category.name}</Text>
        <Text style={[styles.categoryPercentage, { color: theme.success }]}>{Math.round(category.averageScore || 0)}%</Text>
      </View>
      <View style={[styles.categoryProgressBar, { backgroundColor: theme.border }]}>
        <View 
          style={[
            styles.categoryProgressFill, 
            { 
              width: `${Math.min(100, category.averageScore || 0)}%`,
              backgroundColor: CHART_COLORS[Object.keys(CHART_COLORS)[index % Object.keys(CHART_COLORS).length]]
            }
          ]} 
        />
      </View>
      <Text style={[styles.categoryStats, { color: theme.subText }]}>
        {category.completed || 0}/{category.total || 0} completed • {Math.round(category.totalTime / 60 || 0)} min
      </Text>
    </View>
  );

  const LessonProgressItem = ({ item }) => (
    <View style={styles.lessonItem}>
      <View style={styles.lessonInfo}>
        <Text style={[styles.lessonName, { color: theme.text }]}>{item.lessonTitle}</Text>
        <View style={styles.lessonMeta}>
          <Text style={[styles.lessonScore, { color: item.score >= 80 ? theme.success : item.score >= 60 ? theme.warning : theme.error }]}>
            Score: {item.score}%
          </Text>
          <Text style={[styles.lessonAttempts, { color: theme.subText }]}>• {item.attempts} attempts</Text>
          <Text style={[styles.lessonTime, { color: theme.subText }]}>• {Math.round(item.timeSpent / 60)} min</Text>
        </View>
      </View>
      <View style={styles.lessonProgressContainer}>
        <View style={[styles.lessonProgressBar, { backgroundColor: theme.border }]}>
          <View 
            style={[
              styles.lessonProgressFill, 
              { 
                width: `${item.score}%`, 
                backgroundColor: item.score >= 80 ? theme.success : item.score >= 60 ? theme.warning : theme.error 
              }
            ]} 
          />
        </View>
      </View>
    </View>
  );

  const AchievementCard = ({ achievement, onPress }) => {
    const isUnlocked = achievement.unlocked || achievement.dateEarned;
    
    return (
      <TouchableOpacity
        style={[
          styles.achievementCard, 
          { backgroundColor: theme.card, borderBottomColor: theme.border },
          !isUnlocked && styles.achievementLocked
        ]}
        onPress={() => onPress(achievement)}
        activeOpacity={0.7}
      >
        <View style={[styles.achievementIconContainer, { backgroundColor: `${achievement.tier === 'gold' ? '#FFD700' : achievement.tier === 'silver' ? '#C0C0C0' : '#CD7F32'}20` }]}>
          <Text style={styles.achievementIcon}>{achievement.icon}</Text>
        </View>
        <View style={styles.achievementInfo}>
          <Text style={[styles.achievementTitle, { color: theme.text }]}>{achievement.name}</Text>
          <Text style={[styles.achievementDesc, { color: theme.subText }]}>{achievement.description}</Text>
          {isUnlocked ? (
            <View style={styles.achievementUnlockedBadge}>
              <MaterialIcons name="check-circle" size={14} color={theme.success} />
              <Text style={[styles.achievementUnlockedText, { color: theme.success }]}>Unlocked</Text>
            </View>
          ) : (
            <View style={styles.achievementProgress}>
              <View style={[styles.achievementProgressBar, { backgroundColor: theme.border }]}>
                <View style={[styles.achievementProgressFill, { width: `${achievement.progress || 0}%`, backgroundColor: theme.primary }]} />
              </View>
              <Text style={[styles.achievementProgressText, { color: theme.subText }]}>
                {Math.round(achievement.progress || 0)}%
              </Text>
            </View>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.border} />
      </TouchableOpacity>
    );
  };

  const MilestoneItem = ({ milestone }) => (
    <View style={styles.milestoneItem}>
      <Text style={[styles.milestoneLabel, { color: theme.text }]}>{milestone.badge?.name || milestone.type}</Text>
      <View style={styles.milestoneProgress}>
        <View style={[styles.milestoneProgressBar, { backgroundColor: theme.border }]}>
          <View style={[styles.milestoneProgressFill, { width: `${milestone.percentage}%`, backgroundColor: theme.primary }]} />
        </View>
        <Text style={[styles.milestoneValue, { color: theme.subText }]}>
          {milestone.current}/{milestone.target}
        </Text>
      </View>
    </View>
  );

  useEffect(() => {
    loadAllData();
    startAnimations();
    startRotateAnimation();

    return () => {
      // Cleanup
    };
  }, []);

  useEffect(() => {
    if (timeRange) {
      loadGraphData();
    }
  }, [timeRange]);

  const startAnimations = () => {
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
  };

  const startRotateAnimation = () => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProgress(),
        loadCategoryProgress(),
        loadGraphData(),
      ]);
    } catch (error) {
      console.error('Error loading progress data:', error);
      Alert.alert('Error', 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const response = await progressAPI.get();
      setProgress(response.data.data);
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  };

  const loadCategoryProgress = async () => {
    try {
      const response = await progressAPI.getCategories();
      setCategoryProgress(response.data.data);
    } catch (error) {
      console.error('Error fetching category progress:', error);
    }
  };

  const loadGraphData = async () => {
    try {
      const response = await progressAPI.getGraph({ period: timeRange });
      setGraphData(response.data.data);
    } catch (error) {
      console.error('Error fetching graph data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };
  
const getChartData = () => {
  // Add a deep check for the data structure
  if (!graphData?.daily || !Array.isArray(graphData.daily) || graphData.daily.length === 0) {
    return null;
  }
  
  const labels = graphData.daily.map(d => d.date ? format(new Date(d.date), 'EEE') : '');
  // Force values to numbers and fallback to 0 to prevent "Invalid number" error
  const data = graphData.daily.map(d => {
    const val = Number(d.points);
    return isNaN(val) ? 0 : val;
  });
  
  return { labels, datasets: [{ data }] };
};

const getPieData = () => {
  if (!categoryProgress?.byCategory) return [];
  
  const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'];
  let index = 0;
  
  return Object.entries(categoryProgress.byCategory)
    .map(([name, data]) => {
      // Ensure we have a valid number for 'population' (PieChart requirement)
      const popValue = Number(data.completionPercentage);
      return {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        population: isNaN(popValue) || popValue < 0 ? 0 : popValue, 
        color: colors[index++ % colors.length],
        legendFontColor: '#7F7F7F',
        legendFontSize: 12,
      };
    })
    .filter(item => item.population > 0); // Only show categories with progress
};

const handleExportData = async () => {
  try {
    haptics.impactMedium();
    
    const startExport = async (format) => {
      try {
        // 1. Fetch data
        const response = await progressAPI.export({ format });
        
        // 2. Create a temporary local file path
        const filename = `izon_progress_${new Date().getTime()}.${format}`;
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;

        // 3. Write the data to the device cache
        const dataToWrite = format === 'json' 
          ? JSON.stringify(response.data, null, 2) 
          : response.data;

        await FileSystem.writeAsStringAsync(fileUri, dataToWrite, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        // 4. Open the native "Share/Save to Files" dialog
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Saved', 'File saved to app cache.');
        }
      } catch (err) {
        Alert.alert('Export Failed', 'Could not process the file download.');
      }
    };

    Alert.alert(
      'Export Progress',
      'Choose export format',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'CSV', onPress: () => startExport('csv') },
        { text: 'JSON', onPress: () => startExport('json') },
      ]
    );
  } catch (error) {
    Alert.alert('Error', 'Failed to initiate export');
  }
};


  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <FontAwesome5 name="chart-line" size={60} color="#4CAF50" />
        </Animated.View>
        <Text style={styles.loadingText}>Analyzing your progress...</Text>
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
      </View>
    );
  }

  const chartData = getChartData();
  const pieData = getPieData();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

      {/* Animated Background Pattern */}
      <Animated.View style={[styles.backgroundPattern, { transform: [{ rotate }] }]}>
        <Text style={[styles.patternText, { color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>⚡ 𖦹 🔱 ⚡ 𖦹 🔱</Text>
      </Animated.View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
        }
      >
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
            
            <Text style={styles.headerTitle}>Learning Progress</Text>
            
            <TouchableOpacity style={styles.exportButton} onPress={handleExportData}>
              <Ionicons name="download-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* User Welcome */}
          <Animated.View style={[styles.userWelcome, { opacity: fadeAnim }]}>
            <Text style={styles.userName}>Welcome back, {user?.username || 'Learner'}!</Text>
            <Text style={styles.userLevel}>
              <FontAwesome5 name="crown" size={14} color="#FFD700" /> Level {progress?.user?.level || 1}
            </Text>
          </Animated.View>
        </LinearGradient>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard 
              icon="🔥" 
              value={progress?.progress?.currentStreak || 0} 
              label="Day Streak" 
              color="#FF6B6B"
              onPress={() => Alert.alert('Streak Info', `Longest streak: ${progress?.progress?.longestStreak || 0} days`)}
            />
            <StatCard 
              icon="⭐" 
              value={progress?.progress?.totalPoints || 0} 
              label="Total Points" 
              color="#FFD700" 
            />
            <StatCard 
              icon="📚" 
              value={progress?.progress?.completedLessons || 0} 
              label="Lessons Done" 
              color="#4CAF50" 
              subtext={`${progress?.progress?.completionRate || 0}% complete`}
            />
            <StatCard 
              icon="📖" 
              value={progress?.vocabulary?.totalLearned || 0} 
              label="Words Learned" 
              color="#9C27B0" 
              subtext={`${progress?.vocabulary?.mastered || 0} mastered`}
            />
            <StatCard 
              icon="✓" 
              value={`${Math.round(progress?.statistics?.averageScore || 0)}%`} 
              label="Avg Accuracy" 
              color="#FF9800" 
            />
            <StatCard 
              icon="⏱️" 
              value={formatTime(progress?.statistics?.totalTimeSpent || 0)} 
              label="Time Spent" 
              color="#00BCD4" 
            />
            <StatCard 
              icon="🏆" 
              value={progress?.achievements?.total || 0} 
              label="Achievements" 
              color="#F44336" 
            />
            <StatCard 
              icon="🎯" 
              value={progress?.rank?.rank || '-'} 
              label="Global Rank" 
              color="#2196F3" 
              subtext={`Top ${100 - (progress?.rank?.percentile || 0)}%`}
            />
          </View>

          {/* Time Range Selector */}
          <View style={styles.timeRangeContainer}>
            <TimeRangeButton 
              range={TIME_RANGES.WEEK} 
              label="Week" 
              isActive={timeRange === TIME_RANGES.WEEK}
              onPress={() => setTimeRange(TIME_RANGES.WEEK)}
            />
            <TimeRangeButton 
              range={TIME_RANGES.MONTH} 
              label="Month" 
              isActive={timeRange === TIME_RANGES.MONTH}
              onPress={() => setTimeRange(TIME_RANGES.MONTH)}
            />
            <TimeRangeButton 
              range={TIME_RANGES.YEAR} 
              label="Year" 
              isActive={timeRange === TIME_RANGES.YEAR}
              onPress={() => setTimeRange(TIME_RANGES.YEAR)}
            />
          </View>

          {/* Activity Chart */}
          {chartData && (
            <Animated.View style={[styles.chartCard, { opacity: fadeAnim }]}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Learning Activity</Text>
                <TouchableOpacity onPress={() => setChartModalVisible(true)}>
                  <Text style={styles.viewDetailsText}>View Details</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={chartData}
                  width={Math.max(width - 60, chartData.labels.length * 60)}
                  height={200}
                  chartConfig={{
                    backgroundColor: theme.card,
                    backgroundGradientFrom: theme.card,
                    backgroundGradientTo: theme.card,
                    decimalPlaces: 0,
                    color: (opacity = 1) => isDarkMode ? `rgba(129, 199, 132, ${opacity})` : `rgba(76, 175, 80, ${opacity})`,
                    labelColor: (opacity = 1) => isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: {
                      r: "6",
                      strokeWidth: "2",
                      stroke: theme.primary
                    }
                  }}
                  bezier
                  style={styles.chart}
                />
                </ScrollView>
                {graphData?.summary && (
                <View style={styles.chartSummary}>
                  <Text style={[styles.chartSummaryText, { color: theme.subText }]}>
                    Total: {graphData.summary.totalPoints} points • {graphData.summary.totalLessons} lessons • {Math.round(graphData.summary.totalTime / 60)} min
                  </Text>
                </View>
                )}
                </Animated.View>
                )}

                {/* Category Progress */}
                {categoryProgress?.byCategory && Object.keys(categoryProgress.byCategory).length > 0 && (
                <Animated.View style={[styles.categoryCard, { backgroundColor: theme.card, opacity: fadeAnim }]}>
                <View style={styles.categoryHeader}>
                <Text style={[styles.categoryTitle, { color: theme.text }]}>Category Progress</Text>
                <TouchableOpacity onPress={() => setChartModalVisible(true)}>
                  <Text style={[styles.viewDetailsText, { color: theme.primary }]}>View Details</Text>
                </TouchableOpacity>
                </View>
                {Object.entries(categoryProgress.byCategory).map(([name, data], index) => (
                <CategoryProgressItem key={name} category={{ name, ...data }} index={index} />
                ))}
                </Animated.View>
                )}

                {/* Next Milestones */}
                {progress?.nextMilestones && progress.nextMilestones.length > 0 && (
                <Animated.View style={[styles.milestonesCard, { backgroundColor: theme.card, opacity: fadeAnim }]}>
                <Text style={[styles.milestonesTitle, { color: theme.text }]}>Next Milestones</Text>
                {progress.nextMilestones.map((milestone, index) => (
                <MilestoneItem key={index} milestone={milestone} />
                ))}
                </Animated.View>
                )}

                {/* Recent Lessons */}
                {progress?.lessonProgress && progress.lessonProgress.length > 0 && (
                <Animated.View style={[styles.lessonsCard, { backgroundColor: theme.card, opacity: fadeAnim }]}>
                <Text style={[styles.lessonsTitle, { color: theme.text }]}>Recent Lessons</Text>
                {progress.lessonProgress.slice(0, 5).map((item, index) => (
                <LessonProgressItem key={index} item={item} />
                ))}
                </Animated.View>
                )}

                {/* Achievements */}
                {progress?.achievements?.allBadges && progress.achievements.allBadges.length > 0 && (
                <Animated.View style={[styles.achievementsCard, { backgroundColor: theme.card, opacity: fadeAnim }]}>
                <Text style={[styles.achievementsTitle, { color: theme.text }]}>Achievements</Text>
                {progress.achievements.allBadges.slice(0, 5).map((achievement, index) => (
                <AchievementCard 
                  key={index} 
                  achievement={achievement} 
                  onPress={(item) => {
                    setSelectedAchievement(item);
                    setModalVisible(true);
                  }}
                />
                ))}
                </Animated.View>
                )}
                </View>
                </ScrollView>

                {/* Achievement Detail Modal */}
                <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
                >
                <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? "dark" : "light"} style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                <LinearGradient colors={['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Achievement Details</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                </LinearGradient>

                {selectedAchievement && (
                <ScrollView style={styles.modalBody}>
                <View style={styles.modalAchievementIcon}>
                  <Text style={styles.modalAchievementEmoji}>{selectedAchievement.icon}</Text>
                </View>

                <Text style={[styles.modalAchievementTitle, { color: theme.text }]}>{selectedAchievement.name}</Text>
                <Text style={[styles.modalAchievementDesc, { color: theme.subText }]}>{selectedAchievement.description}</Text>

                {selectedAchievement.dateEarned ? (
                  <View style={styles.modalUnlocked}>
                    <MaterialIcons name="check-circle" size={50} color={theme.success} />
                    <Text style={[styles.modalUnlockedText, { color: theme.success }]}>
                      Unlocked on {format(new Date(selectedAchievement.dateEarned), 'PPP')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.modalLocked}>
                    <Text style={[styles.modalProgressText, { color: theme.text }]}>Progress: {Math.round(selectedAchievement.progress || 0)}%</Text>
                    <Text style={[styles.modalRewardText, { color: theme.accent }]}>Keep learning to unlock this achievement!</Text>
                  </View>
                )}
                </ScrollView>
                )}
                </View>
                </BlurView>
                </Modal>

                {/* Chart Details Modal */}
                <Modal
                animationType="slide"
                transparent={true}
                visible={chartModalVisible}
                onRequestClose={() => setChartModalVisible(false)}
                >
                <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? "dark" : "light"} style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                <LinearGradient colors={['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Detailed Analytics</Text>
                <TouchableOpacity onPress={() => setChartModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                </LinearGradient>

                <ScrollView style={styles.modalBody}>
                {pieData.length > 0 && (
                <>
                  <Text style={[styles.modalChartTitle, { color: theme.text }]}>Category Distribution</Text>
                  <PieChart
                    data={pieData}
                    width={width - 80}
                    height={200}
                    chartConfig={{
                      color: (opacity = 1) => isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                      labelColor: (opacity = 1) => isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                    }}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    absolute
                  />
                </>
                )}

                {chartData && (
                <>
                  <Text style={[styles.modalChartTitle, { color: theme.text }]}>Weekly Progress</Text>
                  <LineChart
                    data={chartData}
                    width={width - 80}
                    height={200}
                    chartConfig={{
                      backgroundColor: theme.card,
                      backgroundGradientFrom: theme.card,
                      backgroundGradientTo: theme.card,
                      decimalPlaces: 0,
                      color: (opacity = 1) => isDarkMode ? `rgba(129, 199, 132, ${opacity})` : `rgba(76, 175, 80, ${opacity})`,
                      labelColor: (opacity = 1) => isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                    }}
                    bezier
                    style={styles.modalChart}
                  />
                </>
                )}

                {progress?.recommendations && progress.recommendations.length > 0 && (
                <View style={[styles.recommendationsSection, { backgroundColor: isDarkMode ? '#222' : '#f5f5f5' }]}>
                  <Text style={[styles.modalChartTitle, { color: theme.text, marginTop: 0 }]}>Recommendations</Text>
                  {progress.recommendations.map((rec, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <MaterialIcons name="lightbulb" size={20} color={theme.warning} />
                      <Text style={[styles.recommendationText, { color: theme.subText }]}>{rec.reason}</Text>
                    </View>
                  ))}
                </View>
                )}
                </ScrollView>
                </View>
                </BlurView>
                </Modal>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  scrollContent: {
    flexGrow: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  exportButton: { padding: 8 },
  userWelcome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: { fontSize: 16, color: 'rgba(255,255,255,0.9)' },
  userLevel: { fontSize: 14, color: '#FFD700' },
  content: { padding: 20, marginTop: -10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { width: (width - 60) / 2, marginBottom: 10, borderRadius: 15, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  statGradient: { padding: 15, alignItems: 'center' },
  statIconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  statLabel: { fontSize: 12, color: '#666', marginBottom: 2 },
  statSubtext: { fontSize: 10, color: '#999' },
  timeRangeContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 25, padding: 4, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  timeRangeButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 21 },
  timeRangeActive: { backgroundColor: '#4CAF50' },
  timeRangeText: { fontSize: 14, color: '#666' },
  timeRangeTextActive: { color: '#fff', fontWeight: '600' },
  chartCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  chartTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  viewDetailsText: { color: '#4CAF50', fontSize: 14 },
  chart: { borderRadius: 16, marginVertical: 10 },
  chartSummary: { marginTop: 10, alignItems: 'center' },
  chartSummaryText: { fontSize: 12, color: '#999' },
  categoryCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 3 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  categoryTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  categoryItem: { marginBottom: 15 },
  categoryName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  categoryPercentage: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  categoryProgressBar: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  categoryProgressFill: { height: '100%', borderRadius: 3 },
  categoryStats: { fontSize: 11, color: '#999', marginTop: 2 },
  lessonsCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 3 },
  lessonsTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  lessonItem: { marginBottom: 15 },
  lessonInfo: { marginBottom: 8 },
  lessonName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  lessonMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  lessonScore: { fontSize: 13, fontWeight: '600' },
  lessonAttempts: { fontSize: 13, color: '#999', marginLeft: 4 },
  lessonTime: { fontSize: 13, color: '#999', marginLeft: 4 },
  lessonProgressContainer: { marginTop: 4 },
  lessonProgressBar: { height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' },
  lessonProgressFill: { height: '100%', borderRadius: 2 },
  achievementsCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 3 },
  achievementsTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  achievementCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  achievementLocked: { opacity: 0.8 },
  achievementIconContainer: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  achievementIcon: { fontSize: 24 },
  achievementInfo: { flex: 1 },
  achievementTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 2 },
  achievementDesc: { fontSize: 12, color: '#666', marginBottom: 4 },
  achievementProgress: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  achievementProgressBar: { flex: 1, height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, marginRight: 8, overflow: 'hidden' },
  achievementProgressFill: { height: '100%', borderRadius: 2, backgroundColor: '#4CAF50' },
  achievementProgressText: { fontSize: 10, color: '#666' },
  achievementUnlockedBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  achievementUnlockedText: { fontSize: 11, fontWeight: '600', color: '#4CAF50' },
  milestonesCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 3 },
  milestonesTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  milestoneItem: { marginBottom: 15 },
  milestoneLabel: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 4 },
  milestoneProgress: { flexDirection: 'row', alignItems: 'center' },
  milestoneProgressBar: { flex: 1, height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, marginRight: 10, overflow: 'hidden' },
  milestoneProgressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 3 },
  milestoneValue: { fontSize: 12, color: '#999', width: 50, textAlign: 'right' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalBody: { padding: 20 },
  modalAchievementIcon: { alignItems: 'center', marginBottom: 20 },
  modalAchievementEmoji: { fontSize: 80 },
  modalAchievementTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 8 },
  modalAchievementDesc: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20 },
  modalUnlocked: { alignItems: 'center', padding: 20 },
  modalUnlockedText: { fontSize: 16, color: '#4CAF50', marginTop: 10 },
  modalLocked: { alignItems: 'center', padding: 20 },
  modalProgressText: { fontSize: 16, color: '#666', marginBottom: 10 },
  modalRewardText: { fontSize: 18, fontWeight: 'bold', color: '#FFD700' },
  modalChartTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, marginTop: 20 },
  modalChart: { marginVertical: 8, borderRadius: 16 },
  recommendationsSection: { marginTop: 20, padding: 15, backgroundColor: '#f5f5f5', borderRadius: 12 },
  recommendationItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  recommendationText: { fontSize: 14, color: '#666', flex: 1, lineHeight: 20 },
});