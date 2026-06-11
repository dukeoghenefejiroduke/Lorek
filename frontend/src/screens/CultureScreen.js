import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  Share,
  RefreshControl,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';
import ScreenHeader from '../components/ScreenHeader';
import LanguageSwitcher from '../components/LanguageSwitcher';

import { cultureAPI } from '../services/api';

const { width } = Dimensions.get('window');

export default function CultureScreen({ navigation }) {
  const { activeLanguage } = useContext(LanguageContext);
  const [categories, setCategories] = useState([]);
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [content, setContent] = useState([]);
  const [proverbs, setProverbs] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proverbOfDay, setProverbOfDay] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  
   const contextValue = useContext(ThemeContext) || {};
   console.log('DEBUG: Accessing ThemeContext in CultureScreen.js:', contextValue);
   const { isDarkMode, theme } = contextValue;
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    loadInitialData();
    startAnimations();
  }, [activeLanguage]);

  useEffect(() => {
    if (selectedCategory) {
      loadContentByCategory(selectedCategory);
    }
  }, [selectedCategory]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, proverbDayRes] = await Promise.all([
        cultureAPI.getCategories({ 
          lang: activeLanguage.code  || 'IZON'
        }),
        cultureAPI.getProverbOfDay({ 
          lang: activeLanguage.code || 'IZON'
        }),
     ]);
      if (categoriesRes.data.success) {
        const cats = categoriesRes.data.data;
        setCategories(cats);
        if (cats.length > 0 && !selectedCategory) {
          setSelectedCategory(cats[0].id || cats[0].name);
        }
      }

      if (proverbDayRes.data.success) {
        setProverbOfDay(proverbDayRes.data.data);
      }
    } catch (error) {
      console.error('Failed to load culture data:', error);
      // Fallback to default categories
      setCategories([
        { id: 'traditions', name: 'Traditions', icon: '🪔', color: '#FF6B6B', order: 1 },
        { id: 'festivals', name: 'Festivals', icon: '🎉', color: '#4ECDC4', order: 2 },
        { id: 'food', name: 'Cuisine', icon: '🍲', color: '#FFE66D', order: 3 },
        { id: 'music', name: 'Music & Dance', icon: '🎵', color: '#A8E6CF', order: 4 },
        { id: 'proverbs', name: 'Proverbs', icon: '📜', color: '#FF8B94', order: 5 },
        { id: 'history', name: 'History', icon: '🏛️', color: '#B5EAD7', order: 6 },
        { id: 'attire', name: 'Traditional Attire', icon: '👘', color: '#C7CEEA', order: 7 },
        { id: 'language_tips', name: 'Language Tips', icon: '💬', color: '#FFDAC1', order: 8 },
      ]);
      if (!selectedCategory) setSelectedCategory('traditions');
    } finally {
      setLoading(false);
    }
  };

  const loadContentByCategory = async (categoryId) => {
  try {
    const response = await cultureAPI.getContentByCategory(categoryId, {
        lang: activeLanguage.code 
      });
    if (response.data.success) {
      const data = response.data.data;
      
      const isProverbSection = categoryId === 'proverbs' || 
                               (Array.isArray(data) && data.length > 0 && data[0].izon);

      if (Array.isArray(data)) {
        if (isProverbSection) {
          setProverbs(data);
          setContent([]);
        } else {
          setContent(data);
          setProverbs([]);
        }
      }
    }
  } catch (error) {
    console.error('Failed to load content:', error);
  }
};

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    if (selectedCategory) await loadContentByCategory(selectedCategory);
    setRefreshing(false);
  };

  const handleCategoryPress = (categoryId) => {
    haptics.impactLight();
    setSelectedCategory(categoryId);
  };

  const handleItemPress = async (item) => {
    setSelectedItem(item);
    setModalVisible(true);
    
    // If it's a proverb, load its specific details and comments
    if (item.izon) {
      try {
        const res = await cultureAPI.getProverb(item._id || item.id);
        if (res.data.success) {
          setSelectedItem(res.data.data);
          setComments(res.data.data.comments || []);
        }
      } catch (error) {
        console.warn('Failed to load proverb details:', error);
      }
    }
  };

  const handleLikeProverb = async () => {
    if (!selectedItem || isLiking) return;
    
    try {
      setIsLiking(true);
      haptics.impactLight();
      const res = await cultureAPI.likeProverb(selectedItem._id || selectedItem.id);
      if (res.data.success) {
        setSelectedItem(prev => ({
          ...prev,
          liked: !prev.liked,
          likesCount: res.data.liked ? (prev.likesCount || 0) + 1 : (prev.likesCount || 1) - 1
        }));
      }
    } catch (error) {
      console.error('Failed to like proverb:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedItem || !newComment.trim() || isCommenting) return;

    try {
      setIsCommenting(true);
      const res = await cultureAPI.addProverbComment(selectedItem._id || selectedItem.id, {
        text: newComment.trim()
      });
      if (res.data.success) {
        setComments(prev => [res.data.data, ...prev]);
        setNewComment('');
        haptics.notificationSuccess();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setIsCommenting(false);
    }
  };

  const shareContent = async () => {
    if (selectedItem) {
      try {
        await Share.share({
          message: selectedItem.proverb 
            ? `"${selectedItem.izon}" - ${selectedItem.english}\n\nMeaning: ${selectedItem.meaning}\n\nShared from Lorek App`
            : `${selectedItem.title}\n\n${selectedItem.description}\n\nShared from Lorek App`,
          title: selectedItem.title || `${activeLanguage?.name || 'Izon'} Proverb`,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  const renderCategoryCard = (category) => {
    const categoryId = category.id || category.name;
    const isActive = selectedCategory === categoryId;
    const color = category.color || theme.primary;
    
    return (
      <TouchableOpacity
        key={categoryId}
        style={[
          styles.categoryCard,
          isActive && styles.categoryCardActive,
          { backgroundColor: isActive ? color : theme.card },
        ]}
        onPress={() => handleCategoryPress(categoryId)}
      >
        <Text style={styles.categoryEmoji}>{category.icon || '📚'}</Text>
        <Text style={[styles.categoryName, { color: isActive ? '#fff' : theme.text }]}>
          {category.name || category.displayName?.english}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContentItem = (item) => (
    <TouchableOpacity
      key={item._id || item.id}
      style={[styles.contentCard, { backgroundColor: theme.card }]}
      onPress={() => handleItemPress(item)}
    >
      {item.image?.url && (
        <Image source={{ uri: item.image.url }} style={styles.contentImage} />
      )}
      <View style={styles.contentInfo}>
        <Text style={[styles.contentTitle, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.contentDescription, { color: theme.subText }]} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.contentFooter}>
          <MaterialIcons name="arrow-forward" size={16} color={theme.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderProverbCard = (proverb) => (
    <TouchableOpacity
      key={proverb._id}
      style={[styles.proverbCard, { backgroundColor: theme.card, borderLeftColor: theme.accent }]}
      onPress={() => handleItemPress(proverb)}
    >
      <Text style={[styles.proverbText, { color: theme.text }]}>"{proverb.izon}"</Text>
      <Text style={[styles.proverbTranslation, { color: theme.subText }]}>{proverb.english}</Text>
      <Text style={[styles.proverbMeaning, { color: theme.success }]}>{proverb.meaning}</Text>
    </TouchableOpacity>
  );

  const renderProverbOfDay = () => {
    if (!proverbOfDay) return null;

    return (
      <Animated.View style={[styles.proverbOfDayCard, { opacity: fadeAnim, shadowColor: '#000' }]}>
        <LinearGradient
          colors={isDarkMode ? ['#443300', '#664400'] : ['#FFD700', '#FFA500']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.proverbOfDayGradient}
        >
          <Text style={styles.proverbOfDayTitle}>📜 Proverb of the Day</Text>
          <Text style={styles.proverbOfDayText}>"{proverbOfDay.izon}"</Text>
          <Text style={styles.proverbOfDayTranslation}>{proverbOfDay.english}</Text>
          <TouchableOpacity
            style={[styles.proverbOfDayButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            onPress={() => handleItemPress(proverbOfDay)}
          >
            <Text style={styles.proverbOfDayButtonText}>Learn Meaning →</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
  };

  const currentContent = selectedCategory === 'proverbs' ? proverbs : content;
  const isProverbsCategory = selectedCategory === 'proverbs';

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.subText }]}>Loading culture...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={isDarkMode ? '#000' : '#1a4c2e'} />

      <LinearGradient
        colors={theme.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{activeLanguage?.name || 'Izon'} Culture</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.headerSubtitle}>
          Explore the rich heritage and traditions of the {activeLanguage?.name || 'Izon'} people
        </Text>
      </LinearGradient>

      <ScrollView
        style={[styles.content, { backgroundColor: theme.background }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
      >
        {/* Proverb of the Day */}
        {renderProverbOfDay()}

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {categories.map(renderCategoryCard)}
        </ScrollView>

        {/* Content */}
        <View style={styles.contentSection}>
          {currentContent.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌍</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Coming Soon</Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>More cultural content about {categories.find(c => (c.id || c.name) === selectedCategory)?.name || 'this section'} is being added!</Text>
            </View>
          ) : isProverbsCategory ? (
            currentContent.map(renderProverbCard)
          ) : (
            currentContent.map(renderContentItem)
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <BlurView intensity={isDarkMode ? 40 : 90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient colors={theme.headerGradient} style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedItem?.title || selectedItem?.izon || 'Details'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalBody}>
              {selectedItem?.image?.url && (
                <Image source={{ uri: selectedItem.image.url }} style={styles.modalImage} />
              )}

              {selectedItem?.izon && (
                <View style={[styles.modalProverbContainer, { backgroundColor: isDarkMode ? `${theme.success}20` : '#e8f5e9' }]}>
                  <Text style={[styles.modalProverbText, { color: isDarkMode ? theme.success : '#1a4c2e' }]}>"{selectedItem.izon}"</Text>
                  <Text style={[styles.modalTranslationText, { color: theme.subText }]}>{selectedItem.english}</Text>
                </View>
              )}

              <Text style={[styles.modalDescription, { color: theme.text }]}>
                {selectedItem?.details || selectedItem?.description || selectedItem?.meaning}
              </Text>

              {selectedItem?.ingredients && selectedItem.ingredients.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Ingredients:</Text>
                  <Text style={[styles.modalSectionText, { color: theme.subText }]}>{selectedItem.ingredients.join(', ')}</Text>
                </View>
              )}

              {selectedItem?.preparation && (
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Preparation:</Text>
                  <Text style={[styles.modalSectionText, { color: theme.subText }]}>{selectedItem.preparation}</Text>
                </View>
              )}

              {selectedItem?.duration && (
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Duration:</Text>
                  <Text style={[styles.modalSectionText, { color: theme.subText }]}>{selectedItem.duration}</Text>
                </View>
              )}

              {selectedItem?.significance && (
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Significance:</Text>
                  <Text style={[styles.modalSectionText, { color: theme.subText }]}>{selectedItem.significance}</Text>
                </View>
              )}

              {selectedItem?.instruments && selectedItem.instruments.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Instruments:</Text>
                  <Text style={[styles.modalSectionText, { color: theme.subText }]}>{selectedItem.instruments.join(', ')}</Text>
                </View>
              )}

              {/* Interactions for Proverbs */}
              {selectedItem?.izon && (
                <View style={styles.interactionsContainer}>
                  <View style={styles.statsRow}>
                    <TouchableOpacity 
                      style={[styles.interactionButton, selectedItem.liked && styles.likedButton]} 
                      onPress={handleLikeProverb}
                      disabled={isLiking}
                    >
                      <Ionicons 
                        name={selectedItem.liked ? "heart" : "heart-outline"} 
                        size={22} 
                        color={selectedItem.liked ? "#FF4B2B" : theme.subText} 
                      />
                      <Text style={[styles.interactionText, selectedItem.liked && { color: "#FF4B2B" }]}>
                        {selectedItem.likesCount || 0} Likes
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.interactionButton}>
                      <Ionicons name="chatbubble-outline" size={22} color={theme.subText} />
                      <Text style={[styles.interactionText, { color: theme.subText }]}>{comments.length} Comments</Text>
                    </View>
                  </View>

                  <View style={styles.commentInputContainer}>
                    <TextInput
                      style={[styles.commentInput, { backgroundColor: theme.background, color: theme.text }]}
                      placeholder="Add a comment..."
                      placeholderTextColor={theme.subText}
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                    />
                    <TouchableOpacity 
                      style={[styles.sendButton, { backgroundColor: theme.primary }]} 
                      onPress={handleAddComment}
                      disabled={isCommenting || !newComment.trim()}
                    >
                      {isCommenting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="send" size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {comments.length > 0 && (
                    <View style={styles.commentsList}>
                      <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Comments</Text>
                      {comments.map((comment, index) => (
                        <View key={comment._id || index} style={[styles.commentItem, { borderBottomColor: theme.border }]}>
                          <View style={styles.commentHeader}>
                            <Text style={[styles.commentUser, { color: theme.text }]}>
                              {comment.user?.username || 'User'}
                            </Text>
                            <Text style={[styles.commentDate, { color: theme.subText }]}>
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </Text>
                          </View>
                          <Text style={[styles.commentText, { color: theme.subText }]}>{comment.text}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.shareButton, { backgroundColor: theme.primary, flex: 1 }]} onPress={shareContent}>
                  <MaterialIcons name="share" size={20} color="#fff" />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 5 },
  
  content: { flex: 1, padding: 20 },
  
  proverbOfDayCard: { marginBottom: 20, borderRadius: 15, overflow: 'hidden', elevation: 5 },
  proverbOfDayGradient: { padding: 20 },
  proverbOfDayTitle: { fontSize: 14, color: '#fff', opacity: 0.9, marginBottom: 10 },
  proverbOfDayText: { fontSize: 18, fontStyle: 'italic', color: '#fff', marginBottom: 8, lineHeight: 26 },
  proverbOfDayTranslation: { fontSize: 14, color: '#fff', opacity: 0.9, marginBottom: 15 },
  proverbOfDayButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start' },
  proverbOfDayButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  
  categoriesScroll: { flexGrow: 0, marginBottom: 20 },
  categoryCard: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, marginRight: 10, alignItems: 'center', flexDirection: 'row', gap: 8 },
  categoryCardActive: {},
  categoryEmoji: { fontSize: 18 },
  categoryName: { fontSize: 14, fontWeight: '600', color: '#333' },
  categoryNameActive: { color: '#fff' },
  
  contentSection: { gap: 15 },
  contentCard: { backgroundColor: '#fff', borderRadius: 15, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 15 },
  contentImage: { width: '100%', height: 180 },
  contentInfo: { padding: 15 },
  contentTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  contentDescription: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 10 },
  contentFooter: { alignItems: 'flex-end' },
  
  proverbCard: { borderLeftColor: '#2e7d32', // Matches your header green
   backgroundColor: '#ffffff', padding: 20, borderRadius: 15, elevation: 3, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#FFD700' },
  proverbText: { fontSize: 18, fontStyle: 'italic', color: '#333', marginBottom: 8, lineHeight: 26 },
  proverbTranslation: { fontSize: 14, color: '#666', marginBottom: 8 },
  proverbMeaning: { fontSize: 13, color: '#4CAF50', lineHeight: 18 },
  
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 60, marginBottom: 15 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  modalBody: { padding: 20 },
  modalImage: { width: '100%', height: 200, borderRadius: 15, marginBottom: 15 },
  modalProverbContainer: { backgroundColor: '#e8f5e9', padding: 20, borderRadius: 15, marginBottom: 15 },
  modalProverbText: { fontSize: 20, fontStyle: 'italic', color: '#1a4c2e', marginBottom: 10, lineHeight: 28 },
  modalTranslationText: { fontSize: 16, color: '#666' },
  modalDescription: { fontSize: 16, color: '#333', lineHeight: 24, marginBottom: 15 },
  modalSection: { marginBottom: 15 },
  modalSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  modalSectionText: { fontSize: 14, color: '#666', lineHeight: 20 },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, marginTop: 10, marginBottom: 20 },
  shareButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  interactionsContainer: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  interactionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  interactionText: { fontSize: 14, color: '#666', fontWeight: '500' },
  commentInputContainer: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 25 },
  commentInput: { flex: 1, minHeight: 45, maxHeight: 100, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10, fontSize: 14 },
  sendButton: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  commentsList: { gap: 15 },
  commentItem: { paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  commentUser: { fontSize: 14, fontWeight: 'bold' },
  commentDate: { fontSize: 12, color: '#999' },
  commentText: { fontSize: 14, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 20 },
});
