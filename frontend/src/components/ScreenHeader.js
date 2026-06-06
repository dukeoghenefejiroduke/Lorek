import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';

const ScreenHeader = ({ title, showLanguageSelector = false, onLanguagePress, onBackPress, children }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const { activeLanguage } = useContext(LanguageContext);

  return (
    <LinearGradient
      colors={theme.headerGradient}
      style={[styles.header, { paddingTop: insets.top }]}
    >
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          {onBackPress && (
            <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        
        <View style={styles.headerRight}>
          {showLanguageSelector && (
            <TouchableOpacity 
              style={[styles.languageButton, { backgroundColor: 'rgba(255,255,255,0.14)' }]}
              onPress={onLanguagePress}
            >
              <FontAwesome5 name="language" size={18} color={theme.accent} />
              <Text style={styles.languageButtonText}>
                {activeLanguage?.code || 'IZON'}
              </Text>
            </TouchableOpacity>
          )}
          {children}
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  languageButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default ScreenHeader;
