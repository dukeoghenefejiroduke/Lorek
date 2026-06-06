import React, { useState, useEffect, useRef, useContext, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  Switch,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from "../utils/haptics";
import { BlurView } from 'expo-blur';
import { vocabularyAPI, pronunciationAPI } from '../services/api';
import WordCard from '../components/WordCard';
import FamilyTreeModule from '../components/FamilyTreeModule';
import { ThemeContext } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';
import ScreenHeader from '../components/ScreenHeader';
import LanguageSwitcher from '../components/LanguageSwitcher';
import LoadingOverlay from '../components/LoadingOverlay';
import { handleGlobalError } from '../utils/errorHandler';

const { width } = Dimensions.get('window');

const VocabularyScreen = ({ navigation }) => {
  const { activeLanguage } = useContext(LanguageContext);
  
  
const [vocabulary, setVocabulary] = useState([]);

   const { isDarkMode, theme } = useContext(ThemeContext);

const filteredVocabulary = useMemo(() => {
  let filtered = [...vocabulary];

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(item => 
      item.izonWord?.toLowerCase().includes(q) || 
      item.english?.toLowerCase().includes(q) ||
      item.englishTranslation?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  }

  // Favorites filter
  if (showFavoritesOnly) {
    filtered = filtered.filter(item => favorites.includes(item._id || item.id));
  }

  // Sorting
  if (sortBy === 'az') {
    filtered.sort((a, b) => (a.izonWord || '').localeCompare(b.izonWord || ''));
  } else if (sortBy === 'difficulty') {
    const weights = { beginner: 1, intermediate: 2, advanced: 3 };
    filtered.sort((a, b) => (weights[a.difficulty] || 0) - (weights[b.difficulty] || 0));
  }

  return filtered;
}, [vocabulary, searchQuery, showFavoritesOnly, sortBy, favorites]);

const [loading, setLoading] = useState(true);
const [searchQuery, setSearchQuery] = useState('');
const [category, setCategory] = useState('all');
const [viewMode, setViewMode] = useState('grid');
const [error, setError] = useState(null);
const [pronunciationGuide, setPronunciationGuide] = useState(null);
const [includePronunciation, setIncludePronunciation] = useState(true);
const [selectedWord, setSelectedWord] = useState(null);
const [modalVisible, setModalVisible] = useState(false);
const [statsModalVisible, setStatsModalVisible] = useState(false);
const [favorites, setFavorites] = useState([]);
const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
const [sortBy, setSortBy] = useState('default'); // default, az, difficulty
const [isReporting, setIsReporting] = useState(false);
const [reportModalVisible, setReportModalVisible] = useState(false);
const [reportReason, setReportReason] = useState('');
const [backendStats, setBackendStats] = useState(null);
const [languageSwitcherVisible, setLanguageSwitcherVisible] = useState(false);

// Add these with your other animation refs
const fadeAnim = useRef(new Animated.Value(0)).current;
const slideAnim = useRef(new Animated.Value(50)).current;
const scaleAnim = useRef(new Animated.Value(0)).current;
const rotateAnim = useRef(new Animated.Value(0)).current;

// Add this interpolation constant
const interpolatedRotate = rotateAnim.interpolate({
  inputRange: [0, 1],
  outputRange: ['0deg', '360deg'],
});

// Define your categories array (or import it if it's from a config file)
const categories = [
  { id: 'all', label: 'All', icon: '🌍' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧' },
  { id: 'nature', label: 'Nature', icon: '🌿' },
  // ... add your other categories here
];

useEffect(() => {
  fetchVocabulary();
  fetchFavorites();
  fetchBackendStats();

  // Start animations
  Animated.parallel([
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
  ]).start();

  // Rotate animation
  Animated.loop(
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 20000,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  ).start();

}, [activeLanguage, category]);

const fetchVocabulary = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);      
    const params = { 
      limit: 100, 
      includePronunciation: includePronunciation ? 'true' : 'false',
      lang: activeLanguage?.code || 'IZON'
    };

    if (category !== 'all') params.category = category;

    const response = await vocabularyAPI.getAll(params);
    const rawData = response.data?.success ? response.data.data : response.data;
    const data = Array.isArray(rawData) ? rawData : (rawData?.vocabulary || []);

    setVocabulary(data);
  } catch (err) {
    handleGlobalError(err, 'Vocabulary Fetch');
  } finally {
    setLoading(false);
  }
}, [activeLanguage, category, includePronunciation]);

const fetchFavorites = useCallback(async () => {
  try {
    const res = await vocabularyAPI.getFavorites();
    if (res.data.success) {
      setFavorites(res.data.data.map(fav => fav._id || fav.id));
    }
  } catch (e) {
    console.warn('Failed to fetch favorites');
  }
}, []);

const fetchBackendStats = useCallback(async () => {
  try {
    const res = await vocabularyAPI.getOverviewStats();
    if (res.data.success) {
      setBackendStats(res.data.data);
    }
  } catch (e) {
    console.warn('Failed to fetch backend stats');
  }
}, []);

const handleSearch = async () => {
  if (!searchQuery.trim()) {
    fetchVocabulary();
    return;
  }

  try {
    setLoading(true);
    const response = await vocabularyAPI.search(searchQuery.trim());
    const results = Array.isArray(response.data) ? response.data : response.data?.data || [];
    setVocabulary(results);
  } catch (err) {
    handleGlobalError(err, 'Vocabulary Search');
  } finally {
    setLoading(false);
  }
};

const toggleFavorite = async (wordId) => {
  haptics.impactLight();
  const isFav = favorites.includes(wordId);

  try {
    if (isFav) {
      await vocabularyAPI.removeFromFavorites(wordId);
      setFavorites(prev => prev.filter(id => id !== wordId));
    } else {
      await vocabularyAPI.addToFavorites(wordId);
      setFavorites(prev => [...prev, wordId]);
    }
  } catch (e) {
    handleGlobalError(e, 'Toggle Favorite');
  }
};

const handleReportWord = async () => {
  if (!selectedWord || !reportReason.trim() || isReporting) return;

  try {
    setIsReporting(true);
    const res = await vocabularyAPI.reportWord(selectedWord._id, { reason: reportReason.trim() });
    if (res.data.success) {
      Alert.alert('Success', 'Report submitted. Thank you for helping us improve!');
      setReportModalVisible(false);
      setReportReason('');
    }
  } catch (e) {
    Alert.alert('Error', 'Failed to submit report');
  } finally {
    setIsReporting(false);
  }
};

const playAudio = async (wordId) => {
  try {
    haptics.impactLight();
    // In a real app, you'd use Expo AV to play the audio from the URL
    // For now, let's show a success indicator
  } catch (e) {
    console.error('Audio playback failed');
  }
};
  const handleWordPress = (word) => {
    setSelectedWord(word);
    setModalVisible(true);
    haptics.impactLight();
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FF9800';
      case 'advanced': return '#F44336';
      default: return '#999';
    }
  };

  const renderGridView = () => (
    <FlatList 
      key={`grid-${viewMode}`}  
      data={filteredVocabulary}
      initialNumToRender={10}
      windowSize={5}
      maxToRenderPerBatch={10}
      removeClippedSubviews={Platform.OS === 'android'}
      updateCellsBatchingPeriod={50}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={60} color={theme.subText} />
          <Text style={[styles.emptyText, { color: theme.text }]}>No words found</Text>
          <Text style={[styles.emptySubtext, { color: theme.subText }]}>Try adjusting your search or filters.</Text>
          <TouchableOpacity 
            style={[styles.emptyButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setSearchQuery('');
              setCategory('all');
              setShowFavoritesOnly(false);
            }}
          >
            <Text style={styles.emptyButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item, index }) => (
        <Animated.View
          style={[
            styles.gridItemWrapper,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }
          ]}
        >
          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: theme.card }]}
            onPress={() => handleWordPress(item)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={isDarkMode ? [theme.card, '#252525'] : ['#ffffff', '#f8f9fa']}
              style={styles.gridCardGradient}
            >
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={() => toggleFavorite(item._id)}
              >
                <MaterialIcons
                  name={favorites.includes(item._id) ? 'favorite' : 'favorite-border'}
                  size={20}
                  color={favorites.includes(item._id) ? '#F44336' : theme.subText}
                />
              </TouchableOpacity>

              <View style={styles.gridWordContainer}>
                <Text style={[styles.gridIzonWord, { color: isDarkMode ? theme.primary : '#1a4c2e' }]}>{item.izonWord}</Text>
                <Text style={[styles.gridEnglishWord, { color: theme.text }]}>{item.englishTranslation}</Text>
              </View>

              <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(item.difficulty) }]}>
                <Text style={styles.difficultyText}>{item.difficulty}</Text>
              </View>

              {item.audioAvailable && (
                <View style={styles.audioIndicator}>
                  <Ionicons name="volume-high" size={14} color="#4CAF50" />
                </View>
              )}

              <View style={styles.categoryIcon}>
                <Text style={styles.categoryIconText}>
                  {categories.find(c => c.id === item.category)?.icon || '📖'}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}
      keyExtractor={(item) => item._id || Math.random().toString()}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.gridList}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderListView = () => (
    <FlatList
      key={`list-${viewMode}`}    
      data={filteredVocabulary}
      initialNumToRender={10}
       windowSize={5}
       maxToRenderPerBatch={10}
       removeClippedSubviews={Platform.OS === 'android'}
      updateCellsBatchingPeriod={50}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={60} color={theme.subText} />
          <Text style={[styles.emptyText, { color: theme.text }]}>No words found</Text>
          <Text style={[styles.emptySubtext, { color: theme.subText }]}>Try adjusting your search or filters.</Text>
          <TouchableOpacity 
            style={[styles.emptyButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setSearchQuery('');
              setCategory('all');
              setShowFavoritesOnly(false);
            }}
          >
            <Text style={styles.emptyButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item, index }) => (
        <Animated.View
          style={[
            styles.listItemWrapper,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0] 
                })
              }]
            }
          ]}
        >
          <TouchableOpacity
            style={[styles.listCard, { backgroundColor: theme.card }]}
            onPress={() => handleWordPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.listCardContent}>
              <View style={[styles.listIconContainer, { backgroundColor: getDifficultyColor(item.difficulty) + '20' }]}>
                <Text style={styles.listIcon}>
                  {categories.find(c => c.id === item.category)?.icon || '📖'}
                </Text>
              </View>

              <View style={styles.listWordContainer}>
                <View style={styles.listWordHeader}>
                  <Text style={[styles.listIzonWord, { color: theme.text }]}>{item.izonWord}</Text>
                  {favorites.includes(item._id) && (
                    <MaterialIcons name="favorite" size={16} color="#F44336" />
                  )}
                </View>
                <Text style={[styles.listEnglishWord, { color: theme.subText }]}>{item.englishTranslation}</Text>
                
                {item.examples && item.examples.length > 0 && (
                  <Text style={[styles.listExample, { color: isDarkMode ? '#888' : '#999' }]} numberOfLines={1}>
                    "{item.examples[0].izon}"
                  </Text>
                )}
              </View>

              <View style={styles.listMetadata}>
                <View style={[styles.listDifficulty, { backgroundColor: getDifficultyColor(item.difficulty) }]}>
                  <Text style={styles.listDifficultyText}>{item.difficulty.charAt(0)}</Text>
                </View>
                {item.audioAvailable && (
                  <Ionicons name="volume-high" size={16} color="#4CAF50" />
                )}
                <MaterialIcons name="chevron-right" size={20} color={isDarkMode ? '#555' : '#ccc'} />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
      keyExtractor={(item, index) => item._id || `word-${index}`}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderHeader = () => (
    <View>
      <ScreenHeader 
        title="Vocabulary"
        showLanguageSelector={true}
        onLanguagePress={() => setLanguageSwitcherVisible(true)}
        onBackPress={() => navigation.goBack()}
      >
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setStatsModalVisible(true)}
          >
            <Ionicons name="stats-chart" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <MaterialIcons
              name={showFavoritesOnly ? 'favorite' : 'favorite-border'}
              size={22}
              color={showFavoritesOnly ? theme.error : '#fff'}
            />
          </TouchableOpacity>
        </View>
      </ScreenHeader>

      <View style={{ paddingHorizontal: 20 }}>
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
            <Ionicons name="search" size={20} color={theme.subText} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search words..."
              placeholderTextColor={theme.subText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.subText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                category === cat.id && { backgroundColor: theme.accent },
              ]}
              onPress={() => {
                setCategory(cat.id);
                haptics.impactLight();
              }}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryChipText,
                  category === cat.id && { color: theme.headerGradient[0] },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* View Controls */}
        <View style={styles.viewControls}>
          <View style={[styles.viewModeContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'grid' && { backgroundColor: theme.card }]}
              onPress={() => setViewMode('grid')}
            >
              <MaterialIcons
                name="grid-view"
                size={20}
                color={viewMode === 'grid' ? theme.primary : '#fff'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'list' && { backgroundColor: theme.card }]}
              onPress={() => setViewMode('list')}
            >
              <MaterialIcons
                name="view-list"
                size={20}
                color={viewMode === 'list' ? theme.primary : '#fff'}
              />
            </TouchableOpacity>
            {category === 'family' && (
              <TouchableOpacity
                style={[styles.viewModeButton, viewMode === 'tree' && { backgroundColor: theme.card }]}
                onPress={() => setViewMode('tree')}
              >
                <MaterialIcons
                  name="account-tree"
                  size={20}
                  color={viewMode === 'tree' ? theme.primary : '#fff'}
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.sortContainer}>
            <TouchableOpacity
              style={[styles.sortButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={() => {
                const sorts = ['default', 'az', 'za', 'difficulty'];
                const currentIndex = sorts.indexOf(sortBy);
                const nextSort = sorts[(currentIndex + 1) % sorts.length];
                setSortBy(nextSort);
                haptics.impactLight();
              }}
            >
              <MaterialIcons name="sort" size={20} color="#fff" />
              <Text style={[styles.sortText, { color: '#fff' }]}>
                {sortBy === 'default' && 'Default'}
                {sortBy === 'az' && 'A-Z'}
                {sortBy === 'za' && 'Z-A'}
                {sortBy === 'difficulty' && 'Difficulty'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Results Count */}
        <View style={styles.resultsCount}>
          <Text style={[styles.resultsCountText, { color: 'rgba(255,255,255,0.7)' }]}>
            {filteredVocabulary.length} words found
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return <LoadingOverlay visible={loading} message="Loading vocabulary..." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={isDarkMode ? '#000' : '#1a4c2e'} />

      {/* Animated Background Pattern */}
      <Animated.View style={[styles.backgroundPattern, { transform: [{ rotate: interpolatedRotate }], opacity: isDarkMode ? 0.03 : 0.05 }]}>
        <Text style={[styles.patternText, { color: theme.text }]}>⚡ 𖦹 🔱 ⚡ 𖦹 🔱</Text>
      </Animated.View>

      {viewMode === 'tree' && category === 'family' ? (
        <FamilyTreeModule />
      ) : (
        <>
          {renderHeader()}
          {viewMode === 'grid' ? renderGridView() : renderListView()}
        </>
      )}

      {/* Word Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={theme.headerGradient}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Word Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            {selectedWord && (
              <ScrollView style={styles.modalBody}>
                {/* Word Header */}
                <View style={styles.modalWordHeader}>
                  <View style={[styles.modalIconContainer, { backgroundColor: `${theme.success}20` }]}>
                    <Text style={styles.modalIcon}>
                      {categories.find(c => c.id === selectedWord.category)?.icon || '📖'}
                    </Text>
                  </View>
                  <View style={styles.modalWordTitle}>
                    <Text style={[styles.modalIzonWord, { color: theme.text }]}>{selectedWord.izonWord}</Text>
                    <Text style={[styles.modalEnglishWord, { color: theme.subText }]}>{selectedWord.englishTranslation}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalFavorite}
                    onPress={() => toggleFavorite(selectedWord._id)}
                  >
                    <MaterialIcons
                      name={favorites.includes(selectedWord._id) ? 'favorite' : 'favorite-border'}
                      size={28}
                      color={favorites.includes(selectedWord._id) ? theme.error : theme.subText}
                    />
                  </TouchableOpacity>
                </View>

                {/* Metadata */}
                <View style={styles.modalMetadata}>
                  <View style={[styles.modalBadge, { backgroundColor: getDifficultyColor(selectedWord.difficulty) }]}>
                    <Text style={styles.modalBadgeText}>{selectedWord.difficulty}</Text>
                  </View>
                  <View style={[styles.modalBadge, { backgroundColor: theme.background }]}>
                    <Text style={[styles.modalBadgeText, { color: theme.subText }]}>{selectedWord.category}</Text>
                  </View>
                  {selectedWord.audioAvailable && (
                    <View style={[styles.modalBadge, { backgroundColor: theme.background }]}>
                      <Ionicons name="volume-high" size={14} color={theme.success} />
                      <Text style={[styles.modalBadgeText, { color: theme.subText }]}>Audio</Text>
                    </View>
                  )}
                </View>

                {/* Pronunciation */}
                {selectedWord.pronunciation && (
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Pronunciation</Text>
                    <Text style={[styles.modalPronunciation, { backgroundColor: `${theme.success}20`, color: theme.success }]}>{selectedWord.pronunciation}</Text>
                  </View>
                )}

                {/* Examples */}
                {selectedWord.examples && selectedWord.examples.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Examples</Text>
                    {selectedWord.examples.map((example, index) => (
                      <View key={index} style={styles.exampleItem}>
                        <Text style={[styles.exampleIzon, { color: theme.text }]}>• {example.izon}</Text>
                        <Text style={[styles.exampleEnglish, { color: theme.subText }]}>{example.english}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Cultural Notes */}
                {selectedWord.culturalNote && (
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Cultural Note</Text>
                    <Text style={[styles.culturalNote, { backgroundColor: `${theme.warning}20`, color: theme.text }]}>
                      {selectedWord.culturalNote}
                    </Text>
                  </View>
                )}

                {/* Image */}
                {selectedWord.image && (
                  <Image source={{ uri: selectedWord.image }} style={styles.modalImage} />
                )}

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.modalActionButton, { backgroundColor: `${theme.success}20` }]}
                    onPress={() => playAudio(selectedWord._id)}
                  >
                    <Ionicons name="volume-high" size={20} color={theme.success} />
                    <Text style={[styles.modalActionText, { color: theme.success }]}>Play Audio</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalActionButton, { backgroundColor: `${theme.error}20` }]}
                    onPress={() => setReportModalVisible(true)}
                  >
                    <MaterialIcons name="report" size={20} color={theme.error} />
                    <Text style={[styles.modalActionText, { color: theme.error }]}>Report</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalActionButton, { backgroundColor: `${theme.primary}20` }]}>
                    <MaterialIcons name="bookmark" size={20} color={theme.primary} />
                    <Text style={[styles.modalActionText, { color: theme.primary }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </BlurView>
      </Modal>

      {/* Report Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={reportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={[styles.reportModalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.reportModalTitle, { color: theme.text }]}>Report Word</Text>
            <Text style={[styles.reportModalSubtitle, { color: theme.subText }]}>
              Please describe the issue with this word (e.g., incorrect translation, spelling error).
            </Text>
            <TextInput
              style={[styles.reportInput, { backgroundColor: theme.background, color: theme.text }]}
              placeholder="Enter reason..."
              placeholderTextColor={theme.subText}
              multiline
              numberOfLines={4}
              value={reportReason}
              onChangeText={setReportReason}
            />
            <View style={styles.reportActions}>
              <TouchableOpacity 
                style={[styles.reportButton, { backgroundColor: theme.border }]}
                onPress={() => setReportModalVisible(false)}
              >
                <Text style={[styles.reportButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.reportButton, { backgroundColor: theme.error }]}
                onPress={handleReportWord}
                disabled={isReporting || !reportReason.trim()}
              >
                {isReporting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.reportButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stats Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={statsModalVisible}
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={theme.headerGradient}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Vocabulary Stats</Text>
              <TouchableOpacity onPress={() => setStatsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalBody}>
              <View style={styles.statsGrid}>
                <View style={[styles.statBox, { backgroundColor: theme.background }]}>
                  <Text style={[styles.statBoxNumber, { color: theme.primary }]}>
                    {backendStats?.totalCount || vocabulary.length}
                  </Text>
                  <Text style={[styles.statBoxLabel, { color: theme.subText }]}>Total Words</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.background }]}>
                  <Text style={[styles.statBoxNumber, { color: theme.primary }]}>{favorites.length}</Text>
                  <Text style={[styles.statBoxLabel, { color: theme.subText }]}>Favorites</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.background }]}>
                  <Text style={[styles.statBoxNumber, { color: theme.primary }]}>
                    {backendStats?.byStatus?.published || vocabulary.filter(w => w.audioAvailable).length}
                  </Text>
                  <Text style={[styles.statBoxLabel, { color: theme.subText }]}>Published</Text>
                </View>
              </View>

              <Text style={[styles.statsSectionTitle, { color: theme.text }]}>By Category</Text>
              {(backendStats?.byCategory || []).length > 0 ? (
                backendStats.byCategory.map(cat => {
                  const percentage = backendStats.totalCount > 0 ? (cat.count / backendStats.totalCount) * 100 : 0;
                  return (
                    <View key={cat._id} style={styles.categoryStat}>
                      <View style={styles.categoryStatHeader}>
                        <Text style={[styles.categoryStatName, { color: theme.subText }]}>{cat._id}</Text>
                        <Text style={[styles.categoryStatCount, { color: theme.text }]}>{cat.count}</Text>
                      </View>
                      <View style={[styles.categoryStatBar, { backgroundColor: theme.border }]}>
                        <View style={[styles.categoryStatFill, { width: `${percentage}%`, backgroundColor: theme.primary }]} />
                      </View>
                    </View>
                  );
                })
              ) : (
                categories.filter(c => c.id !== 'all').map(cat => {
                  const count = vocabulary.filter(w => w.category === cat.id).length;
                  const percentage = vocabulary.length > 0 ? (count / vocabulary.length) * 100 : 0;
                  return (
                    <View key={cat.id} style={styles.categoryStat}>
                      <View style={styles.categoryStatHeader}>
                        <Text style={[styles.categoryStatName, { color: theme.subText }]}>{cat.label}</Text>
                        <Text style={[styles.categoryStatCount, { color: theme.text }]}>{count}</Text>
                      </View>
                      <View style={[styles.categoryStatBar, { backgroundColor: theme.border }]}>
                        <View style={[styles.categoryStatFill, { width: `${percentage}%`, backgroundColor: theme.primary }]} />
                      </View>
                    </View>
                  );
                })
              )}

              <Text style={[styles.statsSectionTitle, { color: theme.text }]}>By Difficulty</Text>
              {['beginner', 'intermediate', 'advanced'].map(level => {
                const count = vocabulary.filter(w => w.difficulty === level).length;
                const percentage = vocabulary.length > 0 ? (count / vocabulary.length) * 100 : 0;
                return (
                  <View key={level} style={styles.categoryStat}>
                    <View style={styles.categoryStatHeader}>
                      <Text style={[styles.categoryStatName, { color: theme.subText }]}>{level}</Text>
                      <Text style={[styles.categoryStatCount, { color: theme.text }]}>{count}</Text>
                    </View>
                    <View style={[styles.categoryStatBar, { backgroundColor: theme.border }]}>
                      <View 
                        style={[
                          styles.categoryStatFill, 
                          { width: `${percentage}%`, backgroundColor: getDifficultyColor(level) }
                        ]} 
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
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
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 15,
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    padding: 8,
  },
  searchSection: {
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
  categoriesScroll: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: '#FFD700',
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#1a4c2e',
  },
  viewControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 2,
  },
  viewModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewModeActive: {
    backgroundColor: '#fff',
  },
  sortContainer: {
    flexDirection: 'row',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  sortText: {
    color: '#fff',
    fontSize: 12,
  },
  resultsCount: {
    alignItems: 'flex-end',
  },
  resultsCountText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 5,
    marginBottom: 20,
    textAlign: 'center',
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
  // Grid View Styles
  gridList: {
    padding: 15,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  gridItemWrapper: {
    width: (width - 45) / 2,
    marginBottom: 15,
  },
  gridCard: {
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gridCardGradient: {
    padding: 15,
    position: 'relative',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  gridWordContainer: {
    marginBottom: 8,
  },
  gridIzonWord: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a4c2e',
    marginBottom: 4,
  },
  gridEnglishWord: {
    fontSize: 14,
    color: '#666',
  },
  difficultyBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  difficultyText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  audioIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  categoryIcon: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  categoryIconText: {
    fontSize: 16,
  },
  // List View Styles
  listContent: {
    padding: 15,
  },
  listItemWrapper: {
    marginBottom: 10,
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  listCardContent: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  listIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listIcon: {
    fontSize: 24,
  },
  listWordContainer: {
    flex: 1,
  },
  listWordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  listIzonWord: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  listEnglishWord: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  listExample: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  listMetadata: {
    alignItems: 'center',
    gap: 8,
  },
  listDifficulty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listDifficultyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  // Modal Styles
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
  modalWordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  modalIcon: {
    fontSize: 30,
  },
  modalWordTitle: {
    flex: 1,
  },
  modalIzonWord: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalEnglishWord: {
    fontSize: 16,
    color: '#666',
  },
  modalFavorite: {
    padding: 8,
  },
  modalMetadata: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  modalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 4,
  },
  modalBadgeText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  modalPronunciation: {
    fontSize: 18,
    color: '#4CAF50',
    fontStyle: 'italic',
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
  },
  exampleItem: {
    marginBottom: 10,
  },
  exampleIzon: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  exampleEnglish: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  culturalNote: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 15,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 20,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
  },
  modalActionText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  // Stats Modal Styles
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  statBoxNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a4c2e',
    marginBottom: 4,
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#666',
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
  },
  categoryStat: {
    marginBottom: 12,
  },
  categoryStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryStatName: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  categoryStatCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryStatBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryStatFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  
  // Report Modal Styles
  reportModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  reportModalContent: { width: '100%', borderRadius: 20, padding: 25 },
  reportModalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  reportModalSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  reportInput: { minHeight: 100, borderRadius: 12, padding: 15, fontSize: 14, textAlignVertical: 'top', marginBottom: 20 },
  reportActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  reportButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  reportButtonText: { color: '#fff', fontWeight: 'bold' },
});

export default VocabularyScreen;