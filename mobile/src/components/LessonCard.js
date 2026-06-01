// components/LessonCard.js
import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import ProgressBar from './ProgressBar';
import { ThemeContext } from '../context/ThemeContext';

export default function LessonCard({ lesson, onPress, progress = 0, compact = false }) {
  const { theme } = useContext(ThemeContext);

  const getLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FF9800';
      case 'advanced': return '#F44336';
      default: return '#1a73e8';
    }
  };

  const getLevelIcon = (level) => {
    switch (level?.toLowerCase()) {
      case 'beginner': return '🌱';
      case 'intermediate': return '📚';
      case 'advanced': return '🎓';
      default: return '📘';
    }
  };

  if (compact) {
    return (
      <TouchableOpacity style={[styles.compactCard, { backgroundColor: theme.card }]} onPress={onPress}>
        <View style={styles.compactHeader}>
          <Text style={[styles.compactTitle, { color: theme.text }]} numberOfLines={1}>
            {lesson.title?.english || lesson.title}
          </Text>
          <View style={[styles.compactBadge, { backgroundColor: getLevelColor(lesson.level) }]}>
            <Text style={styles.compactBadgeText}>
              {getLevelIcon(lesson.level)} {lesson.level}
            </Text>
          </View>
        </View>
        {progress > 0 && (
          <ProgressBar progress={progress} height={4} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: theme.card }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.text }]}>{lesson.title?.english || lesson.title}</Text>
          {lesson.isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newText}>NEW</Text>
            </View>
          )}
        </View>
        <View style={[styles.levelBadge, { backgroundColor: getLevelColor(lesson.level) + '20' }]}>
          <Text style={[styles.levelText, { color: getLevelColor(lesson.level) }]}>
            {getLevelIcon(lesson.level)} {lesson.level}
          </Text>
        </View>
      </View>

      <Text style={[styles.description, { color: theme.subText }]} numberOfLines={2}>
        {lesson.description?.english || lesson.description}
      </Text>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Icon name="schedule" size={16} color={theme.subText} />
          <Text style={[styles.statText, { color: theme.subText }]}>
            {lesson.estimatedTime?.minutes || 15} min
          </Text>
        </View>
        <View style={styles.stat}>
          <Icon name="menu-book" size={16} color={theme.subText} />
          <Text style={[styles.statText, { color: theme.subText }]}>
            {lesson.content?.vocabulary?.length || 0} words
          </Text>
        </View>
        {lesson.rewards?.basePoints && (
          <View style={styles.stat}>
            <Icon name="stars" size={16} color={theme.accent} />
            <Text style={[styles.statText, { color: theme.subText }]}>{lesson.rewards.basePoints} XP</Text>
          </View>
        )}
      </View>

      {progress > 0 && (
        <View style={styles.progressSection}>
          <ProgressBar progress={progress} height={6} />
          <Text style={[styles.progressText, { color: theme.primary }]}>{Math.round(progress)}% Complete</Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.badges}>
          {lesson.rewards?.badges?.map((badge, idx) => (
            <View key={idx} style={[styles.badgeIcon, { backgroundColor: theme.background }]}>
              <Text>{badge.icon}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.startText, { color: theme.secondary }]}>
          {progress > 0 ? 'Continue →' : 'Start →'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  compactCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  compactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  compactBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  newBadge: {
    backgroundColor: '#f44336',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressText: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  badgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});
