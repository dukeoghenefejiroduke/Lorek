import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const MultipleChoice = ({ exercise, onSelect, selectedOption, disabled }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.question}>{exercise.question?.izon || exercise.question?.english}</Text>
      <View style={styles.options}>
        {exercise.options?.map((opt, idx) => (
          <TouchableOpacity 
            key={idx} 
            style={[
              styles.optionButton, 
              selectedOption === (opt.id || idx) && styles.selectedOption
            ]} 
            onPress={() => onSelect(opt.id ?? idx)}
            disabled={disabled}
          >
            <Text style={styles.optionText}>{opt.izon || opt.english}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  question: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  options: { gap: 12 },
  optionButton: { padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fff' },
  selectedOption: { backgroundColor: '#e8f5e9', borderColor: '#4CAF50' },
  optionText: { fontSize: 16 },
});

export default MultipleChoice;
