import React, { useContext, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from '../../utils/haptics';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';

// APIs & Context
import { adminAPI, vocabularyAPI, lessonAPI, cultureAPI, apiUtils } from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { LanguageContext } from '../../context/LanguageContext';
import { ThemeContext } from '../../context/ThemeContext';
import ContentStudioScreen from './ContentStudioScreen';

const { width } = Dimensions.get('window');

const AdminScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const { activeLanguage } = useContext(LanguageContext);
  const contextValue = useContext(ThemeContext) || {};
  const { theme, isDarkMode } = contextValue;
  const [selectedLanguage, setSelectedLanguage] = useState('IZON');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      Alert.alert('Access Denied', 'You do not have permission to access the admin panel.');
      navigation.goBack();
    }
  }, [user]);

  // Navigation / Tab State
  const [activeTab, setActiveTab] = useState('vocabulary');

  // UI & Feedback State
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [image, setImage] = useState(null);
  const [isPublished, setIsPublished] = useState(true);

  // Modals Visibility
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [usersModalVisible, setUsersModalVisible] = useState(false);
  const [analyticsModalVisible, setAnalyticsModalVisible] = useState(false);
  
  // Data States
  const [dashboardData, setDashboardData] = useState({
    overview: {},
    recent: { users: [], lessons: [] },
    charts: {},
  });
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [contentStats, setContentStats] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [pendingContent, setPendingContent] = useState({ vocabulary: [], lessons: [], contributions: [] });
  const [editingContent, setEditingContent] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [recentCulture, setRecentCulture] = useState([]);

  // Form States
  const [vocabData, setVocabData] = useState({
    izonWord: '', 
    english: '', 
    category: 'nature', 
    difficulty: 'beginner',
    partOfSpeech: 'noun', 
    pronunciation: '', 
    example: '', 
    note: '', 
    tags: '',
    lessonId: ''
  });

  const [lessonData, setLessonData] = useState({
    titleIzon: '', 
    titleEnglish: '', 
    descriptionEnglish: '',
    level: 'beginner', 
    lessonType: 'vocabulary', 
    category: 'greetings', 
    order: '1',
    grammarTitle: '', grammarExplanation: '',
    exampleIzon: '', exampleEnglish: '',
    cultureTitle: '', cultureContent: ''
  });

  const [cultureData, setCultureData] = useState({
    title: '',
    description: '',
    meaning: '',
    categoryId: 'wisdom',
    type: 'history'
  });

  const [knowledgeData, setKnowledgeData] = useState({
    text: '',
    category: 'grammar'
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    loadDashboard();
    loadContentStats();
    loadRecentContent();
    startAnimations();
  }, []);

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

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getDashboard(); 
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error('Dashboard Error:', error);
      if (error.status === 401) {
        Alert.alert("Session Expired", "Please log in again to access the admin panel.");
        navigation.navigate('Login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRecentContent = async () => {
    try {
      const [lessonRes, cultureRes] = await Promise.all([
        lessonAPI.getAll({ status: 'draft', limit: 20 }), 
        cultureAPI.getProverbs()
      ]);
      
      if (lessonRes.data.success) {
        setDashboardData(prev => ({
          ...prev,
          recent: { ...prev.recent, lessons: lessonRes.data.data }
        }));
      }

      if (cultureRes.data.success) {
        setRecentCulture(cultureRes.data.data);
      }
    } catch (error) {
      console.error("Manual fetch failed:", error);
    }
  };

  const loadContentStats = async () => {
    try {
      const response = await adminAPI.getContentStats();
      if (response.data.success) {
        setContentStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load content stats:', error);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersModalVisible(true);
    try {
      const response = await adminAPI.getUsers({ limit: 50 });
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsModalVisible(true);
    try {
      const response = await adminAPI.getAnalytics({ period: 'week' });
      if (response.data.success) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadPendingContent = async () => {
    try {
      const [res, contRes] = await Promise.all([
        adminAPI.getPendingContent(),
        adminAPI.getPendingContributions()
      ]);
      if (res.data.success && contRes.data.success) {
        setPendingContent({
          ...res.data.data,
          contributions: contRes.data.data
        });
      }
    } catch (e) {
      console.warn('Failed to load pending content');
    }
  };

  useEffect(() => {
    if (activeTab === 'moderation') {
      loadPendingContent();
    }
  }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      apiUtils.clearCache();
      await Promise.all([
        loadDashboard(), 
        loadContentStats(),
        loadRecentContent(),
      ]);
    } catch (err) {
      console.error("Refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePublish = async (id) => {
    try {
      setLoading(true);
      const response = await lessonAPI.publish(id); 
      if (response.data.success) {
        Alert.alert("Success", "Lesson is now live for all users!");
        loadRecentContent();
      }
    } catch (err) {
      Alert.alert("Error", "Could not publish lesson");
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (id, action) => {
    try {
      setLoading(true);
      const res = await adminAPI.moderateContent(id, action);
      if (res.data.success) {
        Alert.alert('Success', `Content ${action}ed`);
        loadPendingContent();
        loadDashboard();
      }
    } catch (e) {
      Alert.alert('Error', 'Moderation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleModerateContribution = async (id, action) => {
    try {
      setLoading(true);
      const res = await adminAPI.moderateContribution(id, action);
      if (res.data.success) {
        Alert.alert('Success', `Contribution ${action}ed`);
        loadPendingContent();
      }
    } catch (e) {
      Alert.alert('Error', 'Moderation failed');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleExportData = async (type) => {
    try {
      await adminAPI.exportData(type);
      Alert.alert('Export Started', `Exporting ${type} data...`);
    } catch (error) {
      Alert.alert('Export Failed', 'Could not export data');
    }
  };

  const handleCreateContent = async () => {
    haptics.impactHeavy();
    setLoading(true);

    try {
      let response;
      if (activeTab === 'vocabulary') {
        if (!vocabData.izonWord || !vocabData.english) {
          Alert.alert('Validation Error', `${activeLanguage?.name || 'Izon'} word and English translation are required`);
          setLoading(false);
          return;
        }

        const vocabularyPayload = {
          izonWord: vocabData.izonWord.trim(),
          englishTranslation: vocabData.english.trim(),
          category: vocabData.category,
          difficulty: vocabData.difficulty,
          lang: selectedLanguage,
          lessonId: vocabData.lessonId,
          isPublished: isPublished,
          grammar: { partOfSpeech: vocabData.partOfSpeech }
        };

        if (vocabData.pronunciation && vocabData.pronunciation.trim() !== "") {
          vocabularyPayload.pronunciation = { phonetic: vocabData.pronunciation.trim() };
        }

        if (vocabData.tags) {
          vocabularyPayload.tags = vocabData.tags.split(',').map(t => t.trim());
        }

        response = await vocabularyAPI.addWord(vocabularyPayload);
      } else if (activeTab === 'lesson') {
        if (!lessonData.titleIzon || !lessonData.titleEnglish) {
          Alert.alert('Validation Error', 'Lesson titles are required');
          setLoading(false);
          return;
        }
        response = await lessonAPI.create({
          title: { izon: lessonData.titleIzon.trim(), english: lessonData.titleEnglish.trim() },
          lang: selectedLanguage,
          description: { english: lessonData.descriptionEnglish.trim() },
          level: lessonData.level,
          lessonType: lessonData.lessonType,
          category: lessonData.category,
          order: parseInt(lessonData.order, 10) || 1, 
          status: isPublished ? 'published' : 'draft',
          content: {
            grammar: lessonData.grammarTitle ? [{
              title: { english: lessonData.grammarTitle },
              explanation: { english: lessonData.grammarExplanation }
            }] : [],
            examples: lessonData.exampleIzon ? [{
              izon: lessonData.exampleIzon,
              english: lessonData.exampleEnglish
            }] : [],
            culturalNotes: lessonData.cultureTitle ? [{
              title: { english: lessonData.cultureTitle },
              content: { english: lessonData.cultureContent }
            }] : []
          },
          estimatedTime: { minutes: 15 },
          totalPoints: 50
        });
      } else if (activeTab === 'culture') {
        if (!cultureData.title || !cultureData.description) {
          Alert.alert('Validation Error', 'Title and Description/Context are required');
          setLoading(false);
          return;
        }

        if (cultureData.type === 'proverb') {
          response = await cultureAPI.createProverb({
            izon: cultureData.title.trim(),
            english: cultureData.description.trim(),
            meaning: cultureData.meaning.trim(),
            category: cultureData.categoryId,
            isPublished
          });
        } else {
          response = await cultureAPI.createContent({
            title: cultureData.title.trim(),
            description: cultureData.description.trim(),
            category: cultureData.categoryId,
            imageUri: image,
            isPublished
          });
        }
      } else if (activeTab === 'knowledge') {
        if (!knowledgeData.text) {
          Alert.alert('Validation Error', 'Knowledge content is required');
          setLoading(false);
          return;
        }
        response = await adminAPI.addKnowledge({
          text: knowledgeData.text.trim(),
          category: knowledgeData.category
        });
      }

      if (response?.data?.success) {
        haptics.notificationSuccess();
        Alert.alert('🎉 Success', `${activeTab} has been successfully published.`);
        setVocabData({
          izonWord: '', english: '', category: 'nature', difficulty: 'beginner',
          partOfSpeech: 'noun', pronunciation: '', example: '', note: '', tags: '', lessonId: ''
        });
        setImage(null);
        loadDashboard();
        loadContentStats();
      }
    } catch (error) {
      haptics.notificationError();
      Alert.alert('Push Failed', error.response?.data?.error || 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon, label, value, color, onPress }) => (
    <TouchableOpacity style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={onPress}>
      <MaterialIcons name={icon} size={28} color={color} />
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
    </TouchableOpacity>
  );

  const UserItem = ({ user }) => (
    <TouchableOpacity style={[styles.userItem, { borderBottomColor: theme.border }]} onPress={() => setSelectedUser(user)}>
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>{user.username?.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.text }]}>{user.username}</Text>
        <Text style={[styles.userEmail, { color: theme.subText }]}>{user.email}</Text>
        <View style={styles.userBadges}>
          <View style={[styles.userBadge, { backgroundColor: user.status === 'active' ? '#4CAF50' : '#FF9800' }]}>
            <Text style={styles.userBadgeText}>{user.status || 'active'}</Text>
          </View>
          <View style={[styles.userBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.userBadgeText}>{user.role || 'user'}</Text>
          </View>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={theme.subText} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={theme.headerGradient || ['#1a4c2e', '#2e7d32', '#43a047']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lorek Admin Console</Text>
          <TouchableOpacity onPress={() => setStatsModalVisible(true)} style={styles.iconButton}>
            <Ionicons name="stats-chart" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
        }
      >
        {/* Statistics Grid */}
        <View style={styles.statsGrid}>
          <StatCard 
            icon="menu-book" label="Words" value={dashboardData.overview?.totalVocabulary || 0} color="#4CAF50" 
            onPress={() => setStatsModalVisible(true)}
          />
          <StatCard 
            icon="people" label="Users" value={dashboardData.overview?.totalUsers || 0} color="#9C27B0" 
            onPress={loadUsers}
          />
        </View>

        {/* Tab Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabBarScroll, { backgroundColor: theme.card }]}>
          <View style={styles.tabBar}>
            {[
              { id: 'vocabulary', label: 'Vocab', icon: 'book' },
              { id: 'lesson', label: 'Lessons', icon: 'school' },
              { id: 'culture', label: 'Culture', icon: 'globe' },
              { id: 'moderation', label: 'Mod', icon: 'shield-checkmark' },
              { id: 'knowledge', label: 'Knowledge', icon: 'bulb' },
              { id: 'studio', label: 'Studio', icon: 'layers' },
            ].map((tab) => (
              <TouchableOpacity 
                key={tab.id} 
                style={[styles.tab, activeTab === tab.id && { backgroundColor: theme.primary }]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Ionicons name={tab.icon} size={16} color={activeTab === tab.id ? '#fff' : theme.subText} style={{ marginBottom: 2 }} />
                <Text style={[styles.tabText, activeTab === tab.id ? styles.activeTabText : { color: theme.subText }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Studio Tab View */}
        {activeTab === 'studio' ? (
          <View style={{ margin: 15 }}>
            <ContentStudioScreen />
          </View>
        ) : (
          /* Dynamic Form Card */
          <Animated.View style={[styles.formCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }], backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.formHeader}>
              <FontAwesome5 name="plus-circle" size={20} color={theme.primary} />
              <Text style={[styles.formTitle, { color: theme.text }]}> Add New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</Text>
            </View>

            {activeTab === 'vocabulary' && (
              <>
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  placeholder={`${activeLanguage?.name || 'Izon'} Word (e.g. Adú)`} 
                  placeholderTextColor={theme.subText}
                  value={vocabData.izonWord} 
                  onChangeText={(t) => setVocabData({...vocabData, izonWord: t})} 
                />
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  placeholder="English Meaning" 
                  placeholderTextColor={theme.subText}
                  value={vocabData.english} 
                  onChangeText={(t) => setVocabData({...vocabData, english: t})} 
                />

                <View style={[styles.pickerContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Picker 
                    selectedValue={vocabData.partOfSpeech} 
                    onValueChange={(v) => setVocabData({...vocabData, partOfSpeech: v})}
                    style={{ color: theme.text }}
                    dropdownIconColor={theme.text}
                  >
                    <Picker.Item label="📝 Noun" value="noun" />
                    <Picker.Item label="⚡ Verb" value="verb" />
                    <Picker.Item label="🎨 Adjective" value="adjective" />
                    <Picker.Item label="🏃 Adverb" value="adverb" />
                    <Picker.Item label="🗣️ Pronoun" value="pronoun" />
                    <Picker.Item label="📍 Preposition" value="preposition" />
                    <Picker.Item label="🔗 Conjunction" value="conjunction" />
                    <Picker.Item label="❗ Interjection" value="interjection" />
                  </Picker>
                </View>

                <View style={[styles.pickerContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Picker 
                    selectedValue={vocabData.category} 
                    onValueChange={(v) => setVocabData({...vocabData, category: v})}
                    style={{ color: theme.text }}
                    dropdownIconColor={theme.text}
                  >
                    <Picker.Item label="🌿 Nature" value="nature" />
                    <Picker.Item label="👪 Family" value="family" />
                    <Picker.Item label="🍽️ Food" value="food" />
                    <Picker.Item label="🏠 Home" value="home" />
                    <Picker.Item label="👔 Clothing" value="clothing" />
                    <Picker.Item label="❤️ Emotions" value="emotions" />
                    <Picker.Item label="🔢 Numbers" value="numbers" />
                    <Picker.Item label="🎨 Colors" value="colors" />
                  </Picker>
                </View>

                <View style={[styles.pickerContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Picker 
                    selectedValue={vocabData.lessonId} 
                    onValueChange={(v) => setVocabData({...vocabData, lessonId: v})}
                    style={{ color: theme.text }}
                    dropdownIconColor={theme.text}
                  >
                    <Picker.Item label="📚 Select Lesson (Link Word)" value="" />
                    {(dashboardData.recent?.lessons || []).map(lesson => (
                      <Picker.Item 
                        key={lesson._id} 
                        label={`${lesson?.title?.english || lesson?.title || 'Untitled'} (${lesson.status})`} 
                        value={lesson._id} 
                      />
                    ))}
                  </Picker>
                </View>

                <TextInput 
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  placeholder="Pronunciation (ah-DOO)" 
                  placeholderTextColor={theme.subText}
                  value={vocabData.pronunciation} 
                  onChangeText={(t) => setVocabData({...vocabData, pronunciation: t})} 
                />
                <TextInput 
                  style={[styles.input, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  multiline 
                  placeholder="Example Sentence" 
                  placeholderTextColor={theme.subText}
                  value={vocabData.example} 
                  onChangeText={(t) => setVocabData({...vocabData, example: t})} 
                />
              </>
            )}
            
            {activeTab === 'lesson' && (
              <>
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  placeholder={`Lesson Title (${activeLanguage?.name || 'Izon'})`} 
                  placeholderTextColor={theme.subText}
                  value={lessonData.titleIzon} 
                  onChangeText={(t) => setLessonData({...lessonData, titleIzon: t})} 
                />
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  placeholder="Lesson Title (English)" 
                  placeholderTextColor={theme.subText}
                  value={lessonData.titleEnglish} 
                  onChangeText={(t) => setLessonData({...lessonData, titleEnglish: t})} 
                />
                <TextInput 
                  style={[styles.input, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  multiline 
                  placeholder="Lesson Description" 
                  placeholderTextColor={theme.subText}
                  value={lessonData.descriptionEnglish} 
                  onChangeText={(t) => setLessonData({...lessonData, descriptionEnglish: t})} 
                />
                <View style={styles.row}>
                  <View style={[styles.pickerContainer, { flex: 1, marginRight: 5, backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Picker 
                      selectedValue={lessonData.level} 
                      onValueChange={(v) => setLessonData({...lessonData, level: v})}
                      style={{ color: theme.text }}
                      dropdownIconColor={theme.text}
                    >
                      <Picker.Item label="Beginner" value="beginner" />
                      <Picker.Item label="Intermediate" value="intermediate" />
                    </Picker>
                  </View>
                  <TextInput 
                    style={[styles.input, { flex: 0.5, backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                    placeholder="Order" 
                    placeholderTextColor={theme.subText}
                    keyboardType="numeric" 
                    value={lessonData.order} 
                    onChangeText={(t) => setLessonData({...lessonData, order: t})} 
                  />
                </View>

                <Text style={[styles.sectionSubtitle, { color: theme.text }]}>Grammar Section</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  placeholder="Grammar Topic (e.g. Pronouns)" 
                  placeholderTextColor={theme.subText}
                  value={lessonData.grammarTitle} 
                  onChangeText={(t) => setLessonData({...lessonData, grammarTitle: t})} 
                />
                <TextInput 
                  style={[styles.input, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  placeholder="Explanation" 
                  placeholderTextColor={theme.subText}
                  multiline
                  value={lessonData.grammarExplanation} 
                  onChangeText={(t) => setLessonData({...lessonData, grammarExplanation: t})} 
                />

                <Text style={[styles.sectionSubtitle, { color: theme.text }]}>Sentence Examples</Text>
                <View style={styles.row}>
                  <TextInput 
                    style={[styles.input, { flex: 1, marginRight: 5, backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                    placeholder={`${activeLanguage?.name || 'Izon'} Sentence`} 
                    placeholderTextColor={theme.subText}
                    value={lessonData.exampleIzon} 
                    onChangeText={(t) => setLessonData({...lessonData, exampleIzon: t})} 
                  />
                  <TextInput 
                    style={[styles.input, { flex: 1, backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                    placeholder="English Translation" 
                    placeholderTextColor={theme.subText}
                    value={lessonData.exampleEnglish} 
                    onChangeText={(t) => setLessonData({...lessonData, exampleEnglish: t})} 
                  />
                </View>
              </>
            )}

            {activeTab === 'culture' && (
              <>
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  placeholder={cultureData.type === 'proverb' ? `Proverb (${activeLanguage?.name || 'Izon'})` : "Title"} 
                  placeholderTextColor={theme.subText}
                  value={cultureData.title} 
                  onChangeText={(t) => setCultureData({...cultureData, title: t})} 
                />
                <TextInput 
                  style={[styles.input, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  multiline
                  placeholder="Description / Context" 
                  placeholderTextColor={theme.subText}
                  value={cultureData.description} 
                  onChangeText={(t) => setCultureData({...cultureData, description: t})} 
                />
              </>
            )}

            {activeTab === 'knowledge' && (
              <>
                <TextInput 
                  style={[styles.input, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                  multiline
                  placeholder="Knowledge Content (Lorek rule/entry)" 
                  placeholderTextColor={theme.subText}
                  value={knowledgeData.text} 
                  onChangeText={(t) => setKnowledgeData({...knowledgeData, text: t})} 
                />
                <View style={[styles.pickerContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Picker 
                    selectedValue={knowledgeData.category} 
                    onValueChange={(v) => setKnowledgeData({...knowledgeData, category: v})}
                    style={{ color: theme.text }}
                    dropdownIconColor={theme.text}
                  >
                    <Picker.Item label="Grammar" value="grammar" />
                    <Picker.Item label="Vocabulary" value="vocabulary" />
                    <Picker.Item label="Proverb" value="proverb" />
                    <Picker.Item label="Cultural" value="cultural" />
                  </Picker>
                </View>
              </>
            )}

            {activeTab === 'moderation' && (
              <View style={styles.moderationSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Vocabulary ({pendingContent.vocabulary?.length || 0})</Text>
                {pendingContent.vocabulary?.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.subText }]}>No pending vocabulary</Text>
                ) : (
                  pendingContent.vocabulary?.map(word => (
                    <View key={word._id} style={[styles.pendingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <View style={styles.pendingInfo}>
                        <Text style={[styles.pendingTitle, { color: theme.text }]}>{word.izonWord}</Text>
                        <Text style={[styles.pendingSubtitle, { color: theme.subText }]}>{word.englishTranslation}</Text>
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity onPress={() => handleModerate(word._id, 'approve')} style={[styles.moderateBtn, styles.approveBtn]}>
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleModerate(word._id, 'reject')} style={[styles.moderateBtn, styles.rejectBtn]}>
                          <Ionicons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}

                <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>Pending Lessons ({pendingContent.lessons?.length || 0})</Text>
                {pendingContent.lessons?.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.subText }]}>No pending lessons</Text>
                ) : (
                  pendingContent.lessons?.map(lesson => (
                    <View key={lesson._id} style={[styles.pendingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <View style={styles.pendingInfo}>
                        <Text style={[styles.pendingTitle, { color: theme.text }]}>{lesson.title?.english || 'Untitled Lesson'}</Text>
                        <Text style={[styles.pendingSubtitle, { color: theme.subText }]}>{lesson.category}</Text>
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity onPress={() => handleModerate(lesson._id, 'approve')} style={[styles.moderateBtn, styles.approveBtn]}>
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleModerate(lesson._id, 'reject')} style={[styles.moderateBtn, styles.rejectBtn]}>
                          <Ionicons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab !== 'moderation' && (
              <>
                <TouchableOpacity style={[styles.imageUpload, { borderColor: theme.primary }]} onPress={pickImage}>
                  <MaterialIcons name="add-photo-alternate" size={24} color={theme.primary} />
                  <Text style={[styles.imageUploadText, { color: theme.primary }]}>{image ? 'Image Linked' : 'Add Media Asset'}</Text>
                </TouchableOpacity>

                {image && <Image source={{ uri: image }} style={styles.previewImage} />}

                <View style={[styles.toggleContainer, { borderTopColor: theme.border }]}>
                  <Text style={[styles.toggleLabel, { color: theme.text }]}>Publish immediately</Text>
                  <Switch value={isPublished} onValueChange={setIsPublished} trackColor={{ false: '#767577', true: '#4CAF50' }} />
                </View>

                <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.primary }, loading && styles.submitButtonDisabled]} onPress={handleCreateContent} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <MaterialIcons name="cloud-upload" size={24} color="#fff" />
                      <Text style={styles.submitButtonText}>PUBLISH TO CLOUD</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        )}

        {/* Quick Tools Section */}
        <View style={[styles.toolsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.toolsTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.toolsGrid}>
            <TouchableOpacity style={[styles.toolButton, { backgroundColor: theme.surface }]} onPress={loadAnalytics}>
              <MaterialIcons name="analytics" size={24} color={theme.primary} />
              <Text style={[styles.toolText, { color: theme.text }]}>Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolButton, { backgroundColor: theme.surface }]} onPress={() => handleExportData('vocabulary')}>
              <MaterialIcons name="file-download" size={24} color={theme.primary} />
              <Text style={[styles.toolText, { color: theme.text }]}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Users Modal */}
      <Modal animationType="slide" transparent={true} visible={usersModalVisible} onRequestClose={() => setUsersModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient colors={theme.headerGradient || ['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User Management</Text>
              <TouchableOpacity onPress={() => setUsersModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            {usersLoading ? <ActivityIndicator size="large" color="#4CAF50" style={styles.modalLoader} /> : (
              <FlatList data={users} keyExtractor={(item) => item._id} renderItem={({ item }) => <UserItem user={item} />} contentContainerStyle={styles.usersList} />
            )}
          </View>
        </View>
      </Modal>

      {/* User Detail Modal */}
      <Modal animationType="slide" transparent={true} visible={userModalVisible} onRequestClose={() => setUserModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient colors={theme.headerGradient || ['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User: {selectedUser?.username}</Text>
              <TouchableOpacity onPress={() => setUserModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            <View style={styles.modalBody}>
              <Text style={[styles.modalStatText, { color: theme.text }]}>Current Role: {selectedUser?.role}</Text>
              <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.primary, marginTop: 15 }]} onPress={() => adminAPI.updateUser(selectedUser._id, { role: 'admin' }).then(() => { Alert.alert('Success', 'Promoted'); setUserModalVisible(false); loadUsers(); })}>
                <Text style={styles.submitButtonText}>Promote to Admin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, { backgroundColor: '#f44336', marginTop: 10 }]} onPress={() => adminAPI.deleteUser(selectedUser._id).then(() => { Alert.alert('Success', 'Deleted'); setUserModalVisible(false); loadUsers(); })}>
                <Text style={styles.submitButtonText}>Delete User</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 25, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  iconButton: { padding: 4 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: -30 },
  statCard: { width: (width - 50) / 2, borderRadius: 16, padding: 16, alignItems: 'center', elevation: 4, borderWidth: 1 },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  statLabel: { fontSize: 13, marginTop: 2 },
  tabBarScroll: { marginVertical: 15, marginHorizontal: 15, borderRadius: 16, elevation: 3 },
  tabBar: { flexDirection: 'row', padding: 6, gap: 8 },
  tab: { paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', borderRadius: 12, justifyContent: 'center' },
  tabText: { fontWeight: '600', fontSize: 12, marginTop: 2 },
  activeTabText: { color: '#fff' },
  formCard: { borderRadius: 20, padding: 20, margin: 15, elevation: 4, borderWidth: 1 },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  formTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 14 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  pickerContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  imageUpload: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, padding: 16, marginBottom: 14 },
  imageUploadText: { fontWeight: '600', marginLeft: 10, fontSize: 15 },
  previewImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 14 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, marginBottom: 14 },
  toggleLabel: { fontSize: 15, fontWeight: '500' },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, marginTop: 6, elevation: 2 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  toolsCard: { borderRadius: 20, padding: 20, margin: 15, borderWidth: 1 },
  toolsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  toolsGrid: { flexDirection: 'row', gap: 12 },
  toolButton: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', elevation: 2 },
  toolText: { marginTop: 6, fontWeight: '600', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '85%', paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalBody: { padding: 20 },
  modalStatText: { fontSize: 16, fontWeight: '500', marginBottom: 10 },
  userItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  userAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  userInfo: { flex: 1 },
  userName: { fontWeight: 'bold', fontSize: 16 },
  userEmail: { fontSize: 13, marginTop: 2 },
  userBadges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  userBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  userBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  moderationSection: { paddingVertical: 10 },
  pendingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1 },
  pendingInfo: { flex: 1, marginRight: 10 },
  pendingTitle: { fontSize: 16, fontWeight: 'bold' },
  pendingSubtitle: { fontSize: 13, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8 },
  moderateBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  approveBtn: { backgroundColor: '#4CAF50' },
  rejectBtn: { backgroundColor: '#f44336' },
  emptyText: { textAlign: 'center', fontStyle: 'italic', paddingVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  sectionSubtitle: { fontSize: 15, fontWeight: 'bold', marginTop: 14, marginBottom: 8 },
});

export default AdminScreen;
