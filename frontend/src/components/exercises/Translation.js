import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const Translation = ({ exercise, onSubmit, disabled }) => {
  const [input, setInput] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.question}>Translate: {exercise.question?.izon || exercise.question?.english}</Text>
      <TextInput
        style={styles.input}
        placeholder="Type your answer here..."
        value={input}
        onChangeText={setInput}
        multiline
        disabled={disabled}
      />
      <TouchableOpacity 
        style={[styles.submitButton, disabled && { opacity: 0.5 }]} 
        onPress={() => onSubmit(input)}
        disabled={disabled || !input.trim()}
      >
        <Text style={styles.submitButtonText}>Submit</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  question: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 15, fontSize: 16, marginBottom: 20, backgroundColor: '#fff' },
  submitButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default Translation;
