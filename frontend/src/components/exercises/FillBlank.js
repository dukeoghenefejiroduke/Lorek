import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const FillBlank = ({ exercise, onSubmit, disabled }) => {
  const [input, setInput] = useState('');
  const sentenceText = exercise.sentence || exercise.question?.izon || exercise.question?.english || '';

  return (
    <View style={styles.container}>
      <Text style={styles.question}>Complete the sentence:</Text>
      {sentenceText.includes('_____') ? (
        <Text style={styles.sentence}>
          {sentenceText.split('_____').map((part, idx, arr) => (
            <React.Fragment key={idx}>
              {part}
              {idx < arr.length - 1 && (
                <TextInput
                  style={styles.input}
                  placeholder="..."
                  value={input}
                  onChangeText={setInput}
                  autoFocus
                  editable={!disabled}
                />
              )}
            </React.Fragment>
          ))}
        </Text>
      ) : (
        <>
          <Text style={styles.sentence}>{sentenceText}</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Type your answer here..."
            value={input}
            onChangeText={setInput}
            autoFocus
            editable={!disabled}
          />
        </>
      )}
      <TouchableOpacity 
        style={[styles.submitButton, (disabled || !input.trim()) && { opacity: 0.5 }]} 
        onPress={() => onSubmit(input)}
        disabled={disabled || !input.trim()}
      >
        <Text style={styles.submitButtonText}>Check Answer</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  question: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  sentence: { fontSize: 18, lineHeight: 30, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 5, minWidth: 60, fontSize: 18, textAlign: 'center', backgroundColor: '#fff' },
  textInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 15, fontSize: 16, marginBottom: 20, backgroundColor: '#fff' },
  submitButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default FillBlank;
