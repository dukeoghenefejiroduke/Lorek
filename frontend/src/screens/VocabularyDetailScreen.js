import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import haptics from "../utils/haptics";
import { vocabularyAPI } from '../services/api';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';

export default function VocabularyDetailScreen({ navigation, route }) {
  const { wordId, word: initialWord } = route.params || {};
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in VocabularyDetailScreen.js:', contextValue);
  const { theme, isDarkMode } = contextValue;
  const { activeLanguage } = useContext(LanguageContext);
  const [word, setWord] = useState(initialWord || null);
  const [loading, setLoading] = useState(!initialWord);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (wordId && !initialWord) {
      loadWord();
    }
  }, [wordId]);

  const loadWord = async () => {
    try {
      setLoading(true);
      const response = await vocabularyAPI.getById(wordId);
      setWord(response.data?.data || response.data);
    } catch (error) {
      Alert.alert('Word unavailable', 'Could not load this vocabulary item.');
    } finally {
      setLoading(false);
    }
  };

  const speakWord = () => {
    if (!word?.izonWord) return;
    haptics.impactLight();
    Speech.speak(word.izonWord, { rate: 0.8, pitch: 1 });
  };

  const toggleFavorite = async () => {
    if (!word?._id) return;
    try {
      if (favorite) {
        await vocabularyAPI.removeFromFavorites(word._id);
      } else {
        await vocabularyAPI.addToFavorites(word._id);
      }
      setFavorite(!favorite);
      haptics.notificationSuccess();
    } catch (error) {
      Alert.alert('Favorite not synced', 'Please try again when the server is reachable.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!word) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Word not found</Text>
        <TouchableOpacity style={[styles.backHomeButton, { backgroundColor: theme.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.backHomeText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const examples = Array.isArray(word.examples) ? word.examples : [];
  const related = Array.isArray(word.relatedWords) ? word.relatedWords : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'light-content'} backgroundColor={isDarkMode ? '#000' : theme.headerGradient[1]} />
      <LinearGradient colors={theme.headerGradient} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={toggleFavorite}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.word}>{word.izonWord || `${activeLanguage?.name || 'Izon'} word`}</Text>
        <Text style={styles.translation}>{word.englishTranslation || word.translation || 'Translation unavailable'}</Text>
        <View style={styles.metaRow}>
          {!!word.category && <Text style={[styles.metaChip, { color: theme.primary, backgroundColor: theme.surface }]}>{word.category}</Text>}
          {!!word.partOfSpeech && <Text style={[styles.metaChip, { color: theme.primary, backgroundColor: theme.surface }]}>{word.partOfSpeech}</Text>}
          {!!word.difficulty && <Text style={[styles.metaChip, { color: theme.primary, backgroundColor: theme.surface }]}>{word.difficulty}</Text>}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={[styles.listenCard, { backgroundColor: theme.card }]} onPress={speakWord}>
          <View style={[styles.listenIcon, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="volume-high" size={24} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.listenTitle, { color: theme.text }]}>Listen and repeat</Text>
            <Text style={[styles.listenText, { color: theme.subText }]}>Play the word slowly for pronunciation practice.</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={theme.subText} />
        </TouchableOpacity>

        {!!word.pronunciation?.ipa && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Pronunciation</Text>
            <Text style={[styles.ipa, { backgroundColor: theme.card, color: theme.text }]}>{word.pronunciation.ipa}</Text>
          </View>
        )}

        {examples.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Examples</Text>
            {examples.map((example, index) => (
              <View key={`${example.izon || index}`} style={[styles.exampleCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.exampleIzon, { color: theme.primary }]}>{example.izon || example.text}</Text>
                <Text style={[styles.exampleEnglish, { color: theme.subText }]}>{example.english || example.translation}</Text>
              </View>
            ))}
          </View>
        )}

        {related.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Related Words</Text>
            <View style={styles.relatedWrap}>
              {related.map((item, index) => (
                <Text key={`${item}-${index}`} style={[styles.relatedChip, { backgroundColor: theme.primary + '20', color: theme.primary }]}>{item}</Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('Practice')}>
            <Ionicons name="pencil" size={18} color="#fff" />
            <Text style={styles.actionText}>Practice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary + '20' }]} onPress={() => navigation.navigate('Vocabulary')}>
            <Ionicons name="list" size={18} color={theme.primary} />
            <Text style={[styles.secondaryActionText, { color: theme.primary }]}>More Words</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { paddingTop: Platform.OS === 'ios' ? 58 : 38, paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  word: { color: '#fff', fontSize: 38, fontWeight: '800', marginTop: 28 },
  translation: { color: 'rgba(255,255,255,0.92)', fontSize: 20, marginTop: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  metaChip: { overflow: 'hidden', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  content: { padding: 20, paddingBottom: 36 },
  listenCard: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  listenIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  listenTitle: { fontSize: 16, fontWeight: '700' },
  listenText: { fontSize: 13, marginTop: 3 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  ipa: { borderRadius: 14, padding: 16, fontSize: 18 },
  exampleCard: { borderRadius: 14, padding: 16, marginBottom: 10 },
  exampleIzon: { fontSize: 16, fontWeight: '700' },
  exampleEnglish: { marginTop: 6, fontSize: 14 },
  relatedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  relatedChip: { borderRadius: 12, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 8, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 28 },
  actionButton: { flex: 1, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { color: '#fff', fontWeight: '800' },
  secondaryActionText: { fontWeight: '800' },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 14 },
  backHomeButton: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  backHomeText: { color: '#fff', fontWeight: '700' },
});
