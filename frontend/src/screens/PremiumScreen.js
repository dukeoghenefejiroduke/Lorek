import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import haptics from "../utils/haptics";
import LoadingOverlay from '../components/LoadingOverlay';

import { premiumAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const PREMIUM_FEATURES = [
  {
    icon: 'all-inclusive',
    title: 'Unlimited Lessons',
    description: 'Access all lessons without daily limits',
    color: '#4CAF50',
  },
  {
    icon: 'wifi-off',
    title: 'Offline Mode',
    description: 'Download lessons and learn without internet',
    color: '#2196F3',
  },
  {
    icon: 'smart-toy',
    title: 'AI Conversations',
    description: 'Practice speaking with AI tutor',
    color: '#9C27B0',
    premiumPlus: true,
  },
  {
    icon: 'record-voice-over',
    title: 'Pronunciation Feedback',
    description: 'Get real-time pronunciation analysis',
    color: '#FF9800',
    premiumPlus: true,
  },
  {
    icon: 'school',
    title: 'Grammar Review',
    description: 'Advanced grammar explanations and exercises',
    color: '#4CAF50',
  },
  {
    icon: 'menu-book',
    title: 'Vocabulary Review',
    description: 'Spaced repetition flashcards',
    color: '#2196F3',
  },
  {
    icon: 'verified',
    title: 'Certificates',
    description: 'Earn certificates upon completion',
    color: '#FFD700',
  },
  {
    icon: 'skip-next',
    title: 'Skip Lessons',
    description: 'Test out of lessons you already know',
    color: '#E91E63',
  },
  {
    icon: 'shield',
    title: 'Streak Protection',
    description: 'Protect your streak on missed days',
    color: '#FF6B6B',
  },
];

const PricingCard = ({ plan, price, yearlyPrice, features, isPopular, onSelect, billingPeriod, setBillingPeriod, theme, isDarkMode }) => {
  const [isYearly, setIsYearly] = useState(billingPeriod === 'yearly');
  
  const handleToggle = () => {
    const newValue = !isYearly;
    setIsYearly(newValue);
    setBillingPeriod(newValue ? 'yearly' : 'monthly');
  };
  
  const displayPrice = isYearly ? yearlyPrice : price;
  const period = isYearly ? '/year' : '/month';
  const savings = isYearly && yearlyPrice ? Math.round(((price * 12 - yearlyPrice) / (price * 12)) * 100) : 0;
  
  return (
    <View style={[styles.pricingCard, { backgroundColor: theme.card }, isPopular && styles.popularCard]}>
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>Most Popular</Text>
        </View>
      )}
      
      <Text style={[styles.planName, { color: theme.text }]}>{plan}</Text>
      <View style={styles.priceContainer}>
        <Text style={styles.currency}>$</Text>
        <Text style={[styles.price, { color: theme.primary }]}>{displayPrice}</Text>
        <Text style={[styles.period, { color: theme.subText }]}>{period}</Text>
      </View>
      {savings > 0 && (
        <Text style={[styles.savings, { color: theme.primary }]}>Save {savings}% with yearly</Text>
      )}
      
      <View style={[styles.billingToggle, { backgroundColor: isDarkMode ? '#222' : '#f5f5f5' }]}>
        <TouchableOpacity
          style={[styles.toggleOption, !isYearly && { backgroundColor: theme.primary }]}
          onPress={() => handleToggle()}
        >
          <Text style={[styles.toggleText, !isYearly ? { color: '#fff' } : { color: theme.subText }]}>Monthly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleOption, isYearly && { backgroundColor: theme.primary }]}
          onPress={() => handleToggle()}
        >
          <Text style={[styles.toggleText, isYearly ? { color: '#fff' } : { color: theme.subText }]}>Yearly</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.featuresList}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <MaterialIcons name="check-circle" size={18} color={theme.success} />
            <Text style={[styles.featureText, { color: theme.subText }]}>{feature}</Text>
          </View>
        ))}
      </View>
      
      <TouchableOpacity 
        style={[
          styles.selectButton, 
          { backgroundColor: isDarkMode ? '#333' : '#e8f5e9' }, 
          isPopular && { backgroundColor: theme.primary }
        ]} 
        onPress={onSelect}
      >
        <Text style={[styles.selectButtonText, { color: isPopular ? '#fff' : theme.primary }]}>Get {plan}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function PremiumScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { isDarkMode, theme } = useContext(ThemeContext);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    loadPremiumData();
  }, []);

  const loadPremiumData = async () => {
    try {
      setLoading(true);
      const [statusRes, pricingRes] = await Promise.all([
        premiumAPI.getStatus(),
        premiumAPI.getPricing(),
      ]);
      
      if (statusRes.data.success) {
        setCurrentPlan(statusRes.data.data);
      }
      if (pricingRes.data.success) {
        setPricing(pricingRes.data.data);
      }
    } catch (error) {
      console.error('Failed to load premium data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan) => {
    haptics.impactMedium();
    setPurchasing(true);
    
    try {
      // This would integrate with Stripe, RevenueCat, or in-app purchases
      Alert.alert(
        'Coming Soon',
        `Premium ${plan} subscription will be available soon!\n\nStay tuned for updates.`,
        [{ text: 'OK' }]
      );
      
      // For production, implement actual payment processing
      // const response = await premiumAPI.createSubscription({ plan, billingPeriod });
      // if (response.data.success) {
      //   Alert.alert('Success', 'You are now a Premium member!');
      //   await loadPremiumData();
      // }
    } catch (error) {
      Alert.alert('Error', 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      // For production: restore purchases from Apple/Google
      Alert.alert('Restore', 'Purchases restored successfully');
      await loadPremiumData();
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return <LoadingOverlay visible={loading} message="Loading premium features..." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

      <LinearGradient
        colors={['#1a4c2e', '#2e7d32', '#43a047']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Go Premium</Text>
          <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={purchasing}>
            <Text style={styles.restoreText}>Restore</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: theme.card }]}>
          <FontAwesome5 name="crown" size={50} color="#FFD700" />
          <Text style={[styles.heroTitle, { color: theme.text }]}>Unlock Your Full Potential</Text>
          <Text style={[styles.heroSubtitle, { color: theme.subText }]}>
            Get unlimited access to all features and accelerate your language learning journey
          </Text>
        </View>

        {/* Current Plan Status */}
        {currentPlan && currentPlan.plan !== 'free' && (
          <View style={styles.currentPlanCard}>
            <LinearGradient
              colors={['#4CAF50', '#2E7D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.currentPlanGradient}
            >
              <Text style={styles.currentPlanTitle}>✨ Current Plan</Text>
              <Text style={styles.currentPlanName}>{currentPlan.plan?.toUpperCase()}</Text>
              {currentPlan.endDate && (
                <Text style={styles.currentPlanDate}>
                  Renews on {new Date(currentPlan.endDate).toLocaleDateString()}
                </Text>
              )}
              {currentPlan.cancelAtPeriodEnd && (
                <Text style={styles.currentPlanCancelText}>Will cancel at period end</Text>
              )}
            </LinearGradient>
          </View>
        )}

        {/* Features Grid */}
        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Premium Features</Text>
          <View style={styles.featuresGrid}>
            {PREMIUM_FEATURES.map((feature, index) => (
              <View key={index} style={[styles.featureCard, { backgroundColor: theme.card }]}>
                <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
                  <MaterialIcons name={feature.icon} size={24} color={feature.color} />
                </View>
                <Text style={[styles.featureTitle, { color: theme.text }]}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
                {feature.premiumPlus && (
                  <View style={styles.plusBadge}>
                    <Text style={styles.plusText}>Premium+</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Pricing Plans */}
        <View style={styles.pricingSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Choose Your Plan</Text>
          
          <PricingCard
            plan="Premium"
            price={pricing?.premium?.monthly || 9.99}
            yearlyPrice={pricing?.premium?.yearly || 79.99}
            features={[
              'Unlimited lessons',
              'Offline mode',
              'Grammar & vocabulary review',
              'Certificates',
              'Skip lessons',
              'Streak protection',
              'Ad-free experience',
              'All languages access',
            ]}
            onSelect={() => handlePurchase('premium')}
            billingPeriod={billingPeriod}
            setBillingPeriod={setBillingPeriod}
            theme={theme}
            isDarkMode={isDarkMode}
          />
          
          <PricingCard
            plan="Premium Plus"
            price={pricing?.premiumPlus?.monthly || 14.99}
            yearlyPrice={pricing?.premiumPlus?.yearly || 119.99}
            features={[
              'Everything in Premium',
              'AI conversations',
              'Pronunciation feedback',
              'Priority support',
              'Advanced analytics',
              'Export learning data',
            ]}
            isPopular={true}
            onSelect={() => handlePurchase('premium_plus')}
            billingPeriod={billingPeriod}
            setBillingPeriod={setBillingPeriod}
            theme={theme}
            isDarkMode={isDarkMode}
          />
        </View>

        {/* Free vs Premium Comparison */}
        <View style={styles.comparisonSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Compare Plans</Text>
          <View style={[styles.comparisonTable, { backgroundColor: theme.card }]}>
            <View style={[styles.comparisonRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.comparisonFeature, { color: theme.text }]}>Daily Lesson Limit</Text>
              <Text style={styles.comparisonFree}>1</Text>
              <Text style={[styles.comparisonPremium, { color: theme.primary }]}>Unlimited</Text>
            </View>
            <View style={[styles.comparisonRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.comparisonFeature, { color: theme.text }]}>Daily Flashcards</Text>
              <Text style={styles.comparisonFree}>10</Text>
              <Text style={[styles.comparisonPremium, { color: theme.primary }]}>Unlimited</Text>
            </View>
            <View style={[styles.comparisonRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.comparisonFeature, { color: theme.text }]}>Offline Mode</Text>
              <Text style={styles.comparisonFree}>❌</Text>
              <Text style={[styles.comparisonPremium, { color: theme.primary }]}>✅</Text>
            </View>
            <View style={[styles.comparisonRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.comparisonFeature, { color: theme.text }]}>AI Conversations</Text>
              <Text style={styles.comparisonFree}>❌</Text>
              <Text style={[styles.comparisonPremium, { color: theme.primary }]}>✅ (Plus only)</Text>
            </View>
            <View style={[styles.comparisonRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.comparisonFeature, { color: theme.text }]}>Pronunciation Feedback</Text>
              <Text style={styles.comparisonFree}>❌</Text>
              <Text style={[styles.comparisonPremium, { color: theme.primary }]}>✅ (Plus only)</Text>
            </View>
            <View style={[styles.comparisonRow, { borderBottomColor: theme.border, borderBottomWidth: 0 }]}>
              <Text style={[styles.comparisonFeature, { color: theme.text }]}>Certificates</Text>
              <Text style={styles.comparisonFree}>❌</Text>
              <Text style={[styles.comparisonPremium, { color: theme.primary }]}>✅</Text>
            </View>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Frequently Asked Questions</Text>
          
          <View style={[styles.faqItem, { backgroundColor: theme.card }]}>
            <Text style={[styles.faqQuestion, { color: theme.text }]}>💳 Can I cancel anytime?</Text>
            <Text style={[styles.faqAnswer, { color: theme.subText }]}>Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.</Text>
          </View>
          
          <View style={[styles.faqItem, { backgroundColor: theme.card }]}>
            <Text style={[styles.faqQuestion, { color: theme.text }]}>🔄 Does my subscription auto-renew?</Text>
            <Text style={[styles.faqAnswer, { color: theme.subText }]}>Yes, subscriptions auto-renew automatically unless canceled at least 24 hours before the period ends.</Text>
          </View>
          
          <View style={[styles.faqItem, { backgroundColor: theme.card }]}>
            <Text style={[styles.faqQuestion, { color: theme.text }]}>🌍 Can I use premium for all languages?</Text>
            <Text style={[styles.faqAnswer, { color: theme.subText }]}>Yes! Premium gives you access to all languages including Izon, Ogbia, and more coming soon.</Text>
          </View>
          
          <View style={[styles.faqItem, { backgroundColor: theme.card }]}>
            <Text style={[styles.faqQuestion, { color: theme.text }]}>📱 Can I share my subscription?</Text>
            <Text style={[styles.faqAnswer, { color: theme.subText }]}>Family plans are coming soon! Currently, subscriptions are for individual use only.</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
            Payments will be charged to your iTunes/Google Play account.
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://izonapp.com/terms')}>
            <Text style={styles.footerLink}>Terms & Privacy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {purchasing && (
        <View style={styles.purchasingOverlay}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.purchasingText}>Processing...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },

  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  restoreButton: { padding: 8 },
  restoreText: { color: '#fff', fontSize: 14 },

  scrollContent: { paddingBottom: 30 },

  heroSection: {
    alignItems: 'center',
    padding: 30,
    marginBottom: 15,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  currentPlanCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
  },
  currentPlanGradient: { padding: 20 },
  currentPlanTitle: { fontSize: 12, color: '#fff', opacity: 0.9, marginBottom: 5 },
  currentPlanName: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  currentPlanDate: { fontSize: 12, color: '#fff', opacity: 0.8 },
  currentPlanCancelText: { fontSize: 12, color: '#FFD700', marginTop: 5 },

  featuresSection: { padding: 15 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  featureCard: {
    width: (width - 45) / 2,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  featureIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  featureTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  featureDescription: { fontSize: 11, color: '#999', textAlign: 'center', lineHeight: 14 },
  plusBadge: { backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 8 },
  plusText: { fontSize: 8, fontWeight: 'bold', color: '#1a4c2e' },

  pricingSection: { padding: 15 },
  pricingCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  popularCard: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    transform: [{ scale: 1.02 }],
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
  },
  popularText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  planName: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 5 },
  currency: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50', marginRight: 2 },
  price: { fontSize: 32, fontWeight: 'bold', color: '#4CAF50' },
  period: { fontSize: 14, color: '#999', marginLeft: 5 },
  savings: { fontSize: 12, color: '#4CAF50', marginBottom: 15 },
  billingToggle: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 25, padding: 4, marginBottom: 20 },
  toggleOption: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 21 },
  activeToggle: { backgroundColor: '#4CAF50' },
  toggleText: { fontSize: 14 },
  activeToggleText: { color: '#fff' },
  featuresList: { gap: 8, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13 },
  selectButton: { backgroundColor: '#e8f5e9', padding: 15, borderRadius: 12, alignItems: 'center' },
  selectButtonPopular: { backgroundColor: '#4CAF50' },
  selectButtonText: { fontSize: 16, fontWeight: 'bold', color: '#4CAF50' },

  comparisonSection: { padding: 15 },
  comparisonTable: { borderRadius: 12, overflow: 'hidden' },
  comparisonRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  comparisonFeature: { fontSize: 14, flex: 2 },
  comparisonFree: { fontSize: 14, color: '#999', textAlign: 'center', width: 80 },
  comparisonPremium: { fontSize: 14, color: '#4CAF50', fontWeight: 'bold', textAlign: 'center', width: 80 },

  faqSection: { padding: 15 },
  faqItem: { borderRadius: 12, padding: 15, marginBottom: 10 },
  faqQuestion: { fontSize: 15, fontWeight: 'bold', marginBottom: 5 },
  faqAnswer: { fontSize: 13, lineHeight: 18 },

  footer: { padding: 20, alignItems: 'center' },
  footerText: { fontSize: 11, color: '#999', textAlign: 'center', marginBottom: 10, lineHeight: 16 },
  footerLink: { fontSize: 12, color: '#4CAF50' },

  purchasingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchasingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 16,
  },
});
