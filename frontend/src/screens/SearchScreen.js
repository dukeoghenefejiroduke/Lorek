import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StatusBar,
  Dimensions,
  Animated,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import haptics from "../utils/haptics";
import { LanguageContext } from '../context/LanguageContext';

import { searchAPI } from '../services/api';

const { width } = Dimensions.get('window');

// ============================================================================
// COMPONENTS
// ============================================================================

const SearchBar = ({ value, onChange, onClear, onFocus, onBlur, loading, theme }) => (
  <View style={[styles.searchBarContainer, { backgroundColor: theme.card }]}>
    <View style={[styles.searchBar, { backgroundColor: theme.background }]}>
      <Ionicons name="search" size={20} color={theme.subText} />
      <TextInput
        style={[styles.searchInput, { color: theme.text }]}
        placeholder="Search words, lessons..."
        placeholderTextColor={theme.subText}
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading && <ActivityIndicator size="small" color={theme.primary} />}
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear}>
          <Ionicons name="close-circle" size={20} color={theme.subText} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const SearchTypeFilter = ({ types, activeType, onSelect, theme }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={[styles.typeFilterContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
  >
    {types.map((type) => (
      <TouchableOpacity
        key={type.id}
        style={[styles.typeChip, { backgroundColor: theme.background }, activeType === type.id && [styles.activeTypeChip, { backgroundColor: theme.primary + '20' }]]}
        onPress={() => onSelect(type.id)}
      >
        <MaterialIcons name={type.icon} size={16} color={activeType === type.id ? theme.primary : theme.subText} />
        <Text style={[styles.typeChipText, { color: theme.subText }, activeType === type.id && [styles.activeTypeChipText, { color: theme.primary }]]}>
          {type.label}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const SuggestionItem = ({ suggestion, onPress, theme }) => (
  <TouchableOpacity style={[styles.suggestionItem, { borderBottomColor: theme.border }]} onPress={() => onPress(suggestion)}>
    <MaterialIcons name="search" size={18} color={theme.subText} />
    <Text style={[styles.suggestionText, { color: theme.text }]}>{suggestion}</Text>
  </TouchableOpacity>
);

const RecentSearchItem = ({ item, onPress, onDelete, theme }) => (
  <TouchableOpacity style={[styles.recentItem, { borderBottomColor: theme.border }]} onPress={() => onPress(item.query)}>
    <View style={styles.recentItemLeft}>
      <MaterialIcons name="history" size={18} color={theme.subText} />
      <Text style={[styles.recentText, { color: theme.text }]}>{item.query}</Text>
    </View>
    <TouchableOpacity onPress={() => onDelete(item.query)}>
      <MaterialIcons name="close" size={18} color={theme.subText} />
    </TouchableOpacity>
  </TouchableOpacity>
);

const TrendingItem = ({ item, index, onPress, theme }) => (
  <TouchableOpacity style={[styles.trendingItem, { borderBottomColor: theme.border }]} onPress={() => onPress(item.query)}>
    <Text style={[styles.trendingRank, { color: theme.primary }]}>#{index + 1}</Text>
    <View style={styles.trendingContent}>
      <Text style={[styles.trendingQuery, { color: theme.text }]}>{item.query}</Text>
      <Text style={[styles.trendingCount, { color: theme.subText }]}>{item.count} searches</Text>
    </View>
    {item.hasExactMatch && <MaterialIcons name="check-circle" size={16} color={theme.primary} />}
  </TouchableOpacity>
);

const VocabularyResultItem = ({ item, onPress, theme }) => (
  <TouchableOpacity style={[styles.resultCard, { backgroundColor: theme.card }]} onPress={() => onPress(item)}>
    <View style={[styles.resultIcon, { backgroundColor: theme.primary + '20' }]}>
      <Text style={styles.resultIconText}>📖</Text>
    </View>
    <View style={styles.resultContent}>
      <Text style={[styles.resultTitle, { color: theme.text }]}>{item.izonWord}</Text>
      <Text style={[styles.resultSubtitle, { color: theme.subText }]}>{item.englishTranslation}</Text>
      <View style={styles.resultTags}>
        <View style={[styles.resultTag, { backgroundColor: theme.background }]}>
          <Text style={[styles.resultTagText, { color: theme.subText }]}>{item.category}</Text>
        </View>
        <View style={[styles.resultTag, { backgroundColor: theme.secondary + '20' }]}>
          <Text style={[styles.resultTagText, { color: theme.secondary }]}>{item.difficulty}</Text>
        </View>
      </View>
    </View>
    <MaterialIcons name="chevron-right" size={20} color={theme.subText} />
  </TouchableOpacity>
);

const LessonResultItem = ({ item, onPress, theme }) => (
  <TouchableOpacity style={[styles.resultCard, { backgroundColor: theme.card }]} onPress={() => onPress(item)}>
    <View style={[styles.resultIcon, { backgroundColor: theme.secondary + '20' }]}>
      <Text style={styles.resultIconText}>📚</Text>
    </View>
    <View style={styles.resultContent}>
      <Text style={[styles.resultTitle, { color: theme.text }]}>{item.title.english}</Text>
      <Text style={[styles.resultSubtitle, { color: theme.subText }]}>{item.description?.english?.substring(0, 60)}...</Text>
      <View style={styles.resultTags}>
        <View style={[styles.resultTag, { backgroundColor: theme.background }]}>
          <Text style={[styles.resultTagText, { color: theme.subText }]}>{item.level}</Text>
        </View>
        <View style={[styles.resultTag, { backgroundColor: theme.secondary + '20' }]}>
          <Text style={[styles.resultTagText, { color: theme.secondary }]}>{item.category}</Text>
        </View>
        {item.estimatedTime && (
          <View style={[styles.resultTag, { backgroundColor: theme.accent + '20' }]}>
            <Text style={[styles.resultTagText, { color: theme.accent }]}>{item.estimatedTime.minutes} min</Text>
          </View>
        )}
      </View>
    </View>
    <MaterialIcons name="chevron-right" size={20} color={theme.subText} />
  </TouchableOpacity>
);

const UserResultItem = ({ item, onPress, theme }) => (
  <TouchableOpacity style={[styles.resultCard, { backgroundColor: theme.card }]} onPress={() => onPress(item)}>
    <View style={[styles.userAvatar, { backgroundColor: theme.primary }]}>
      <Text style={styles.userAvatarText}>
        {item.profile?.displayName?.charAt(0) || item.username?.charAt(0) || 'U'}
      </Text>
    </View>
    <View style={styles.resultContent}>
      <Text style={[styles.resultTitle, { color: theme.text }]}>{item.profile?.displayName || item.username}</Text>
      <Text style={[styles.resultSubtitle, { color: theme.subText }]}>@{item.username}</Text>
      <View style={styles.resultTags}>
        <View style={[styles.resultTag, { backgroundColor: theme.background }]}>
          <MaterialIcons name="stars" size={12} color={theme.accent} />
          <Text style={[styles.resultTagText, { color: theme.subText }]}>Level {item.progress?.level || 1}</Text>
        </View>
        <View style={[styles.resultTag, { backgroundColor: theme.background }]}>
          <MaterialIcons name="whatshot" size={12} color={theme.error} />
          <Text style={[styles.resultTagText, { color: theme.subText }]}>{item.progress?.totalPoints || 0} XP</Text>
        </View>
      </View>
    </View>
    <MaterialIcons name="chevron-right" size={20} color={theme.subText} />
  </TouchableOpacity>
);

// ============================================================================
// MAIN SCREEN
// ============================================================================
export default function SearchScreen({ navigation }) {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { activeLanguage } = useContext(LanguageContext);
  const [searchQuery, setSearchQuery] = useState('');
  // ...

  const [searchType, setSearchType] = useState('all');
  const [results, setResults] = useState({ vocabulary: [], lessons: [], users: [], total: 0 });
  const [suggestions, setSuggestions] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const searchTypes = [
    { id: 'all', label: 'All', icon: 'apps' },
    { id: 'vocabulary', label: 'Vocabulary', icon: 'menu-book' },
    { id: 'lessons', label: 'Lessons', icon: 'school' },
    { id: 'users', label: 'Users', icon: 'people' },
  ];

  useEffect(() => {
    loadRecentSearches();
    loadTrending();
  }, [activeLanguage]);

  const loadRecentSearches = async () => {
    try {
      const response = await searchAPI.recent();
      setRecentSearches(response.data.data || []);
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  };

  const loadTrending = async () => {
    try {
      const response = await searchAPI.trending();
      setTrending(response.data.data || []);
    } catch (error) {
      console.error('Failed to load trending:', error);
    }
  };

  const handleSearch = async (query = searchQuery) => {
    if (!query.trim() || query.length < 2) return;

    Keyboard.dismiss();
    setSearching(true);
    setHasSearched(true);
    haptics.impactLight();

    try {
      const response = await searchAPI.global(query, searchType);
      setResults(response.data.data);
      await loadRecentSearches();
    } catch (error) {
      console.error('Search failed:', error);
      Alert.alert('Error', 'Failed to perform search');
    } finally {
      setSearching(false);
    }
  };

  const handleSuggestionPress = async (suggestion) => {
    setSearchQuery(suggestion);
    await handleSearch(suggestion);
  };

  const handleRecentDelete = async (query) => {
    try {
      await searchAPI.deleteHistoryItem(query);
      await loadRecentSearches();
      haptics.impactLight();
    } catch (error) {
      console.error('Failed to delete recent search:', error);
    }
  };

  const clearRecentSearches = async () => {
    try {
      await searchAPI.clearHistory();
      await loadRecentSearches();
      haptics.notificationSuccess();
    } catch (error) {
      console.error('Failed to clear recent searches:', error);
    }
  };

  const loadSuggestions = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await searchAPI.suggestions(query);
      setSuggestions(response.data.data || []);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const handleTextChange = (text) => {
    setSearchQuery(text);
    if (text.length > 0) {
      loadSuggestions(text);
    } else {
      setSuggestions([]);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setSuggestions([]);
    setHasSearched(false);
    setResults({ vocabulary: [], lessons: [], users: [], total: 0 });
  };

  const handleResultPress = (item) => {
    if (item.type === 'vocabulary') {
      navigation.navigate('VocabularyDetail', { wordId: item._id });
    } else if (item.type === 'lesson') {
      navigation.navigate('LessonDetail', { lessonId: item._id });
    } else if (item.type === 'user') {
      navigation.navigate('UserProfile', { userId: item._id });
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="search-off" size={60} color={theme.subText} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No results found</Text>
      <Text style={[styles.emptyText, { color: theme.subText }]}>
        Try different keywords or check your spelling
      </Text>
    </View>
  );

  const renderInitialState = () => (
    <View>
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.subText }]}>
              <MaterialIcons name="history" size={18} color={theme.subText} /> Recent Searches
            </Text>
            <TouchableOpacity onPress={clearRecentSearches}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((item) => (
            <RecentSearchItem
              key={item.query}
              item={item}
              onPress={handleSuggestionPress}
              onDelete={handleRecentDelete}
              theme={theme}
            />
          ))}
        </View>
      )}

      {/* Trending Searches */}
      {trending.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.subText }]}>
              <MaterialIcons name="trending-up" size={18} color={theme.subText} /> Trending
            </Text>
          </View>
          {trending.map((item, index) => (
            <TrendingItem
              key={item.query}
              item={item}
              index={index}
              onPress={handleSuggestionPress}
              theme={theme}
            />
          ))}
        </View>
      )}
    </View>
  );

  const renderResults = () => {
    if (results.total === 0 && !searching) {
      return renderEmptyState();
    }

    const data = [];
    if (searchType === 'all' || searchType === 'vocabulary') {
      data.push(...results.vocabulary.map(r => ({ ...r, type: 'vocabulary' })));
    }
    if (searchType === 'all' || searchType === 'lessons') {
      data.push(...results.lessons.map(r => ({ ...r, type: 'lesson' })));
    }
    if (searchType === 'all' || searchType === 'users') {
      data.push(...results.users.map(r => ({ ...r, type: 'user' })));
    }

    return (
      <FlatList
        data={data}
        keyExtractor={(item, index) => `${item.type}-${item._id || index}`}
        renderItem={({ item }) => {
          if (item.type === 'vocabulary') {
            return <VocabularyResultItem item={item} onPress={handleResultPress} theme={theme} />;
          } else if (item.type === 'lesson') {
            return <LessonResultItem item={item} onPress={handleResultPress} theme={theme} />;
          } else if (item.type === 'user') {
            return <UserResultItem item={item} onPress={handleResultPress} theme={theme} />;
          }
          return null;
        }}
        contentContainerStyle={styles.resultsList}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

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
          <Text style={styles.headerTitle}>Search</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <SearchBar
        value={searchQuery}
        onChange={handleTextChange}
        onClear={handleClear}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        loading={searching}
        theme={theme}
      />

      {searchQuery.length > 0 && suggestions.length > 0 && isFocused && !hasSearched && (
        <FlatList
          data={suggestions}
          keyExtractor={(item, index) => `${item}-${index}`}
          renderItem={({ item }) => <SuggestionItem suggestion={item} onPress={handleSuggestionPress} theme={theme} />}
          style={[styles.suggestionsList, { backgroundColor: theme.card, borderTopColor: theme.border }]}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <SearchTypeFilter
        types={searchTypes}
        activeType={searchType}
        onSelect={setSearchType}
        theme={theme}
      />

      <View style={styles.content}>
        {searching ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
        ) : hasSearched ? (
          <FlatList
            data={
              searchType === 'all' 
                ? [
                    ...results.vocabulary.map(r => ({ ...r, type: 'vocabulary' })),
                    ...results.lessons.map(r => ({ ...r, type: 'lesson' })),
                    ...results.users.map(r => ({ ...r, type: 'user' }))
                  ]
                : searchType === 'vocabulary'
                ? results.vocabulary.map(r => ({ ...r, type: 'vocabulary' }))
                : searchType === 'lessons'
                ? results.lessons.map(r => ({ ...r, type: 'lesson' }))
                : results.users.map(r => ({ ...r, type: 'user' }))
            }
            keyExtractor={(item, index) => `${item.type}-${item._id || index}`}
            renderItem={({ item }) => {
              if (item.type === 'vocabulary') {
                return <VocabularyResultItem item={item} onPress={handleResultPress} theme={theme} />;
              } else if (item.type === 'lesson') {
                return <LessonResultItem item={item} onPress={handleResultPress} theme={theme} />;
              } else if (item.type === 'user') {
                return <UserResultItem item={item} onPress={handleResultPress} theme={theme} />;
              }
              return null;
            }}
            ListEmptyComponent={renderEmptyState()}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleSearch} 
                colors={[theme.primary]} 
                tintColor={theme.primary}
              />
            }
          />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={loadTrending} 
                colors={[theme.primary]}
                tintColor={theme.primary}
              />
            }
          >
            {renderInitialState()}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  searchBarContainer: { padding: 15, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, gap: 10 },
  searchInput: { flex: 1, fontSize: 16 },
  typeFilterContainer: { paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1 },
  typeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, gap: 6 },
  activeTypeChip: { },
  typeChipText: { fontSize: 14 },
  activeTypeChipText: { fontWeight: '600' },
  content: { flex: 1, padding: 15 },
  suggestionsList: { borderTopWidth: 1, maxHeight: 300 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12, borderBottomWidth: 1 },
  suggestionText: { fontSize: 15, flex: 1 },
  section: { marginBottom: 25 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  clearText: { fontSize: 13, color: '#F44336' },
  recentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  recentItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentText: { fontSize: 15 },
  trendingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  trendingRank: { fontSize: 16, fontWeight: 'bold', width: 35 },
  trendingContent: { flex: 1 },
  trendingQuery: { fontSize: 15, marginBottom: 2 },
  trendingCount: { fontSize: 12, color: '#999' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 10 },
  resultsList: { paddingBottom: 20, gap: 10 },
  resultCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 15, gap: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  resultIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  resultIconText: { fontSize: 24 },
  resultContent: { flex: 1 },
  resultTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  resultSubtitle: { fontSize: 13, marginBottom: 6 },
  resultTags: { flexDirection: 'row', gap: 6 },
  resultTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultTagText: { fontSize: 10 },
  userAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 8 },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
