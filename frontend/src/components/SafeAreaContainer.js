import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SafeAreaContainer = ({ children, style, backgroundColor, edges }) => {
  return (
    <SafeAreaView style={[styles.container, style, { backgroundColor }]} edges={edges}>
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SafeAreaContainer;
