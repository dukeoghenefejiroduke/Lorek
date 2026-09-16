import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const MultipleChoiceRenderer = ({ exercise, onComplete }) => {
  const [selected, setSelected] = useState(null);

  const handleSelect = (option) => {
    setSelected(option);
    const isCorrect = option === exercise.correctAnswer;
    onComplete(isCorrect, option);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{exercise.question}</Text>
      {exercise.options.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.option, selected === option && (option === exercise.correctAnswer ? styles.correct : styles.incorrect)]}
          onPress={() => handleSelect(option)}
          disabled={selected !== null}
        >
          <Text>{option}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  question: { fontSize: 18, marginBottom: 20 },
  option: { padding: 15, backgroundColor: '#f0f0f0', marginBottom: 10, borderRadius: 8 },
  correct: { backgroundColor: '#c8e6c9' },
  incorrect: { backgroundColor: '#ffcdd2' },
});

export default MultipleChoiceRenderer;
