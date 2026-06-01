// components/WordCard.js
import React, { useState, useContext } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Easing
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import AudioPlayer from './AudioPlayer';
import { ThemeContext } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';

export default function WordCard({ 
  word, 
  showPronunciation = true,
  isFirst = false,
  showAudioControls = true,
  compact = false 
}) {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { activeLanguage } = useContext(LanguageContext);
  const [flipped, setFlipped] = useState(false);
  const [showPronunciationGuide, setShowPronunciationGuide] = useState(false);
  const [flipAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));

  const hasPronunciation = showPronunciation && word.pronunciation && (
    word.pronunciation.ipa || word.pronunciation.breakdown
  );

  // ... (animation logic remains the same)
  const handleFlip = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(flipAnim, {
        toValue: flipped ? 0 : 180,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    setFlipped(!flipped);
  };

  const frontAnimatedStyle = {
    transform: [
      { rotateY: flipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ['0deg', '180deg']
      })}
    ],
    opacity: flipAnim.interpolate({
      inputRange: [0, 90, 180],
      outputRange: [1, 0, 0]
    })
  };

  const backAnimatedStyle = {
    transform: [
      { rotateY: flipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ['180deg', '360deg']
      })}
    ],
    opacity: flipAnim.interpolate({
      inputRange: [0, 90, 180],
      outputRange: [0, 0, 1]
    })
  };

  if (compact) {
    return (
      <TouchableOpacity style={[styles.compactCard, { backgroundColor: theme.card }]} onPress={handleFlip}>
        <View style={styles.compactContent}>
          <Text style={[styles.compactWord, { color: theme.primary }]}>{word.izonWord}</Text>
          {!flipped && <Text style={[styles.compactHint, { color: theme.subText }]}>Tap to flip</Text>}
          {flipped && (
            <Text style={[styles.compactTranslation, { color: theme.success }]}>{word.englishTranslation}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={handleFlip}>
      <Animated.View style={[
        styles.card, 
        isFirst && [styles.firstCard, { borderTopColor: theme.primary }],
        { transform: [{ scale: scaleAnim }], backgroundColor: theme.card }
      ]}>
        {/* Front side (Izon word) */}
        <Animated.View style={[styles.cardSide, frontAnimatedStyle, styles.cardFront]}>
          <View style={styles.cardContent}>
            <View style={styles.wordHeader}>
              <Text style={[styles.mainWord, { color: theme.primary }]}>{word.izonWord}</Text>
              {word.difficulty && (
                <View style={[
                  styles.difficultyBadge,
                  { backgroundColor: getDifficultyColor(word.difficulty) }
                ]}>
                  <Text style={styles.difficultyText}>
                    {getDifficultyIcon(word.difficulty)} {word.difficulty}
                  </Text>
                </View>
              )}
            </View>

            {hasPronunciation && (
              <View style={styles.pronunciationSection}>
                {word.pronunciation?.ipa && (
                  <View style={[styles.ipaContainer, { backgroundColor: theme.background }]}>
                    <Text style={[styles.ipaLabel, { color: theme.subText, backgroundColor: theme.border }]}>IPA</Text>
                    <Text style={[styles.ipaText, { color: theme.text }]}>{word.pronunciation.ipa}</Text>
                  </View>
                )}
                <TouchableOpacity 
                  style={[styles.pronunciationButton, { backgroundColor: `${theme.primary}20`, borderColor: `${theme.primary}40` }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowPronunciationGuide(!showPronunciationGuide);
                  }}
                >
                  <Icon name="volume-up" size={16} color={theme.primary} />
                  <Text style={[styles.pronunciationButtonText, { color: theme.primary }]}>
                    {showPronunciationGuide ? 'Hide Guide' : 'Show Guide'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {showPronunciationGuide && hasPronunciation && word.pronunciation?.breakdown && (
              <View style={[styles.pronunciationGuide, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.breakdownTitle, { color: theme.text }]}>Sound Breakdown</Text>
                <View style={styles.soundsGrid}>
                  {word.pronunciation.breakdown.map((sound, index) => (
                    <View key={index} style={[styles.soundItem, { backgroundColor: theme.card }]}>
                      <View style={styles.soundCharContainer}>
                        <Text style={[styles.soundChar, { color: theme.primary }]}>{sound.char}</Text>
                        <Text style={[
                          styles.soundType,
                          { backgroundColor: sound.type === 'vowel' ? theme.success : theme.secondary }
                        ]}>
                          {sound.type === 'vowel' ? 'V' : 'C'}
                        </Text>
                      </View>
                      <Text style={[styles.soundDesc, { color: theme.subText }]} numberOfLines={2}>
                        {sound.sound}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {showAudioControls && word.audioUrl && (
              <View style={styles.audioContainer}>
                <AudioPlayer audioUrl={word.audioUrl} word={word.izonWord} compact={true} />
              </View>
            )}

            <View style={styles.flipHint}>
              <Icon name="flip" size={16} color={theme.subText} />
              <Text style={[styles.hint, { color: theme.subText }]}>Tap to see translation</Text>
            </View>
          </View>
        </Animated.View>

        {/* Back side (Translation) */}
        <Animated.View style={[styles.cardSide, backAnimatedStyle, styles.cardBack]}>
          <View style={styles.cardContent}>
            <Text style={[styles.translation, { color: theme.success }]}>{word.englishTranslation}</Text>
            
            {word.category && (
              <View style={styles.categoryContainer}>
                <Icon name="category" size={16} color={theme.subText} />
                <Text style={[styles.category, { color: theme.subText }]}>
                  {word.category.charAt(0).toUpperCase() + word.category.slice(1)}
                </Text>
              </View>
            )}
            
            {word.examples && word.examples[0] && (
              <View style={[styles.exampleContainer, { backgroundColor: theme.background }]}>
                <Text style={[styles.exampleLabel, { color: theme.subText }]}>Example:</Text>
                <Text style={[styles.exampleText, { color: theme.text }]}>{word.examples[0].izon}</Text>
                <Text style={[styles.exampleTranslation, { color: theme.subText }]}>
                  "{word.examples[0].english}"
                </Text>
              </View>
            )}

            <View style={styles.additionalInfo}>
              {word.partOfSpeech && (
                <View style={[styles.infoBadge, { backgroundColor: `${theme.primary}20` }]}>
                  <Text style={[styles.infoBadgeText, { color: theme.primary }]}>{word.partOfSpeech}</Text>
                </View>
              )}
              {word.frequency && (
                <View style={[styles.infoBadge, { backgroundColor: `${theme.primary}20` }]}>
                  <Text style={[styles.infoBadgeText, { color: theme.primary }]}>{word.frequency}</Text>
                </View>
              )}
            </View>

            <View style={styles.flipHint}>
              <Icon name="flip" size={16} color={theme.subText} />
              <Text style={[styles.hint, { color: theme.subText }]}>Tap to see {activeLanguage?.name || 'Izon'} word</Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
// ... (helper functions and styles)


function getDifficultyColor(difficulty) {
  const normalized = difficulty?.toLowerCase();
  switch (normalized) {
    case 'beginner': return '#4CAF50';
    case 'intermediate': return '#FF9800';
    case 'advanced': return '#F44336';
    default: return '#9E9E9E';
  }
}

function getDifficultyIcon(difficulty) {
  const normalized = difficulty?.toLowerCase();
  switch (normalized) {
    case 'beginner': return '🌱';
    case 'intermediate': return '📚';
    case 'advanced': return '🎓';
    default: return '📘';
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 200,
    overflow: 'hidden',
  },
  firstCard: {
    marginTop: 5,
    borderTopWidth: 4,
    borderTopColor: '#1a73e8',
  },
  compactCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    minWidth: 100,
  },
  compactContent: {
    alignItems: 'center',
  },
  compactWord: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  compactHint: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  compactTranslation: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    textAlign: 'center',
  },
  cardSide: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    padding: 20,
  },
  cardBack: {
    padding: 20,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  mainWord: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a73e8',
    flex: 1,
    marginRight: 10,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  difficultyText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  pronunciationSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  ipaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  ipaLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginRight: 6,
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ipaText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#333',
    fontStyle: 'italic',
    flex: 1,
  },
  pronunciationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  pronunciationButtonText: {
    color: '#1976D2',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  pronunciationGuide: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  soundsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  soundItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    width: 65,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  soundCharContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  soundChar: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginRight: 4,
  },
  soundType: {
    fontSize: 9,
    color: '#fff',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    fontWeight: 'bold',
  },
  soundDesc: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    lineHeight: 12,
  },
  audioContainer: {
    marginBottom: 15,
  },
  translation: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 20,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  exampleContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  exampleLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  exampleText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
    fontWeight: '500',
  },
  exampleTranslation: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  additionalInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  infoBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  infoBadgeText: {
    fontSize: 11,
    color: '#1976D2',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  hint: {
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
  },
});
