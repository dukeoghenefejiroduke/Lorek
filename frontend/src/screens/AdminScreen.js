import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
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
import haptics from '../utils/haptics';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';

// APIs
import { adminAPI, vocabularyAPI, lessonAPI, cultureAPI, apiUtils } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { LanguageContext } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

const LANGUAGES = [
  { label: 'Izon', value: 'IZON' },
  { label: 'Ogbia', value: 'OGBIA' },
  { label: 'English', value: 'EN' },
];

const AdminScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const { activeLanguage } = useContext(LanguageContext);
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in AdminScreen.js:', contextValue);
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
  const [pendingContent, setPendingContent] = useState({ vocabulary: [], lessons: [] });
  const [editingContent, setEditingContent] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const handleEdit = (item, type) => {
    setEditingContent({ ...item, type });
    setEditModalVisible(true);
  };

  const handleDelete = async (id, type) => {
    Alert.alert('Delete Content', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          if (type === 'vocabulary') await vocabularyAPI.deleteWord(id);
          else if (type === 'lesson') await lessonAPI.delete(id);
          Alert.alert('Success', 'Content deleted');
          loadRecentContent();
        } catch (err) {
          Alert.alert('Error', 'Failed to delete');
        }
      }}
    ]);
  };

  const handleUserPress = (user) => {
    setSelectedUser(user);
    setUserModalVisible(true);
  };

  const handleUpdate = async () => {
    try {
      if (editingContent.type === 'vocabulary') {
        await vocabularyAPI.updateWord(editingContent._id, editingContent);
      } else if (editingContent.type === 'lesson') {
        await lessonAPI.update(editingContent._id, editingContent);
      }
      Alert.alert('Success', 'Content updated');
      setEditModalVisible(false);
      loadRecentContent();
    } catch (err) {
      Alert.alert('Error', 'Failed to update content');
    }
  };
  
const renderEditForm = () => {
  // Add this safety check
  if (!editingContent) {
    return null;
  }

  if (editingContent.type === 'vocabulary') {
    return (
      <View>
        <TextInput 
          style={styles.input} 
          value={editingContent.izonWord} 
          onChangeText={(t) => setEditingContent({...editingContent, izonWord: t})} 
          placeholder={`${activeLanguage?.name || 'Izon'} Word`} 
        />
        <TextInput 
          style={styles.input} 
          value={editingContent.englishTranslation} 
          onChangeText={(t) => setEditingContent({...editingContent, englishTranslation: t})} 
          placeholder="English Translation" 
        />
      </View>
    );
  } else if (editingContent.type === 'lesson') {
    return (
      <View>
        <TextInput 
          style={styles.input} 
          value={editingContent.title?.izon} 
          onChangeText={(t) => setEditingContent({...editingContent, title: {...editingContent.title, izon: t}})} 
          placeholder={`${activeLanguage?.name || 'Izon'} Title`} 
        />
        <TextInput 
          style={styles.input} 
          value={editingContent.title?.english} 
          onChangeText={(t) => setEditingContent({...editingContent, title: {...editingContent.title, english: t}})} 
          placeholder="English Title" 
        />
      </View>
    );
  }
  return null;
};

  const deleteUser = async (userId) => {
    Alert.alert('Delete User', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await adminAPI.deleteUser(userId);
          Alert.alert('Success', 'User deleted');
          loadUsers();
          setUserModalVisible(false);
        } catch (err) {
          Alert.alert('Error', 'Failed to delete user');
        }
      }}
    ]);
  };

  // --- CONSOLIDATED FORM STATES ---
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
  lessonId: '' // <--- ADD THIS
});

const [lessonData, setLessonData] = useState({
  titleIzon: '', 
  titleEnglish: '', 
  descriptionEnglish: '',
  level: 'beginner', 
  lessonType: 'vocabulary', 
  category: 'greetings', 
  order: '1',
  // New nested structures:
  grammarTitle: '', grammarExplanation: '',
  exampleIzon: '', exampleEnglish: '',
  cultureTitle: '', cultureContent: ''
});

  // Suggested state update for Culture
  const [cultureData, setCultureData] = useState({
    title: '',       // Acts as 'izon' for proverbs
    description: '', // Acts as 'english' (literal) for proverbs
    meaning: '',     // The deep meaning
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

  const [recentCulture, setRecentCulture] = useState([]);

const loadRecentContent = async () => {
  try {
    const [lessonRes, cultureRes] = await Promise.all([
      // Explicitly ask for drafts so you can link vocabulary to them!
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

// Call this inside your main useEffect
useEffect(() => {
  loadDashboard();
  loadContentStats();
  loadRecentContent(); // <--- Add this
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
  setLoading(true); // Show a loader while checking auth
  try {
    // Calling the updated getDashboard from your api.js
    const response = await adminAPI.getDashboard(); 
    if (response.data.success) {
      setDashboardData(response.data.data);
    }
  } catch (error) {
    console.error('Dashboard Error:', error);
    if (error.status === 401) {
      Alert.alert("Session Expired", "Please log in again to access the admin panel.");
      navigation.navigate('Login'); // Or your login route name
    }
  } finally {
    setLoading(false);
  }
};

const handlePublish = async (id) => {
  try {
    setLoading(true);
    // You'll need to add this method to your lessonAPI service
    const response = await lessonAPI.publish(id); 
    if (response.data.success) {
      Alert.alert("Success", "Lesson is now live for all users!");
      loadRecentContent(); // Refresh the list
    }
  } catch (err) {
    Alert.alert("Error", "Could not publish lesson");
  } finally {
    setLoading(false);
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

 const onRefresh = async () => {
  setRefreshing(true);
  try {
    // Clear any local caches
    apiUtils.clearCache(); 
    
    await Promise.all([
      loadDashboard(), 
      loadContentStats(),
      loadRecentContent(), // This now fetches drafts specifically
    ]);
  } catch (err) {
  console.error("Refresh failed", err);
  } finally {
  setRefreshing(false);
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

  const pickImage = async () => {    const result = await ImagePicker.launchImageLibraryAsync({
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
          grammar: {
            partOfSpeech: vocabData.partOfSpeech 
          }
        };

        if (vocabData.pronunciation && vocabData.pronunciation.trim() !== "") {
          vocabularyPayload.pronunciation = {
            phonetic: vocabData.pronunciation.trim()
          };
        }

        if (vocabData.tags) {
          vocabularyPayload.tags = vocabData.tags.split(',').map(t => t.trim());
        }

        response = await vocabularyAPI.addWord(vocabularyPayload);
      } else if (activeTab === 'lesson') {
        // ... (Keep your existing lesson logic)
        if (!lessonData.titleIzon || !lessonData.titleEnglish) {
          Alert.alert('Validation Error', 'Lesson titles are required');
          setLoading(false);
          return;
        }
response = await lessonAPI.create({
  title: { 
    izon: lessonData.titleIzon.trim(), 
    english: lessonData.titleEnglish.trim() 
  },
  lang: selectedLanguage,
  description: { english: lessonData.descriptionEnglish.trim() },
  level: lessonData.level,
  lessonType: lessonData.lessonType,
  category: lessonData.category,
  order: parseInt(lessonData.order, 10) || 1, 
  status: isPublished ? 'published' : 'draft',
  
  // THE NEW STUFF:
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
      // ... (Keep your existing culture/proverb logic)
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
        Alert.alert('🎉 Success', `${activeTab} has been pushed to the Lorek cloud.`);
        
        // Reset form after success
        setVocabData({
          izonWord: '', english: '', category: 'nature', difficulty: 'beginner',
          partOfSpeech: 'noun', pronunciation: '', example: '', note: '', tags: '', lessonId: '' // <--- RESET THIS
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
    <TouchableOpacity style={[styles.statCard, { backgroundColor: theme.card }]} onPress={onPress}>
      <MaterialIcons name={icon} size={32} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
    </TouchableOpacity>
  );

  const UserItem = ({ user }) => (
    <TouchableOpacity style={styles.userItem} onPress={() => handleUserPress(user)}>
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
          <View style={styles.userBadge}>
            <Text style={styles.userBadgeText}>{user.role || 'user'}</Text>
          </View>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={['#1a4c2e', '#2e7d32', '#43a047']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lorek Admin Console</Text>
          <TouchableOpacity onPress={() => setStatsModalVisible(true)}>
            <Ionicons name="stats-chart" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
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
        <View style={[styles.tabBar, { backgroundColor: theme.card }]}>
          {['vocabulary', 'lesson', 'culture', 'moderation', 'knowledge'].map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dynamic Form Card */}
        <Animated.View style={[styles.formCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }], backgroundColor: theme.card }]}>
          <View style={styles.formHeader}>
            <FontAwesome5 name="plus-circle" size={20} color="#4CAF50" />
            <Text style={styles.formTitle}> Add New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</Text>
          </View>

          {activeTab === 'vocabulary' && (
            <>
              <TextInput 
                style={styles.input} 
                placeholder={`${activeLanguage?.name || 'Izon'} Word (e.g. Adú)`} 
                value={vocabData.izonWord} 
                onChangeText={(t) => setVocabData({...vocabData, izonWord: t})} 
              />
              <TextInput 
                style={styles.input} 
                placeholder="English Meaning" 
                value={vocabData.english} 
                onChangeText={(t) => setVocabData({...vocabData, english: t})} 
              />

              {/* NEW PART OF SPEECH PICKER */}
              <View style={styles.pickerContainer}>
                <Picker 
                  selectedValue={vocabData.partOfSpeech} 
                  onValueChange={(v) => setVocabData({...vocabData, partOfSpeech: v})}
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

              <View style={styles.pickerContainer}>
                <Picker selectedValue={vocabData.category} onValueChange={(v) => setVocabData({...vocabData, category: v})}>
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
              {/* Put this inside the vocabulary tab section */}
<View style={styles.pickerContainer}>
  <Picker 
    selectedValue={vocabData.lessonId} 
    onValueChange={(v) => setVocabData({...vocabData, lessonId: v})}
  >
    <Picker.Item label="📚 Select Lesson (Link Word)" value="" />
    {/* Check both dashboard recent and your new state */}{(dashboardData.recent?.lessons || []).map(lesson => (
  <Picker.Item 
    key={lesson._id} 
    label={`${lesson.title.english} (${lesson.status})`} // Add status here so you know if it's live
    value={lesson._id} 
  />
))}
  </Picker>
</View>


              <TextInput style={styles.input} placeholder="Pronunciation (ah-DOO)" value={vocabData.pronunciation} onChangeText={(t) => setVocabData({...vocabData, pronunciation: t})} />
              <TextInput style={[styles.input, styles.textArea]} multiline placeholder="Example Sentence" value={vocabData.example} onChangeText={(t) => setVocabData({...vocabData, example: t})} />
            </>
          )}
          
          {activeTab === 'lesson' && (
            <>
              <TextInput style={styles.input} placeholder={`Lesson Title (${activeLanguage?.name || 'Izon'})`} value={lessonData.titleIzon} onChangeText={(t) => setLessonData({...lessonData, titleIzon: t})} />
              <TextInput style={styles.input} placeholder="Lesson Title (English)" value={lessonData.titleEnglish} onChangeText={(t) => setLessonData({...lessonData, titleEnglish: t})} />
              <TextInput style={[styles.input, styles.textArea]} multiline placeholder="Lesson Description" value={lessonData.descriptionEnglish} onChangeText={(t) => setLessonData({...lessonData, descriptionEnglish: t})} />
              <View style={styles.row}>
                <View style={[styles.pickerContainer, {flex: 1, marginRight: 5}]}>
                  <Picker selectedValue={lessonData.level} onValueChange={(v) => setLessonData({...lessonData, level: v})}>
                    <Picker.Item label="Beginner" value="beginner" />
                    <Picker.Item label="Intermediate" value="intermediate" />
                  </Picker>
                </View>
                <TextInput style={[styles.input, {flex: 0.5}]} placeholder="Order" keyboardType="numeric" value={lessonData.order} onChangeText={(t) => setLessonData({...lessonData, order: t})} />
              </View>
                  <Text style={styles.sectionSubtitle}>Grammar Section</Text>
    <TextInput 
      style={styles.input} 
      placeholder="Grammar Topic (e.g. Pronouns)" 
      value={lessonData.grammarTitle} 
      onChangeText={(t) => setLessonData({...lessonData, grammarTitle: t})} 
    />
    <TextInput 
      style={[styles.input, styles.textArea]} 
      placeholder="Explanation" 
      multiline
      value={lessonData.grammarExplanation} 
      onChangeText={(t) => setLessonData({...lessonData, grammarExplanation: t})} 
    />

    <Text style={styles.sectionSubtitle}>Sentence Examples</Text>
    <View style={styles.row}>
      <TextInput 
        style={[styles.input, {flex: 1, marginRight: 5}]} 
        placeholder={`${activeLanguage?.name || 'Izon'} Sentence`} 
        value={lessonData.exampleIzon} 
        onChangeText={(t) => setLessonData({...lessonData, exampleIzon: t})} 
      />
      <TextInput 
        style={[styles.input, {flex: 1}]} 
        placeholder="English Translation" 
        value={lessonData.exampleEnglish} 
        onChangeText={(t) => setLessonData({...lessonData, exampleEnglish: t})} 
      />
    </View>

    <Text style={styles.sectionSubtitle}>Cultural Note</Text>
    <TextInput 
      style={styles.input} 
      placeholder="Culture Title" 
      value={lessonData.cultureTitle} 
      onChangeText={(t) => setLessonData({...lessonData, cultureTitle: t})} 
    />
    <TextInput 
      style={[styles.input, styles.textArea]} 
      placeholder="Cultural Context..." 
      multiline
      value={lessonData.cultureContent} 
      onChangeText={(t) => setLessonData({...lessonData, cultureContent: t})} 
    />
            </>
          )}

{activeTab === 'culture' && (
  <>
    <TextInput 
      style={styles.input} 
      placeholder={cultureData.type === 'proverb' ? `Proverb (${activeLanguage?.name || 'Izon'})` : "Title"} 
      value={cultureData.title} 
      onChangeText={(t) => setCultureData({...cultureData, title: t})} 
    />
    {/* ... rest of culture logic */}
  </>
)}

{activeTab === 'knowledge' && (
  <>
    <TextInput 
      style={[styles.input, styles.textArea]} 
      multiline
      placeholder="Knowledge Content (Lorek rule/entry)" 
      value={knowledgeData.text} 
      onChangeText={(t) => setKnowledgeData({...knowledgeData, text: t})} 
    />
    <View style={styles.pickerContainer}>
      <Picker selectedValue={knowledgeData.category} onValueChange={(v) => setKnowledgeData({...knowledgeData, category: v})}>
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
    <Text style={styles.sectionTitle}>Pending Vocabulary ({pendingContent.vocabulary?.length || 0})</Text>
    {pendingContent.vocabulary?.length === 0 ? (
      <Text style={styles.emptyText}>No pending vocabulary</Text>
    ) : (
      pendingContent.vocabulary?.map(word => (
        <View key={word._id} style={styles.pendingItem}>
          <View style={styles.pendingInfo}>
            <Text style={styles.pendingTitle}>{word.izonWord}</Text>
            <Text style={styles.pendingSubtitle}>{word.englishTranslation}</Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity 
              onPress={() => handleModerate(word._id, 'approve')}
              style={[styles.moderateBtn, styles.approveBtn]}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleModerate(word._id, 'reject')}
              style={[styles.moderateBtn, styles.rejectBtn]}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ))
    )}

    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Pending Lessons ({pendingContent.lessons?.length || 0})</Text>
    {pendingContent.lessons?.length === 0 ? (
      <Text style={styles.emptyText}>No pending lessons</Text>
    ) : (
      pendingContent.lessons?.map(lesson => (
        <View key={lesson._id} style={styles.pendingItem}>
          <View style={styles.pendingInfo}>
            <Text style={styles.pendingTitle}>{lesson.title?.english || 'Untitled Lesson'}</Text>
            <Text style={styles.pendingSubtitle}>{lesson.category}</Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity 
              onPress={() => handleModerate(lesson._id, 'approve')}
              style={[styles.moderateBtn, styles.approveBtn]}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleModerate(lesson._id, 'reject')}
              style={[styles.moderateBtn, styles.rejectBtn]}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ))
    )}
    
    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Pending Contributions ({pendingContent.contributions?.length || 0})</Text>
    {pendingContent.contributions?.length === 0 ? (
      <Text style={styles.emptyText}>No pending contributions</Text>
    ) : (
      pendingContent.contributions?.map(item => (
        <View key={item._id} style={[styles.pendingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.pendingInfo}>
            <Text style={[styles.pendingTitle, { color: theme.text }]}>{item.type.toUpperCase()}</Text>
            <Text style={[styles.pendingSubtitle, { color: theme.subText }]}>By: {item.userId?.username || 'Unknown'}</Text>
            {item.data.text && <Text style={{ color: theme.text }}>{item.data.text}</Text>}
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={() => handleModerateContribution(item._id, 'approve')} style={[styles.moderateBtn, styles.approveBtn]}>
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleModerateContribution(item._id, 'reject')} style={[styles.moderateBtn, styles.rejectBtn]}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ))
    )}
  </View>
)}

          <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
            <MaterialIcons name="add-photo-alternate" size={24} color="#4CAF50" />
            <Text style={styles.imageUploadText}>{image ? 'Image Linked' : 'Add Media Asset'}</Text>
          </TouchableOpacity>

          {image && <Image source={{ uri: image }} style={styles.previewImage} />}

          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleLabel, { color: theme.text }]}>Publish immediately</Text>
            <Switch value={isPublished} onValueChange={setIsPublished} trackColor={{ false: '#767577', true: '#4CAF50' }} />
          </View>

          <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={handleCreateContent} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <MaterialIcons name="cloud-upload" size={24} color="#fff" />
                <Text style={styles.submitButtonText}>PUSH TO CLOUD</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

{/* Add this inside your ScrollView, below the Form Card */}
<View style={styles.listSection}>
  <Text style={styles.sectionTitle}>Recent Lessons (Drafts)</Text>
  {dashboardData.recent.lessons.map(lesson => (
    <View key={lesson._id} style={styles.listItem}>
       <Text>{lesson.title.english} - {lesson.status}</Text>
       {lesson.status === 'draft' && (
         <TouchableOpacity onPress={() => handlePublish(lesson._id)}>
           <Text style={{color: 'green'}}>Publish Now</Text>
         </TouchableOpacity>
       )}
    </View>
  ))}
</View>


        {/* Tools Section */}
        <View style={[styles.toolsCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.toolsTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.toolsGrid}>
            <TouchableOpacity style={[styles.toolButton, { backgroundColor: theme.background }]} onPress={loadAnalytics}>
              <MaterialIcons name="analytics" size={24} color="#4CAF50" />
              <Text style={[styles.toolText, { color: theme.text }]}>Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolButton, { backgroundColor: theme.background }]} onPress={() => handleExportData('vocabulary')}>
              <MaterialIcons name="file-download" size={24} color="#4CAF50" />
              <Text style={[styles.toolText, { color: theme.text }]}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Users Modal */}
      <Modal animationType="slide" transparent={true} visible={usersModalVisible} onRequestClose={() => setUsersModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.usersModal]}>
            <LinearGradient colors={['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
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
          <View style={styles.modalContent}>
            <LinearGradient colors={['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User: {selectedUser?.username}</Text>
              <TouchableOpacity onPress={() => setUserModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            <View style={styles.modalBody}>
              <Text>Current Role: {selectedUser?.role}</Text>
              <TouchableOpacity style={styles.submitButton} onPress={() => updateUserRole(selectedUser._id, 'admin')}>
                <Text style={styles.submitButtonText}>Promote to Admin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, {backgroundColor: 'red'}]} onPress={() => deleteUser(selectedUser._id)}>
                <Text style={styles.submitButtonText}>Delete User</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Analytics Modal */}
      <Modal animationType="slide" transparent={true} visible={analyticsModalVisible} onRequestClose={() => setAnalyticsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          {/* ... analytics modal content */}
        </View>
      </Modal>

      {/* Edit Content Modal */}
      <Modal animationType="slide" transparent={true} visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient colors={['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editingContent?.type}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            <View style={styles.modalBody}>
              {renderEditForm()}
              <TouchableOpacity style={styles.submitButton} onPress={handleUpdate}>
                <Text style={styles.submitButtonText}>Save Changes</Text>
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
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: -30 },
  statCard: { width: (width - 60) / 2, borderRadius: 15, padding: 15, alignItems: 'center', elevation: 5 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#1a4c2e', marginTop: 5 },
  statLabel: { fontSize: 12 },
  tabBar: { flexDirection: 'row', margin: 15, padding: 5, borderRadius: 15, elevation: 3 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: '#4CAF50' },
  tabText: { fontWeight: 'bold', color: '#999', fontSize: 12 },
  activeTabText: { color: '#fff' },
  formCard: { borderRadius: 20, padding: 20, margin: 15, elevation: 5 },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a4c2e' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#fafafa', marginBottom: 12 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  pickerContainer: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fafafa', marginBottom: 12 },
  imageUpload: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4CAF50', borderStyle: 'dashed', borderRadius: 10, padding: 15, marginBottom: 12 },
  imageUploadText: { color: '#4CAF50', fontWeight: '500', marginLeft: 10 },
  previewImage: { width: '100%', height: 150, borderRadius: 10, marginBottom: 12 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  toggleLabel: { fontSize: 14 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  submitButton: { backgroundColor: '#1a4c2e', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 10 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  toolsCard: { borderRadius: 20, padding: 20, margin: 15 },
  toolsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  toolsGrid: { flexDirection: 'row', gap: 10 },
  toolButton: { flex: 1, borderRadius: 12, padding: 15, alignItems: 'center' },
  toolText: { color: '#1a4c2e', marginTop: 5, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalBody: { padding: 20 },
  modalStat: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  userItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userAvatarText: { color: '#fff', fontWeight: 'bold' },
  userInfo: { flex: 1 },
  userName: { fontWeight: 'bold' },
  userEmail: { fontSize: 12 },
  userBadges: { flexDirection: 'row', gap: 5, marginTop: 5 },
  userBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  userBadgeText: { fontSize: 10, color: '#fff' },
  moderationSection: { padding: 15 },
  pendingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#f9f9f9', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  pendingInfo: { flex: 1 },
  pendingTitle: { fontSize: 16, fontWeight: 'bold' },
  pendingSubtitle: { fontSize: 14, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10 },
  moderateBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  approveBtn: { backgroundColor: '#4CAF50' },
  rejectBtn: { backgroundColor: '#f44336' },
  emptyText: { textAlign: 'center', color: '#999', fontStyle: 'italic', paddingVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
});

export default AdminScreen;
