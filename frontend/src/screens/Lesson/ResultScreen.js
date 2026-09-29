import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const ResultScreen = ({ route, navigation }) => {
  const { score, rewards, statistics, feedback, mistakes = [], nextLesson = null } = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1a4c2e', '#43a047']} style={styles.gradient}>
        <Text style={styles.title}>Lesson Complete! 🎉</Text>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreValue}>{score}%</Text>
        </View>

        <View style={styles.rewardsContainer}>
          <Text style={styles.rewardText}>XP Earned: {rewards?.pointsEarned || 0}</Text>
          <Text style={styles.rewardText}>Experience: {rewards?.experienceEarned || 0}</Text>
        </View>

        <View style={styles.feedbackContainer}>
          {(feedback || []).map((f, i) => <Text key={i} style={styles.feedbackText}>• {f}</Text>)}
        </View>

        {mistakes && mistakes.length > 0 && (
          <TouchableOpacity 
            style={[styles.button, styles.reviewButton]} 
            onPress={() => navigation.navigate('ReviewScreen', { mistakes })}
          >
            <MaterialIcons name="rate-review" size={20} color="#1a4c2e" />
            <Text style={styles.reviewButtonText}>Review Mistakes ({mistakes.length})</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => {
            if (nextLesson && nextLesson.id) {
              navigation.replace('LessonDetail', { lessonId: nextLesson.id });
            } else {
              navigation.navigate('Lessons');
            }
          }}
        >
          <Text style={styles.buttonText}>{nextLesson ? 'Next Lesson' : 'Continue'}</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#1a4c2e" />
        </TouchableOpacity>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  scoreContainer: { alignItems: 'center', marginBottom: 20 },
  scoreLabel: { fontSize: 18, color: 'rgba(255,255,255,0.8)' },
  scoreValue: { fontSize: 48, fontWeight: 'bold', color: '#FFD700' },
  rewardsContainer: { alignItems: 'center', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 10, width: '100%' },
  rewardText: { fontSize: 18, color: '#fff', marginVertical: 3 },
  feedbackContainer: { marginBottom: 20, width: '100%', paddingHorizontal: 10 },
  feedbackText: { fontSize: 15, color: '#fff', marginVertical: 3 },
  reviewButton: { backgroundColor: '#FFD700', marginBottom: 15 },
  reviewButtonText: { fontSize: 16, fontWeight: 'bold', color: '#1a4c2e' },
  button: { backgroundColor: '#fff', flexDirection: 'row', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, alignItems: 'center', justifyContent: 'center', gap: 10, width: '80%', marginBottom: 10 },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: '#1a4c2e' },
});

export default ResultScreen;
