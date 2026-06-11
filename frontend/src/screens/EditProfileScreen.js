import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Switch,
  Modal,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import haptics from '../utils/haptics';
import DateTimePicker from '@react-native-community/datetimepicker'; 

import { ThemeContext, lightTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { authAPI, userAPI } from '../services/api';

const { width } = Dimensions.get('window');

export default function EditProfileScreen({ navigation }) {
  const { user, updateUser, logout } = useAuth();
  
  // Form state
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('izon');
  const [profileImage, setProfileImage] = useState(null);
  const [stats, setStats] = useState(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in EditProfileScreen.js:', contextValue);
  const { isDarkMode, theme } = contextValue;
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    loadUserData();
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const response = await userAPI.getProfile();
      const userData = response.data.data.user;
      
      setUsername(userData.username || '');
      setFullName(userData.profile?.fullName || '');
      setEmail(userData.email || '');
      setPhone(userData.phone || '');
      setBio(userData.profile?.bio || '');
      setLocation(userData.location || '');
      setBirthDate(userData.birthDate ? new Date(userData.birthDate) : new Date());
      setNotifications(userData.preferences?.notifications ?? true);
      setDarkMode(userData.preferences?.darkMode ?? false);
      setLanguage(userData.preferences?.language || 'izon');
      setProfileImage(userData.profile?.avatar?.url || null);
      setStats(response.data.data.stats);
      
      // Update context
      updateUser(userData);
    } catch (error) {
      console.error('Failed to load user data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      // Upload image
      const formData = new FormData();
      formData.append('avatar', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      });
      
      try {
        const response = await userAPI.uploadAvatar(formData);
        setProfileImage(response.data.data.avatar.url);
        haptics.notificationSuccess();
        Alert.alert('Success', 'Profile picture updated');
      } catch (error) {
        Alert.alert('Error', 'Failed to upload image');
      }
    }
  };

  const removeAvatar = async () => {
    try {
      await userAPI.removeAvatar();
      setProfileImage(null);
      haptics.notificationSuccess();
      Alert.alert('Success', 'Profile picture removed');
    } catch (error) {
      Alert.alert('Error', 'Failed to remove image');
    }
  };

  const validateForm = () => {
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username cannot be empty');
      return false;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }
    if (phone && !/^\+?[\d\s-]{10,}$/.test(phone)) {
      Alert.alert('Validation Error', 'Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    
    const updatedProfile = {
      username,
      fullName,
      email,
      phone,
      bio,
      location,
      birthDate: birthDate.toISOString(),
      preferences: {
        notifications,
        darkMode,
        language,
      },
    };

    try {
      const response = await userAPI.updateProfile(updatedProfile);
      
      updateUser(response.data.data.user);
      haptics.notificationSuccess();
      
      Alert.alert('Success!', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Update Failed', error.response?.data?.error || 'Could not update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await userAPI.deleteAccount();
              logout();
              Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
              navigation.replace('Main');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account');
            }
          }
        }
      ]
    );
  };

  const StatCard = ({ icon, label, value, color }) => (
    <Animated.View style={[styles.statCard, { opacity: fadeAnim, backgroundColor: theme.card }]}>
      <MaterialIcons name={icon} size={28} color={color} />
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.subText }]}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={isDarkMode ? ['#000000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32', '#43a047']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity style={styles.statsButton} onPress={() => setStatsModalVisible(true)}>
            <Ionicons name="stats-chart" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.profileImageSection, { transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity style={styles.imageContainer} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImagePlaceholder, { backgroundColor: theme.primary }]}>
                <Text style={styles.placeholderText}>{username?.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
              <MaterialIcons name="camera-alt" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
        >
          {/* Stats Overview */}
          {stats && (
            <Animated.View style={[styles.statsRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <StatCard icon="school" label="Words Learned" value={stats.overview?.wordsLearned || 0} color={theme.success} />
              <StatCard icon="whatshot" label="Day Streak" value={stats.streaks?.current || 0} color={theme.error} />
              <StatCard icon="emoji-events" label="Achievements" value={stats.achievements?.total || 0} color={theme.accent} />
            </Animated.View>
          )}

          {/* Personal Information */}
          <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }], backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              <FontAwesome5 name="user-circle" size={18} color={theme.primary} /> Personal Information
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.subText }]}>Username</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={username} onChangeText={setUsername} placeholder="Enter username" placeholderTextColor={theme.subText} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.subText }]}>Full Name</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={fullName} onChangeText={setFullName} placeholder="Enter your full name" placeholderTextColor={theme.subText} />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={[styles.label, { color: theme.subText }]}>Email</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={theme.subText} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.subText }]}>Phone</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={phone} onChangeText={setPhone} placeholder="+234 XXX XXX XXX" placeholderTextColor={theme.subText} keyboardType="phone-pad" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.subText }]}>Bio</Text>
              <TextInput style={[styles.input, styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={bio} onChangeText={setBio} placeholder="Tell us about yourself..." placeholderTextColor={theme.subText} multiline numberOfLines={3} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.subText }]}>Location</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={location} onChangeText={setLocation} placeholder="City, State" placeholderTextColor={theme.subText} />
            </View>

            <TouchableOpacity style={[styles.datePickerButton, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={() => setShowDatePicker(true)}>
              <Text style={[styles.datePickerLabel, { color: theme.subText }]}>Birth Date</Text>
              <Text style={[styles.datePickerValue, { color: theme.text }]}>
                {birthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
              <MaterialIcons name="edit-calendar" size={20} color={theme.primary} />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={birthDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setBirthDate(selectedDate);
                }}
              />
            )}
          </Animated.View>

          {/* Quick Settings */}
          <Animated.View style={[styles.quickMenu, { opacity: fadeAnim, backgroundColor: theme.card }]}>
            <View style={[styles.menuItem, { borderBottomColor: theme.border }]}>
              <View style={[styles.menuIcon, { backgroundColor: theme.secondary + '20' }]}>
                <MaterialIcons name="notifications" size={22} color={theme.secondary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>Push Notifications</Text>
              </View>
              <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: '#767577', true: theme.primary }} />
            </View>

            <View style={[styles.menuItem, { borderBottomColor: theme.border }]}>
              <View style={[styles.menuIcon, { backgroundColor: theme.accent + '20' }]}>
                <MaterialIcons name="language" size={22} color={theme.accent} />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>Preferred Language</Text>
                <Text style={[styles.menuValue, { color: theme.text }]}>{language === 'izon' ? 'Izon' : 'English'}</Text>
              </View>
              <TouchableOpacity onPress={() => setLanguage(language === 'izon' ? 'english' : 'izon')}>
                <MaterialIcons name="chevron-right" size={20} color={theme.border} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('ChangePassword')}>
              <View style={[styles.menuIcon, { backgroundColor: theme.error + '20' }]}>
                <MaterialIcons name="lock" size={22} color={theme.error} />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>Change Password</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.border} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ApiKey')}>
              <View style={[styles.menuIcon, { backgroundColor: '#9C27B020' }]}>
                <MaterialIcons name="vpn-key" size={22} color="#9C27B0" />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>API Keys</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.border} />
            </TouchableOpacity>
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View style={[styles.actionButtons, { opacity: fadeAnim }]}>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={handleUpdate} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <MaterialIcons name="save" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.deleteButton, { backgroundColor: theme.card, borderColor: theme.error }]} onPress={() => setDeleteModalVisible(true)}>
              <MaterialIcons name="delete-forever" size={20} color={theme.error} />
              <Text style={[styles.deleteButtonText, { color: theme.error }]}>Delete Account</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Image Picker Modal */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient colors={isDarkMode ? ['#000000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Picture</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </LinearGradient>
            <View style={styles.modalBody}>
              <TouchableOpacity style={[styles.modalOption, { borderBottomColor: theme.border }]} onPress={pickImage}>
                <View style={[styles.modalIcon, { backgroundColor: theme.success + '20' }]}><MaterialIcons name="photo-library" size={24} color={theme.success} /></View>
                <View><Text style={[styles.modalOptionTitle, { color: theme.text }]}>Choose from Gallery</Text><Text style={[styles.modalOptionDescription, { color: theme.subText }]}>Select an existing photo</Text></View>
              </TouchableOpacity>
              {profileImage && (
                <TouchableOpacity style={styles.modalOption} onPress={() => { removeAvatar(); setModalVisible(false); }}>
                  <View style={[styles.modalIcon, { backgroundColor: theme.error + '20' }]}><MaterialIcons name="delete" size={24} color={theme.error} /></View>
                  <View><Text style={[styles.modalOptionTitle, { color: theme.error }]}>Remove Photo</Text><Text style={[styles.modalOptionDescription, { color: theme.subText }]}>Delete current picture</Text></View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Stats Modal */}
      {stats && (
        <Modal animationType="slide" transparent visible={statsModalVisible} onRequestClose={() => setStatsModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <LinearGradient colors={isDarkMode ? ['#000000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Your Statistics</Text>
                <TouchableOpacity onPress={() => setStatsModalVisible(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
              </LinearGradient>
              <ScrollView style={styles.modalBody}>
                <View style={[styles.statRow, { borderBottomColor: theme.border }]}><Text style={[styles.statRowLabel, { color: theme.subText }]}>Total Words Learned</Text><Text style={[styles.statRowValue, { color: theme.text }]}>{stats.overview?.wordsLearned || 0}</Text></View>
                <View style={[styles.statRow, { borderBottomColor: theme.border }]}><Text style={[styles.statRowLabel, { color: theme.subText }]}>Current Streak</Text><Text style={[styles.statRowValue, { color: theme.text }]}>{stats.streaks?.current || 0} days</Text></View>
                <View style={[styles.statRow, { borderBottomColor: theme.border }]}><Text style={[styles.statRowLabel, { color: theme.subText }]}>Longest Streak</Text><Text style={[styles.statRowValue, { color: theme.text }]}>{stats.streaks?.longest || 0} days</Text></View>
                <View style={[styles.statRow, { borderBottomColor: theme.border }]}><Text style={[styles.statRowLabel, { color: theme.subText }]}>Lessons Completed</Text><Text style={[styles.statRowValue, { color: theme.text }]}>{stats.overview?.lessonsCompleted || 0}</Text></View>
                <View style={[styles.statRow, { borderBottomColor: theme.border }]}><Text style={[styles.statRowLabel, { color: theme.subText }]}>Accuracy Rate</Text><Text style={[styles.statRowValue, { color: theme.text }]}>{stats.overview?.accuracy || 0}%</Text></View>
                <View style={[styles.statRow, { borderBottomColor: theme.border }]}><Text style={[styles.statRowLabel, { color: theme.subText }]}>Time Spent Learning</Text><Text style={[styles.statRowValue, { color: theme.text }]}>{stats.overview?.totalTimeSpent || 0} minutes</Text></View>
                <View style={[styles.statRow, { borderBottomColor: theme.border }]}><Text style={[styles.statRowLabel, { color: theme.subText }]}>Total Points</Text><Text style={[styles.statRowValue, { color: theme.text }]}>{stats.level?.points || 0} XP</Text></View>
                <View style={[styles.statRow, { borderBottomColor: theme.border }]}><Text style={[styles.statRowLabel, { color: theme.subText }]}>Referrals</Text><Text style={[styles.statRowValue, { color: theme.text }]}>{stats.referrals?.total || 0}</Text></View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Delete Account Modal */}
      <Modal animationType="fade" transparent visible={deleteModalVisible} onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalContent, { backgroundColor: theme.card }]}>
            <MaterialIcons name="warning" size={60} color={theme.error} />
            <Text style={[styles.deleteModalTitle, { color: theme.error }]}>Delete Account?</Text>
            <Text style={[styles.deleteModalText, { color: theme.subText }]}>This action is permanent and cannot be undone. All your progress, achievements, and data will be lost forever.</Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity style={[styles.deleteModalCancel, { borderColor: theme.border }]} onPress={() => setDeleteModalVisible(false)}><Text style={[styles.deleteModalCancelText, { color: theme.subText }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.deleteModalConfirm, { backgroundColor: theme.error }]} onPress={handleDeleteAccount}><Text style={styles.deleteModalConfirmText}>Delete</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statsButton: { padding: 8 },
  profileImageSection: { alignItems: 'center', marginTop: 20 },
  imageContainer: { position: 'relative' },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#FFD700' },
  profileImagePlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FFD700' },
  placeholderText: { fontSize: 48, fontWeight: 'bold', color: '#fff' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#4CAF50', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  contentContainer: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { backgroundColor: '#fff', borderRadius: 15, padding: 15, alignItems: 'center', flex: 0.31, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1a4c2e', marginTop: 8 },
  statLabel: { fontSize: 11, color: '#666', textAlign: 'center', marginTop: 2 },
  section: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a4c2e', marginBottom: 20 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, color: '#666', marginBottom: 5, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#fafafa' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', marginBottom: 5 },
  datePickerButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, backgroundColor: '#fafafa', marginTop: 5 },
  datePickerLabel: { flex: 1, fontSize: 14, color: '#666' },
  datePickerValue: { fontSize: 14, color: '#333', marginRight: 10 },
  quickMenu: { backgroundColor: '#fff', borderRadius: 20, padding: 15, marginBottom: 20, elevation: 3 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  menuIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 14, color: '#666', marginBottom: 2 },
  menuValue: { fontSize: 16, color: '#333', fontWeight: '500' },
  actionButtons: { marginBottom: 30 },
  saveButton: { backgroundColor: '#4CAF50', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginBottom: 10, gap: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#f44336', backgroundColor: '#fff', gap: 8 },
  deleteButtonText: { color: '#f44336', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalBody: { padding: 20 },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 15 },
  modalIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  modalOptionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 2 },
  modalOptionDescription: { fontSize: 12, color: '#666' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  statRowLabel: { fontSize: 16, color: '#666' },
  statRowValue: { fontSize: 18, fontWeight: 'bold', color: '#1a4c2e' },
  deleteModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  deleteModalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 30, alignItems: 'center', width: width * 0.8 },
  deleteModalTitle: { fontSize: 22, fontWeight: 'bold', color: '#f44336', marginTop: 15, marginBottom: 10 },
  deleteModalText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  deleteModalButtons: { flexDirection: 'row', gap: 10 },
  deleteModalCancel: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  deleteModalCancelText: { color: '#666', fontSize: 16, fontWeight: '600' },
  deleteModalConfirm: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#f44336', alignItems: 'center' },
  deleteModalConfirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
