import React, { useState, useRef, useEffect, useContext } from 'react';
import { ThemeContext, lightTheme as theme } from '../context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { communityAPI } from '../services/api';
import LoadingOverlay from '../components/LoadingOverlay';

const CATEGORIES = [
  { id: 'general', name: 'General', icon: 'forum', color: '#4CAF50' },
  { id: 'grammar', name: 'Grammar', icon: 'school', color: '#2196F3' },
  { id: 'vocabulary', name: 'Vocabulary', icon: 'menu-book', color: '#FF9800' },
  { id: 'culture', name: 'Culture', icon: 'museum', color: '#9C27B0' },
  { id: 'questions', name: 'Questions', icon: 'help', color: '#E91E63' },
  { id: 'announcements', name: 'Announcements', icon: 'campaign', color: '#00BCD4' },
];

export default function CreateDiscussionScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  const [titleLength, setTitleLength] = useState(0);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const handleTitleChange = (text) => {
    if (text.length <= 200) {
      setTitle(text);
      setTitleLength(text.length);
    }
  };

  const handleCreateDiscussion = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please enter discussion content');
      return;
    }

    if (title.length < 5) {
      Alert.alert('Error', 'Title must be at least 5 characters');
      return;
    }

    if (content.length < 20) {
      Alert.alert('Error', 'Content must be at least 20 characters');
      return;
    }

    setLoading(true);
    haptics.impactMedium();

    try {
      const response = await communityAPI.createDiscussion({
        title: title.trim(),
        content: content.trim(),
        category: selectedCategory,
      });

      if (response.data.success) {
        haptics.notificationSuccess();
        Alert.alert(
          'Success!',
          'Your discussion has been created successfully.',
          [
            {
              text: 'View Discussion',
              onPress: () => {
                navigation.replace('DiscussionDetail', { discussionId: response.data.data._id });
              },
            },
            { text: 'Back to Community', onPress: () => navigation.goBack() },
          ]
        );
      }
    } catch (error) {
      console.error('Failed to create discussion:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to create discussion');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (categoryId) => {
    const category = CATEGORIES.find(c => c.id === categoryId);
    return category?.icon || 'forum';
  };

  const getCategoryColor = (categoryId) => {
    const category = CATEGORIES.find(c => c.id === categoryId);
    return category?.color || '#4CAF50';
  };

  return (
    <View style={styles.container}>
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
          <Text style={styles.headerTitle}>Create Discussion</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.headerSubtitle}>
          Start a new conversation with the community
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="category" size={20} color="#4CAF50" /> Category
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      selectedCategory === category.id && styles.categoryChipActive,
                      { borderColor: getCategoryColor(category.id) },
                    ]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <MaterialIcons
                      name={category.icon}
                      size={16}
                      color={selectedCategory === category.id ? '#fff' : getCategoryColor(category.id)}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategory === category.id && styles.categoryChipTextActive,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Title Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="title" size={20} color="#4CAF50" /> Title
              </Text>
              <View style={styles.titleContainer}>
                <TextInput
                  style={styles.titleInput}
                  placeholder="What would you like to discuss?"
                  placeholderTextColor="#999"
                  value={title}
                  onChangeText={handleTitleChange}
                  maxLength={200}
                />
                <Text style={[styles.charCount, titleLength > 180 && styles.charCountWarning]}>
                  {titleLength}/200
                </Text>
              </View>
            </View>

            {/* Content Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="description" size={20} color="#4CAF50" /> Content
              </Text>
              <TextInput
                style={styles.contentInput}
                placeholder="Share your thoughts, ask questions, or start a discussion..."
                placeholderTextColor="#999"
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />
            </View>

            {/* Tips Section */}
            <View style={styles.tipsCard}>
              <View style={styles.tipsHeader}>
                <FontAwesome5 name="lightbulb" size={20} color="#FFD700" />
                <Text style={styles.tipsTitle}>Tips for a great discussion</Text>
              </View>
              <View style={styles.tipItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.tipText}>Use a clear, descriptive title</Text>
              </View>
              <View style={styles.tipItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.tipText}>Provide context and specific details</Text>
              </View>
              <View style={styles.tipItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.tipText}>Be respectful and constructive</Text>
              </View>
              <View style={styles.tipItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.tipText}>Use examples to illustrate your points</Text>
              </View>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createButton, loading && styles.createButtonDisabled]}
              onPress={handleCreateDiscussion}
              disabled={loading}
            >
              <LinearGradient
                colors={['#4CAF50', '#2E7D32']}
                style={styles.createButtonGradient}
              >
                <>
                  <MaterialIcons name="post-add" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>Create Discussion</Text>
                </>
              </LinearGradient>
            </TouchableOpacity>
            <LoadingOverlay visible={loading} message="Creating discussion..." />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  keyboardView: {
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
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 12,
    gap: 8,
  },
  categoriesScroll: {
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    marginRight: 10,
    borderWidth: 1,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryChipText: {
    fontSize: 14,
    color: theme.subText,
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  titleContainer: {
    position: 'relative',
  },
  titleInput: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    paddingRight: 60,
  },
  charCount: {
    position: 'absolute',
    right: 15,
    bottom: 15,
    fontSize: 12,
    color: '#999',
  },
  charCountWarning: {
    color: '#FF9800',
  },
  contentInput: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 180,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  tipsCard: {
    backgroundColor: theme.card,
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tipText: {
    fontSize: 14,
    color: theme.subText,
    flex: 1,
  },
  createButton: {
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});