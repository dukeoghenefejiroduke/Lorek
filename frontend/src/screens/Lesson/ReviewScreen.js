import React, { useContext } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { ThemeContext } from '../../context/ThemeContext';
import ScreenHeader from '../../components/ScreenHeader';

const ReviewScreen = ({ navigation, route }) => {
  const { mistakes } = route.params || { mistakes: [] };
  const { theme } = useContext(ThemeContext);

  const renderMistakeItem = ({ item }) => (
    <View style={[styles.mistakeCard, { backgroundColor: theme.card }]}>
      <Text style={[styles.question, { color: theme.text }]}>{item.question}</Text>
      <Text style={[styles.correctAnswer, { color: theme.success }]}>Correct: {item.correctAnswer}</Text>
      <Text style={[styles.explanation, { color: theme.subText }]}>{item.explanation}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Review Mistakes" onBackPress={() => navigation.goBack()} />
      <FlatList
        data={mistakes}
        renderItem={renderMistakeItem}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: theme.subText }}>No mistakes to review!</Text>}
      />
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate('Lessons')}
      >
        <Text style={styles.buttonText}>Back to Lessons</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 20 },
  mistakeCard: { padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
  question: { fontSize: 16, fontWeight: 'bold' },
  correctAnswer: { fontSize: 14, marginTop: 5 },
  explanation: { fontSize: 14, marginTop: 5 },
  button: { padding: 20, margin: 20, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default ReviewScreen;
