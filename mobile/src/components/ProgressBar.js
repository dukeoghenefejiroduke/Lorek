// components/ProgressBar.js
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export default function ProgressBar({ 
  progress, 
  height = 8, 
  color = '#4CAF50', 
  animated = true,
  showLabel = false,
  label 
}) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: Math.min(progress, 100),
        duration: 500,
        useNativeDriver: false,
      }).start();
    } else {
      animatedWidth.setValue(Math.min(progress, 100));
    }
  }, [progress, animated]);

  const width = animated ? animatedWidth : Math.min(progress, 100);

  return (
    <View style={styles.container}>
      {showLabel && label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.barContainer, { height }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: width.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: color,
              height,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={styles.percentage}>{Math.round(progress)}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barContainer: {
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  percentage: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 4,
    textAlign: 'right',
  },
});