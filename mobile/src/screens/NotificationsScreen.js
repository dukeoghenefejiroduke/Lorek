import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { ThemeContext, lightTheme as theme } from '../context/ThemeContext';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  Alert,
  Image,
  Switch,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import haptics from "../utils/haptics";
import { BlurView } from 'expo-blur';
import { LanguageContext } from '../context/LanguageContext';

import { notificationAPI } from '../services/api';

const { width } = Dimensions.get('window');

// ============================================================================
// CONSTANTS
// ============================================================================

const FILTERS = {
  ALL: 'all',
  UNREAD: 'unread',
  PROVERBS: 'proverbs',
  ACHIEVEMENTS: 'achievements',
  STREAKS: 'streaks',
};

const PRIORITY_CONFIG = {
  high: { color: '#F44336', icon: 'priority-high' },
  medium: { color: '#FF9800', icon: 'info' },
  low: { color: '#4CAF50', icon: 'check-circle' },
};

const getNotificationIcon = (type) => {
  const icons = {
    proverb: '📜',
    streak: '🔥',
    badge: '🏅',
    lesson: '📚',
    challenge: '🎯',
    community: '👥',
    achievement: '🏆',
    friend_request: '👋',
    system: '⚙️',
    default: '📣',
  };
  return icons[type] || icons.default;
};

// ============================================================================
// COMPONENTS
// ============================================================================

const FilterChip = ({ label, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.filterChip, isActive && styles.activeFilterChip]}
    onPress={onPress}
  >
    <Text style={[styles.filterChipText, isActive && styles.activeFilterChipText]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const PriorityIndicator = ({ priority }) => (
  <View style={[styles.priorityIndicator, { backgroundColor: PRIORITY_CONFIG[priority]?.color || '#999' }]} />
);

const NotificationIcon = ({ type, isUnread }) => (
  <View style={[styles.notifIcon, isUnread && styles.unreadIcon]}>
    <Text style={styles.notifIconText}>{getNotificationIcon(type)}</Text>
  </View>
);

const NotificationPreview = ({ item }) => {
  if (item.type === 'proverb') {
    return <Text style={styles.notifPreview} numberOfLines={1}>{item.data?.proverb || item.body}</Text>;
  }
  return <Text style={styles.notifPreview} numberOfLines={1}>{item.body}</Text>;
};

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function NotificationsScreen({ navigation }) {
  const { activeLanguage } = useContext(LanguageContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(FILTERS.ALL);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [settings, setSettings] = useState({
    channels: { push: true, email: true, sms: false, inApp: true },
    types: {
      lessonReminders: true,
      streakAlerts: true,
      achievements: true,
      friendActivity: true,
      newContent: true,
      tipsAndTricks: true,
      newsletter: false,
      marketing: false,
      security: true,
      system: true,
    },
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
    emailFrequency: 'instant',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    loadNotifications();
    loadSettings();
    startAnimations();
  }, [activeLanguage]);

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
    ]).start();
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationAPI.getAll({ limit: 50 });
      setNotifications(response.data.data || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await notificationAPI.getSettings();
      setSettings(response.data.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === FILTERS.ALL) return true;
    if (filter === FILTERS.UNREAD) return !notif.read;
    if (filter === FILTERS.PROVERBS) return notif.type === 'proverb';
    if (filter === FILTERS.ACHIEVEMENTS) return ['badge', 'streak', 'challenge', 'achievement'].includes(notif.type);
    if (filter === FILTERS.STREAKS) return notif.type === 'streak';
    return true;
  });

  const markAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === id ? { ...notif, read: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      haptics.impactLight();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, read: true }))
      );
      setUnreadCount(0);
      haptics.notificationSuccess();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await notificationAPI.delete(id);
      const deletedNotif = notifications.find(n => n._id === id);
      setNotifications(prev => prev.filter(notif => notif._id !== id));
      if (deletedNotif && !deletedNotif.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      haptics.notificationSuccess();
    } catch (error) {
      console.error('Failed to delete notification:', error);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const clearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationAPI.deleteAll();
              setNotifications([]);
              setUnreadCount(0);
              haptics.notificationWarning();
            } catch (error) {
              console.error('Failed to clear all:', error);
              Alert.alert('Error', 'Failed to clear notifications');
            }
          }
        }
      ]
    );
  };

  const handleNotificationPress = (item) => {
    if (!item.read) {
      markAsRead(item._id);
    }
    setSelectedNotification(item);
    setModalVisible(true);
  };

  const updateSettings = async (key, value) => {
    setSavingSettings(true);
    try {
      const updatedSettings = { ...settings };
      
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        updatedSettings[parent][child] = value;
      } else {
        updatedSettings[key] = value;
      }
      
      await notificationAPI.updateSettings(updatedSettings);
      setSettings(updatedSettings);
      haptics.impactLight();
    } catch (error) {
      console.error('Failed to update settings:', error);
      Alert.alert('Error', 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const renderSwipeActions = (item) => (
    <View style={styles.swipeActions}>
      {!item.read && (
        <TouchableOpacity
          style={[styles.swipeButton, styles.markReadButton]}
          onPress={() => markAsRead(item._id)}
        >
          <MaterialIcons name="done" size={24} color="#fff" />
          <Text style={styles.swipeButtonText}>Mark Read</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.swipeButton, styles.deleteButton]}
        onPress={() => deleteNotification(item._id)}
      >
        <MaterialIcons name="delete" size={24} color="#fff" />
        <Text style={styles.swipeButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNotificationItem = ({ item, index }) => {
    const animationDelay = index * 50;
    const translateY = slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [20, 0] // Use a fixed small distance instead of index * 50
    });

    return (
      <Animated.View
        style={[
          styles.notifItemWrapper,
          { opacity: fadeAnim, transform: [{ translateY }] }
        ]}
      >
        <Swipeable renderRightActions={() => renderSwipeActions(item)} overshootRight={false}>
          <TouchableOpacity
            style={[styles.notifItem, !item.read && styles.unreadNotif]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
          >
            <PriorityIndicator priority={item.priority} />
            <NotificationIcon type={item.type} isUnread={!item.read} />
            
            <View style={styles.notifContent}>
              <View style={styles.notifHeader}>
                <Text style={[styles.notifTitle, !item.read && styles.unreadTitle]} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.read && <View style={styles.unreadDot} />}
              </View>
              
              <NotificationPreview item={item} />
              
              <View style={styles.notifFooter}>
                <Text style={styles.notifTime}>{formatTime(item.createdAt)}</Text>
                {item.metadata?.category && (
                  <View style={styles.notifCategory}>
                    <Text style={styles.notifCategoryText}>{item.metadata.category}</Text>
                  </View>
                )}
              </View>
            </View>
            
            <MaterialIcons name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        </Swipeable>
      </Animated.View>
    );
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

  const renderHeader = () => (
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
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => setSettingsModalVisible(true)}
        >
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <FilterChip label="All" isActive={filter === FILTERS.ALL} onPress={() => setFilter(FILTERS.ALL)} />
        <FilterChip label="Unread" isActive={filter === FILTERS.UNREAD} onPress={() => setFilter(FILTERS.UNREAD)} />
        <FilterChip label="Proverbs" isActive={filter === FILTERS.PROVERBS} onPress={() => setFilter(FILTERS.PROVERBS)} />
        <FilterChip label="Achievements" isActive={filter === FILTERS.ACHIEVEMENTS} onPress={() => setFilter(FILTERS.ACHIEVEMENTS)} />
        <FilterChip label="Streaks" isActive={filter === FILTERS.STREAKS} onPress={() => setFilter(FILTERS.STREAKS)} />
      </ScrollView>
    </LinearGradient>
  );

  const renderEmptyState = () => (
    <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
      <View style={styles.emptyIcon}>
        <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
      </View>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyText}>
        You're all caught up! Check back later for updates and achievements.
      </Text>
    </Animated.View>
  );

  const renderSettingRow = (label, value, onToggle, icon, disabled = false) => (
    <View style={styles.settingRow}>
      <View style={styles.settingRowLeft}>
        <MaterialIcons name={icon} size={20} color="#4CAF50" />
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled || savingSettings}
        trackColor={{ false: '#767577', true: '#4CAF50' }}
        thumbColor={value ? '#fff' : '#f4f3f4'}
      />
    </View>
  );
  
const NotificationItem = React.memo(({ item, index, slideAnim, fadeAnim, handlePress, renderSwipeActions }) => {
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0]
  });

  return (
    <Animated.View
      style={[
        styles.notifItemWrapper,
        { 
          opacity: fadeAnim, 
          transform: [{ translateY }] 
        }
      ]}
    >
      <Swipeable renderRightActions={() => renderSwipeActions(item)} overshootRight={false}>
        <TouchableOpacity
          style={[styles.notifItem, !item.read && styles.unreadNotif]}
          onPress={() => handlePress(item)}
          activeOpacity={0.7}
        >
          <PriorityIndicator priority={item.priority} />
          <NotificationIcon type={item.type} isUnread={!item.read} />
          
          <View style={styles.notifContent}>
            <View style={styles.notifHeader}>
              <Text style={[styles.notifTitle, !item.read && styles.unreadTitle]} numberOfLines={1}>
                {item.title}
              </Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            
            <NotificationPreview item={item} />
            
            <View style={styles.notifFooter}>
              <Text style={styles.notifTime}>{item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ''}</Text>
              {item.metadata?.category && (
                <View style={styles.notifCategory}>
                  <Text style={styles.notifCategoryText}>{item.metadata.category}</Text>
                </View>
              )}
            </View>
          </View>
          
          <MaterialIcons name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
});

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

      <FlatList
        data={filteredNotifications}
        keyExtractor={item => item._id}
        
        renderItem={({ item, index }) => (
         <NotificationItem 
           item={item} 
           index={index} 
           slideAnim={slideAnim} 
           fadeAnim={fadeAnim} 
           handlePress={handleNotificationPress} 
           renderSwipeActions={renderSwipeActions}
          />
        )}
        
        initialNumToRender={15} 
        windowSize={11} // Keeps roughly 5 screens worth of items in memory
        removeClippedSubviews={true} // Helps performance on Android
        maxToRenderPerBatch={10}
        
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
        }
      />

      {/* Mark All Read & Clear All Buttons */}
      {notifications.length > 0 && (
        <Animated.View style={[styles.actionButtons, { opacity: fadeAnim }]}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
              <MaterialIcons name="done-all" size={20} color="#4CAF50" />
              <Text style={styles.markAllText}>Mark All Read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.clearAllButton} onPress={clearAll}>
            <MaterialIcons name="delete-sweep" size={20} color="#F44336" />
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient colors={['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notification Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalBody}>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Channels</Text>
                {renderSettingRow('Push Notifications', settings.channels?.push, (v) => updateSettings('channels.push', v), 'notifications-active')}
                {renderSettingRow('Email Notifications', settings.channels?.email, (v) => updateSettings('channels.email', v), 'email')}
                {renderSettingRow('In-App Notifications', settings.channels?.inApp, (v) => updateSettings('channels.inApp', v), 'phone-android')}
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Notification Types</Text>
                {renderSettingRow('Lesson Reminders', settings.types?.lessonReminders, (v) => updateSettings('types.lessonReminders', v), 'school')}
                {renderSettingRow('Streak Alerts', settings.types?.streakAlerts, (v) => updateSettings('types.streakAlerts', v), 'whatshot')}
                {renderSettingRow('Achievements', settings.types?.achievements, (v) => updateSettings('types.achievements', v), 'emoji-events')}
                {renderSettingRow('Friend Activity', settings.types?.friendActivity, (v) => updateSettings('types.friendActivity', v), 'people')}
                {renderSettingRow('New Content', settings.types?.newContent, (v) => updateSettings('types.newContent', v), 'new-releases')}
                {renderSettingRow('Tips & Tricks', settings.types?.tipsAndTricks, (v) => updateSettings('types.tipsAndTricks', v), 'lightbulb')}
                {renderSettingRow('Security Alerts', settings.types?.security, (v) => updateSettings('types.security', v), 'security')}
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Email Frequency</Text>
                <View style={styles.frequencyButtons}>
                  {['instant', 'daily', 'weekly', 'never'].map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.frequencyButton, settings.emailFrequency === freq && styles.activeFrequency]}
                      onPress={() => updateSettings('emailFrequency', freq)}
                    >
                      <Text style={[styles.frequencyText, settings.emailFrequency === freq && styles.activeFrequencyText]}>
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
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
    backgroundColor: theme.background,
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
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  badge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: { color: '#1a4c2e', fontSize: 12, fontWeight: 'bold' },
  settingsButton: { padding: 8 },
  filterScroll: { flexDirection: 'row', marginTop: 10 },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  activeFilterChip: { backgroundColor: '#FFD700' },
  filterChipText: { color: '#fff', fontSize: 14 },
  activeFilterChipText: { color: '#1a4c2e', fontWeight: '600' },
  list: { paddingBottom: 80 },
  notifItemWrapper: { marginHorizontal: 20, marginBottom: 10, borderRadius: 15, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  notifItem: { flexDirection: 'row', backgroundColor: theme.card, padding: 15, borderLeftWidth: 4 },
  unreadNotif: { backgroundColor: '#f0f8ff' },
  priorityIndicator: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  notifIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  unreadIcon: { backgroundColor: '#e8f5e9' },
  notifIconText: { fontSize: 24 },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  notifTitle: { fontSize: 15, fontWeight: '600', color: theme.text, flex: 1 },
  unreadTitle: { fontWeight: '700', color: '#1a4c2e' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginLeft: 8 },
  notifPreview: { fontSize: 13, color: theme.subText, marginBottom: 6 },
  notifFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifTime: { fontSize: 11, color: '#999' },
  notifCategory: { backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  notifCategoryText: { fontSize: 9, color: theme.subText, textTransform: 'capitalize' },
  swipeActions: { flexDirection: 'row', height: '100%' },
  swipeButton: { justifyContent: 'center', alignItems: 'center', width: 80, padding: 10 },
  markReadButton: { backgroundColor: '#4CAF50' },
  deleteButton: { backgroundColor: '#F44336' },
  swipeButtonText: { color: '#fff', fontSize: 10, marginTop: 4 },
  actionButtons: { position: 'absolute', bottom: 20, right: 20, flexDirection: 'row', gap: 10 },
  markAllButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 25, elevation: 5, gap: 6 },
  markAllText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  clearAllButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 25, elevation: 5, gap: 6 },
  clearAllText: { color: '#F44336', fontSize: 14, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalBody: { padding: 20 },
  settingsSection: { marginBottom: 25 },
  settingsSectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 15 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 16, color: theme.subText },
  frequencyButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  frequencyButton: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center' },
  activeFrequency: { backgroundColor: '#4CAF50' },
  frequencyText: { color: theme.subText, fontWeight: '600' },
  activeFrequencyText: {
    color: '#fff',
    fontWeight: '600',
  },
});