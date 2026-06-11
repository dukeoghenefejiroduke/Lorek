import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, ScrollView } from 'react-native';

const KeyboardAvoidingWrapper = ({ children, style, scroll = true, scrollProps = {}, ...props }) => {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, scrollProps.contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, style]}
      {...props}
    >
      {content}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default KeyboardAvoidingWrapper;
