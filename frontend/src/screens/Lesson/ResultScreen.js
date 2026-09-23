import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const ResultScreen = ({ route, navigation }) => {
  const { score, rewards, statistics, feedback } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1a4c2e', '#43a047']} style={styles.gradient}>
        <Text style={styles.title}>Lesson Complete! 🎉</Text>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreValue}>{score}%</Text>
        </View>

        <View style={styles.rewardsContainer}>
          <Text style={styles.rewardText}>XP Earned: {rewards.pointsEarned}</Text>
          <Text style={styles.rewardText}>Experience: {rewards.experienceEarned}</Text>
        </View>

        <View style={styles.feedbackContainer}>
          {feedback.map((f, i) => <Text key={i} style={styles.feedbackText}>• {f}</Text>)}
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => navigation.navigate('Lessons')}
        >
          <Text style={styles.buttonText}>Continue</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#1a4c2e" />
        </TouchableOpacity>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 30 },
  scoreContainer: { alignItems: 'center', marginBottom: 30 },
  scoreLabel: { fontSize: 18, color: 'rgba(255,255,255,0.8)' },
  scoreValue: { fontSize: 48, fontWeight: 'bold', color: '#FFD700' },
  rewardsContainer: { alignItems: 'center', marginBottom: 30, backgroundColor: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 10 },
  rewardText: { fontSize: 18, color: '#fff', marginVertical: 5 },
  feedbackContainer: { marginBottom: 30 },
  feedbackText: { fontSize: 16, color: '#fff', marginVertical: 5 },
  button: { backgroundColor: '#fff', flexDirection: 'row', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30, alignItems: 'center', gap: 10 },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: '#1a4c2e' },
});

export default ResultScreen;
