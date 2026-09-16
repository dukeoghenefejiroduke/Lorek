import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const Matching = ({ exercise, onSubmit, disabled }) => {
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matches, setMatches] = useState({});

  const handleMatch = (leftId, rightId) => {
    if (disabled) return;
    
    // In a real implementation, this would handle complex matching logic
    // For now, it pairs selected items and submits when all are matched
    const newMatches = { ...matches, [leftId]: rightId };
    setMatches(newMatches);

    // Simple submission check
    if (Object.keys(newMatches).length === exercise.matchingPairs.length) {
        onSubmit(newMatches);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.question}>Match the pairs:</Text>
      <View style={styles.matchingContainer}>
        <View style={styles.column}>
          {exercise.matchingPairs?.map((pair) => (
            <TouchableOpacity 
              key={pair.left.id} 
              style={[styles.item, selectedLeft === pair.left.id && styles.selected]}
              onPress={() => setSelectedLeft(pair.left.id)}
            >
              <Text>{pair.left.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.column}>
          {exercise.matchingPairs?.map((pair) => (
            <TouchableOpacity 
              key={pair.right.id} 
              style={styles.item}
              onPress={() => selectedLeft && handleMatch(selectedLeft, pair.right.id)}
            >
              <Text>{pair.right.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  question: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  matchingContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  column: { flex: 1, gap: 10 },
  item: { padding: 15, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, backgroundColor: '#fff' },
  selected: { borderColor: '#4CAF50', backgroundColor: '#e8f5e9' },
});

export default Matching;
