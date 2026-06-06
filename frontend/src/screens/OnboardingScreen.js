import React, { useState, useRef, useContext, useCallback } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageContext } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

const onboardingData = [
  {
    id: 'welcome',
    icon: 'language',
    title: 'Learn Izon with confidence',
    description: 'Build vocabulary, pronunciation, and cultural understanding through focused daily practice.',
    gradient: ['#1a4c2e', '#2e7d32'],
  },
  {
    id: 'practice',
    icon: 'school',
    title: 'Practice that adapts',
    description: 'Use lessons, flashcards, quizzes, and listening tools to strengthen what you are learning.',
    gradient: ['#2196F3', '#1565C0'],
  },
  {
    id: 'community',
    icon: 'people',
    title: 'Connect with learners',
    description: 'Join discussions, ask questions, and keep your progress moving with the community.',
    gradient: ['#FF9800', '#EF6C00'],
  },
];

export default function OnboardingScreen({ navigation }) {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { activeLanguage } = useContext(LanguageContext);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef(null);
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const slides = onboardingData.map((slide, index) => ({
    ...slide,
    title: index === 0 ? `Learn ${activeLanguage?.name || 'Izon'} with confidence` : slide.title,
  }));

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    navigation.replace('Main');
  }, [navigation]);

  const scrollToNext = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
      return;
    }

    completeOnboarding();
  }, [completeOnboarding, currentIndex, slides.length]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={slides}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <LinearGradient colors={item.gradient} style={styles.iconContainer}>
              <Ionicons name={item.icon} size={80} color="#fff" />
            </LinearGradient>
            <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.description, { color: theme.subText }]}>{item.description}</Text>
          </View>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
      />
      
      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: theme.primary, opacity: i === currentIndex ? 1 : 0.3 }]} />
          ))}
        </View>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={scrollToNext}>
          <Text style={styles.buttonText}>{currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: { width, alignItems: 'center', justifyContent: 'center', padding: 40 },
  iconContainer: { width: 160, height: 160, borderRadius: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  description: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  footer: { padding: 40, alignItems: 'center' },
  pagination: { flexDirection: 'row', marginBottom: 30 },
  dot: { height: 10, width: 10, borderRadius: 5, marginHorizontal: 5 },
  button: { paddingHorizontal: 40, paddingVertical: 15, borderRadius: 25 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
