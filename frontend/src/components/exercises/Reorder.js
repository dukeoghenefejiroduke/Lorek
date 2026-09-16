import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const Reorder = ({ exercise, onSubmit, disabled }) => {
  const [selectedWords, setSelectedWords] = useState([]);
  const [availableWords, setAvailableWords] = useState(exercise.options || []);

  const handleWordPress = (word) => {
    if (disabled) return;
    
    // Move from available to selected
    setAvailableWords(availableWords.filter(w => w !== word));
    setSelectedWords([...selectedWords, word]);
  };

  const handleSelectedPress = (word) => {
    if (disabled) return;
    
    // Move from selected back to available
    setSelectedWords(selectedWords.filter(w => w !== word));
    setAvailableWords([...availableWords, word]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{exercise.question?.izon || exercise.question?.english}</Text>
      
      <View style={styles.selectedArea}>
        {selectedWords.map((word, idx) => (
          <TouchableOpacity key={idx} style={styles.wordChip} onPress={() => handleSelectedPress(word)}>
            <Text style={styles.wordText}>{word}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.availableArea}>
        {availableWords.map((word, idx) => (
          <TouchableOpacity key={idx} style={styles.wordChip} onPress={() => handleWordPress(word)}>
            <Text style={styles.wordText}>{word}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        style={[styles.submitButton, (disabled || selectedWords.length === 0) && { opacity: 0.5 }]} 
        onPress={() => onSubmit(selectedWords)}
        disabled={disabled || selectedWords.length === 0}
      >
        <Text style={styles.submitButtonText}>Check Answer</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  question: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  selectedArea: { flexDirection: 'row', flexWrap: 'wrap', minHeight: 60, padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, marginBottom: 20, backgroundColor: '#f9f9f9' },
  availableArea: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  wordChip: { padding: 10, backgroundColor: '#e0e0e0', borderRadius: 5, margin: 5 },
  wordText: { fontSize: 16 },
  submitButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default Reorder;
