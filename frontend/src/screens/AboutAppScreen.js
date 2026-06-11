import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useEffect, useRef, useContext } from 'react';

import { ThemeContext } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';
import {
  ScrollView,
  Text,
  StyleSheet,
  View,
  Image,
  Animated,
  Dimensions,
  TouchableOpacity,
  Linking,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function AboutAppScreen() {
  const { activeLanguage } = useContext(LanguageContext);
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Rotate animation for cultural pattern
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#1a4c2e');
    }

    // Parallel animations for smooth entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 20000,
          useNativeDriver: true,
        })
      ),
    ]).start();
  }, []);

  const openLink = (url) => {
    Linking.openURL(url).catch((err) => 
      console.error('Could not open link', err)
    );
  };

  const TeamMember = ({ name, role, icon }) => (
    <Animated.View style={[styles.teamMember, { opacity: fadeAnim }]}>
      <View style={styles.memberIcon}>
        <FontAwesome5 name={icon} size={24} color="#4CAF50" />
      </View>
      <View>
        <Text style={styles.memberName}>{name}</Text>
        <Text style={styles.memberRole}>{role}</Text>
      </View>
    </Animated.View>
  );

  const StatCard = ({ number, label, icon }) => (
    <View style={styles.statCard}>
      <MaterialIcons name={icon} size={32} color="#4CAF50" />
      <Text style={styles.statNumber}>{number}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const FeaturePill = ({ text }) => (
    <View style={styles.featurePill}>
      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
      <Text style={styles.featurePillText}>{text}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Animated Background Pattern */}
      <Animated.View style={[styles.backgroundPattern, { transform: [{ rotate: spin }] }]}>
        <Text style={styles.patternText}>⚡ 𖦹 🔱 ⚡ 𖦹 🔱</Text>
      </Animated.View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header with Gradient */}
        <LinearGradient
          colors={['#1a4c2e', '#2e7d32', '#43a047']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Animated.View style={[
            styles.headerContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}>
            <View style={styles.iconContainer}>
              <FontAwesome5 name="language" size={50} color="#FFD700" />
            </View>
            <Text style={styles.appName}>Lorek App</Text>
            <View style={styles.badgeContainer}>
              <View style={styles.betaBadge}>
                <Text style={styles.betaText}>BETA</Text>
              </View>
              <Text style={styles.version}>Version 1.0.4</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* Main Content */}
        <Animated.View style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          {/* Mission Statement */}
          <View style={styles.missionCard}>
            <Text style={styles.missionTitle}>Our Mission</Text>
            <Text style={styles.missionText}>
              Preserving the rich {activeLanguage?.name || 'Izon'} heritage through innovative technology. 
              We're on a mission to make the {activeLanguage?.name || 'Izon'} language accessible to the new 
              generation of speakers, connecting them with their roots wherever 
              they are in the world.
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard number="50K+" label="Learners" icon="people" />
            <StatCard number="1000+" label="Words" icon="menu-book" />
            <StatCard number="24/7" label="Support" icon="support-agent" />
            <StatCard number="4.8★" label="Rating" icon="star" />
          </View>

          {/* Key Features */}
          <View style={styles.featuresContainer}>
            <Text style={styles.sectionTitle}>Key Features</Text>
            <View style={styles.featuresGrid}>
              <FeaturePill text="Audio Pronunciations" />
              <FeaturePill text="Offline Access" />
              <FeaturePill text="Cultural Notes" />
              <FeaturePill text="Progress Tracking" />
              <FeaturePill text="Daily Lessons" />
              <FeaturePill text="Community Forum" />
            </View>
          </View>

          {/* Cultural Heritage */}
          <View style={styles.culturalCard}>
            <FontAwesome5 name="globe" size={40} color="#FFD700" />
            <Text style={styles.culturalTitle}>Rooted in Tradition</Text>
            <Text style={styles.culturalText}>
              Every word, phrase, and lesson is reviewed by native {activeLanguage?.name || 'Izon'} speakers 
              and cultural elders from the Niger Delta region.
            </Text>
          </View>

          {/* Team Section */}
          <View style={styles.teamSection}>
            <Text style={styles.sectionTitle}>The Team</Text>
            <TeamMember 
              name="Dr. Tamuno Williams" 
              role="Linguistic Lead" 
              icon="user-graduate" 
            />
            <TeamMember 
              name="Ebiere Okoro" 
              role="Cultural Advisor" 
              icon="feather" 
            />
            <TeamMember 
              name="Dumo Peters" 
              role="Lead Developer" 
              icon="laptop-code" 
            />
          </View>

          {/* Location Badge */}
          <TouchableOpacity 
            style={styles.locationCard}
            onPress={() => openLink('https://maps.app.goo.gl/...')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="location-on" size={24} color="#FF6B6B" />
            <View style={styles.locationText}>
              <Text style={styles.locationTitle}>Built with ❤️ in</Text>
              <Text style={styles.locationSubtitle}>Otuoke, Bayelsa State</Text>
              <Text style={styles.locationDetail}>Niger Delta, Nigeria</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          {/* Social Links */}
          <View style={styles.socialContainer}>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://twitter.com/izonapp')}
            >
              <FontAwesome5 name="twitter" size={24} color="#1DA1F2" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://facebook.com/izonapp')}
            >
              <FontAwesome5 name="facebook" size={24} color="#4267B2" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://instagram.com/izonapp')}
            >
              <FontAwesome5 name="instagram" size={24} color="#E4405F" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://github.com/izonapp')}
            >
              <FontAwesome5 name="github" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © 2024 Lorek App. All rights reserved.
            </Text>
            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={() => openLink('https://izon.app/privacy')}>
                <Text style={styles.footerLink}>Privacy</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity onPress={() => openLink('https://izon.app/terms')}>
                <Text style={styles.footerLink}>Terms</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity onPress={() => openLink('https://izon.app/contact')}>
                <Text style={styles.footerLink}>Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.1,
  },
  patternText: {
    fontSize: 40,
    color: '#1a4c2e',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  headerContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  betaBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 10,
  },
  betaText: {
    color: '#1a4c2e',
    fontWeight: 'bold',
    fontSize: 12,
  },
  version: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  content: {
    padding: 20,
    marginTop: -30,
  },
  missionCard: {
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
  },
  missionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a4c2e',
    marginBottom: 12,
  },
  missionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: (width - 50) / 2,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a4c2e',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a4c2e',
    marginBottom: 15,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  featurePillText: {
    color: '#1a4c2e',
    marginLeft: 6,
    fontSize: 14,
  },
  culturalCard: {
    backgroundColor: '#1a4c2e',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  culturalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 12,
    marginBottom: 8,
  },
  culturalText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
  },
  teamSection: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  teamMember: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 14,
    marginTop: 2,
  },
  locationCard: {
    borderRadius: 15,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  locationText: {
    flex: 1,
    marginLeft: 15,
  },
  locationTitle: {
    fontSize: 14,
    color: '#666',
  },
  locationSubtitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  locationDetail: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8,
  },
  footerDot: {
    fontSize: 12,
  },
});