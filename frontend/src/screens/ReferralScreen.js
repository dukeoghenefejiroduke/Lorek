import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import {
  View,
  Text,
  Share,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  StatusBar,
  Modal,
  Linking,
  RefreshControl,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import haptics from "../utils/haptics";
import QRCode from 'react-native-qrcode-svg';
import { BlurView } from 'expo-blur';

import { AuthContext } from '../context/AuthContext';

import { referralAPI } from '../services/api';

const { width } = Dimensions.get('window');

// ============================================================================
// CONSTANTS
// ============================================================================

const SHARE_PLATFORMS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366', scheme: 'whatsapp://' },
  { id: 'telegram', name: 'Telegram', icon: 'paper-plane', color: '#0088cc', scheme: 'tg://' },
  { id: 'twitter', name: 'Twitter', icon: 'logo-twitter', color: '#1DA1F2', scheme: 'twitter://' },
  { id: 'facebook', name: 'Facebook', icon: 'logo-facebook', color: '#4267B2', scheme: 'fb://' },
  { id: 'messages', name: 'Messages', icon: 'chatbubbles', color: '#4CAF50', scheme: 'sms://' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

const StatCard = ({ icon, label, value, color, onPress, theme }) => (
  <TouchableOpacity 
    style={[styles.statCard, { backgroundColor: theme.card }]} 
    onPress={onPress} 
    activeOpacity={0.7}
  >
    <LinearGradient colors={[`${color}20`, `${color}10`]} style={styles.statGradient}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}30` }]}>
        <MaterialIcons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

const ReferralItem = ({ item, index, isLast, theme }) => (
  <View style={[styles.referralItem, !isLast && { borderBottomColor: theme.border }, !isLast && styles.referralItemBorder]}>
    <View style={styles.referralAvatar}>
      <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.avatarGradient}>
        <Text style={styles.avatarText}>{item.initials || item.avatar || 'U'}</Text>
      </LinearGradient>
    </View>
    <View style={styles.referralInfo}>
      <Text style={[styles.referralName, { color: theme.text }]}>{item.name}</Text>
      <Text style={[styles.referralDate, { color: theme.subText }]}>{item.date}</Text>
    </View>
    <View style={styles.referralStatus}>
      <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? '#4CAF5020' : '#FF980020' }]}>
        <Text style={[styles.statusText, { color: item.status === 'active' ? '#4CAF50' : '#FF9800' }]}>
          {item.status === 'active' ? '✓ Active' : '⏳ Pending'}
        </Text>
      </View>
      {item.earned > 0 && (
        <Text style={styles.referralEarned}>+{item.earned} XP</Text>
      )}
    </View>
  </View>
);

const RewardCard = ({ reward, totalReferrals, theme }) => {
  const isUnlocked = totalReferrals >= reward.required;
  const isClaimed = reward.claimed;
  
  return (
    <View style={[styles.rewardCard, { backgroundColor: theme.card }, isUnlocked && styles.rewardCardUnlocked]}>
      <View style={[styles.rewardIcon, { backgroundColor: theme.background }]}>
        <Text style={styles.rewardIconText}>{reward.icon}</Text>
      </View>
      <Text style={[styles.rewardValue, { color: theme.text }]}>{reward.required} Referrals</Text>
      <Text style={[styles.rewardLabel, { color: theme.subText }]}>{reward.name}</Text>
      <Text style={styles.rewardPoints}>+{reward.points} XP</Text>
      {isClaimed ? (
        <View style={styles.rewardClaimedBadge}>
          <MaterialIcons name="check-circle" size={14} color="#4CAF50" />
          <Text style={styles.rewardClaimedText}>Claimed</Text>
        </View>
      ) : isUnlocked ? (
        <TouchableOpacity style={styles.rewardClaimButton}>
          <Text style={styles.rewardClaimButtonText}>Claim</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.rewardProgress}>{reward.remaining} more needed</Text>
      )}
    </View>
  );
};

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function ReferralScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in ReferralScreen.js:', contextValue);
  const { theme, isDarkMode } = contextValue;
  
  // State
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [stats, setStats] = useState({
    totalReferrals: 0,
    activeReferrals: 0,
    pendingReferrals: 0,
    totalEarned: 0,
    rank: 'Bronze Ambassador',
    rankColor: '#CD7F32',
    nextMilestone: 5,
    nextReward: 1000,
    progressToNext: 0,
  });
  const [referrals, setReferrals] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadReferralData();
    startAnimations();
    startPulseAnimation();
    startRotateAnimation();

    return () => {
      // Cleanup if needed
    };
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startRotateAnimation = () => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();
  };

  const loadReferralData = async () => {
    try {
      setLoading(true);
      const [codeRes, statsRes, referralsRes, rewardsRes] = await Promise.all([
        referralAPI.getCode(),
        referralAPI.getStats(),
        referralAPI.getReferrals(),
        referralAPI.rewards(),
      ]);

      setReferralCode(codeRes.data.data.code);
      setReferralLink(codeRes.data.data.link);
      setStats(statsRes.data.data);
      setReferrals(referralsRes.data.data || []);
      setRewards(rewardsRes.data.data || []);
    } catch (error) {
      console.error('Failed to load referral data:', error);
      Alert.alert('Error', 'Failed to load referral information');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReferralData();
    setRefreshing(false);
  };

  const copyToClipboard = async () => {
    if (referralCode) {
      await Clipboard.setStringAsync(referralCode);
      haptics.impactMedium();
      Alert.alert('✅ Copied!', `Referral code "${referralCode}" copied to clipboard`);
    }
  };

  const copyLinkToClipboard = async () => {
    if (referralLink) {
      await Clipboard.setStringAsync(referralLink);
      haptics.impactMedium();
      Alert.alert('✅ Copied!', 'Referral link copied to clipboard');
    }
  };

  const generateNewCode = async () => {
    Alert.alert(
      'Generate New Code',
      'Are you sure you want to generate a new referral code? Your old code will stop working.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            try {
              const response = await referralAPI.generateNewCode();
              setReferralCode(response.data.data.code);
              setReferralLink(response.data.data.link);
              haptics.notificationSuccess();
              Alert.alert('Success', 'New referral code generated');
            } catch (error) {
              Alert.alert('Error', 'Failed to generate new code');
            }
          },
        },
      ]
    );
  };

  const shareViaPlatform = async (platform) => {
    const message = `🎉 Join me on the Lorek App and let's learn together!\n\nUse my referral code: ${referralCode}\n\nYou'll get 500 XP bonus instantly, and I'll get 500 XP too! 🚀\n\nDownload here: ${referralLink}`;

    try {
      if (platform.scheme) {
        const url = `${platform.scheme}?text=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          // Fallback to system share
          await Share.share({ message });
        }
      } else {
        await Share.share({ message });
      }
      haptics.notificationSuccess();
    } catch (error) {
      Alert.alert('Error', `Could not share via ${platform.name}`);
    }
  };

  const shareGeneral = async () => {
    const message = `🎉 Join me on the Lorek App and let's learn together!\n\nUse my referral code: ${referralCode}\n\nYou'll get 500 XP bonus instantly, and I'll get 500 XP too! 🚀\n\nDownload here: ${referralLink}`;
    
    try {
      const result = await Share.share({
        message,
        url: referralLink,
        title: 'Join Lorek App!',
      });
      if (result.action === Share.sharedAction) {
        haptics.notificationSuccess();
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const claimReward = async (rewardId) => {
    try {
      const response = await referralAPI.claimRewards({ rewardId });
      if (response.data.success) {
        haptics.notificationSuccess();
        Alert.alert('🎉 Reward Claimed!', response.data.message);
        await loadReferralData(); // Refresh data
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to claim reward');
    }
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <FontAwesome5 name="gift" size={60} color="#4CAF50" />
        </Animated.View>
        <Text style={[styles.loadingText, { color: theme.subText }]}>Loading your referral info...</Text>
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

      {/* Animated Background Pattern */}
      <Animated.View style={[styles.backgroundPattern, { transform: [{ rotate }] }]}>
        <Text style={[styles.patternText, { color: theme.primary, opacity: isDarkMode ? 0.03 : 0.05 }]}>⚡ 𖦹 🔱 ⚡ 𖦹 🔱</Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
        }
      >
        {/* Header */}
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
            <Text style={styles.headerTitle}>Refer & Earn</Text>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => Alert.alert(
                'How it Works',
                'Share your unique code with friends. When they sign up using your code, you both get 500 XP bonus!'
              )}
            >
              <Ionicons name="information-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Referral Code Card */}
          <Animated.View style={[styles.codeCard, { transform: [{ scale: scaleAnim }], backgroundColor: theme.card }]}>
            <LinearGradient colors={isDarkMode ? ['#1a1a1a', '#000'] : ['#ffffff', '#f8f9fa']} style={styles.codeGradient}>
              <View style={styles.codeHeader}>
                <FontAwesome5 name="gift" size={24} color="#4CAF50" />
                <Text style={[styles.codeHeaderText, { color: theme.text }]}>Your Referral Code</Text>
              </View>

              <TouchableOpacity style={[styles.codeContainer, { backgroundColor: isDarkMode ? '#252525' : '#f5f5f5' }]} onPress={copyToClipboard} activeOpacity={0.7}>
                <Animated.Text style={[styles.codeText, { transform: [{ scale: pulseAnim }], color: theme.primary }]}>
                  {referralCode}
                </Animated.Text>
                <View style={styles.copyBadge}>
                  <MaterialIcons name="content-copy" size={16} color="#fff" />
                  <Text style={styles.copyBadgeText}>Tap to copy</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.referralLinkContainer}>
                <Text style={[styles.referralLinkLabel, { color: theme.subText }]}>Your referral link:</Text>
                <TouchableOpacity style={[styles.referralLink, { backgroundColor: isDarkMode ? '#252525' : '#f5f5f5' }]} onPress={copyLinkToClipboard}>
                  <Text style={styles.referralLinkText} numberOfLines={1}>
                    {referralLink}
                  </Text>
                  <MaterialIcons name="content-copy" size={16} color="#4CAF50" />
                </TouchableOpacity>
              </View>

              {/* QR Code */}
              <TouchableOpacity style={[styles.qrButton, { backgroundColor: isDarkMode ? '#252525' : '#f5f5f5' }]} onPress={() => setShowQRModal(true)}>
                <QRCode value={referralLink} size={50} color={isDarkMode ? '#fff' : '#1a4c2e'} backgroundColor="transparent" />
                <View style={styles.qrTextContainer}>
                  <Text style={[styles.qrButtonText, { color: theme.text }]}>Show QR Code</Text>
                  <Text style={[styles.qrButtonSubtext, { color: theme.subText }]}>Friends can scan to join</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#999" />
              </TouchableOpacity>

              {/* Regenerate Code */}
              <TouchableOpacity style={styles.regenerateButton} onPress={generateNewCode}>
                <MaterialIcons name="refresh" size={16} color={theme.subText} />
                <Text style={[styles.regenerateText, { color: theme.subText }]}>Generate new code</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard icon="people" label="Total Referrals" value={stats.totalReferrals} color="#4CAF50" theme={theme} />
            <StatCard icon="whatshot" label="Active" value={stats.activeReferrals} color="#FF6B6B" theme={theme} />
            <StatCard icon="pending" label="Pending" value={stats.pendingReferrals} color="#FF9800" theme={theme} />
            <StatCard icon="stars" label="Total Earned" value={`${stats.totalEarned} XP`} color="#FFD700" theme={theme} />
          </View>

          {/* Rank Card */}
          <Animated.View style={[styles.rankCard, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={[stats.rankColor, stats.rankColor + 'CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.rankGradient}
            >
              <View style={styles.rankContent}>
                <View>
                  <Text style={styles.rankLabel}>Your Ambassador Rank</Text>
                  <Text style={styles.rankTitle}>{stats.rank}</Text>
                  <View style={styles.rankProgress}>
                    <View style={styles.rankProgressBar}>
                      <View style={[styles.rankProgressFill, { width: `${stats.progressToNext}%`, backgroundColor: theme.card }]} />
                    </View>
                    <Text style={styles.rankProgressText}>
                      {stats.totalReferrals}/{stats.nextMilestone} to next rank (+{stats.nextReward} XP)
                    </Text>
                  </View>
                </View>
                <FontAwesome5 name="crown" size={40} color="#fff" />
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Share Platforms */}
          <View style={styles.platformsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Share via</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.platformsScroll}>
              {SHARE_PLATFORMS.map((platform) => (
                <TouchableOpacity
                  key={platform.id}
                  style={[styles.platformButton, { backgroundColor: platform.color }]}
                  onPress={() => shareViaPlatform(platform)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={platform.icon} size={24} color="#fff" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Main Share Button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={styles.shareButton} onPress={shareGeneral} activeOpacity={0.8}>
              <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.shareGradient}>
                <FontAwesome5 name="share-alt" size={20} color="#fff" />
                <Text style={styles.shareButtonText}>Invite Friends Now</Text>
                <View style={styles.xpBadge}>
                  <Text style={styles.xpBadgeText}>+500 XP each</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Recent Referrals */}
          {referrals.length > 0 && (
            <View style={[styles.recentSection, { backgroundColor: theme.card }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Referrals</Text>
                <TouchableOpacity>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              {referrals.slice(0, 5).map((referral, index) => (
                <ReferralItem
                  key={referral.id}
                  item={referral}
                  index={index}
                  isLast={index === referrals.slice(0, 5).length - 1}
                  theme={theme}
                />
              ))}
            </View>
          )}

          {/* Rewards Progress */}
          {rewards.length > 0 && (
            <View style={styles.rewardsSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Rewards Progress</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rewardsScroll}>
                {rewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    totalReferrals={stats.totalReferrals}
                    theme={theme}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Footer Note */}
          <Text style={styles.footerNote}>
            ✨ Share via WhatsApp, Messages, Email, or any app. Your friend gets 500 XP instantly!
          </Text>
        </View>
      </ScrollView>

      {/* QR Code Modal */}
      <Modal animationType="slide" transparent={true} visible={showQRModal} onRequestClose={() => setShowQRModal(false)}>
        <BlurView intensity={90} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient colors={['#1a4c2e', '#2e7d32']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Referral QR Code</Text>
              <TouchableOpacity onPress={() => setShowQRModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              <View style={[styles.qrContainer, { backgroundColor: isDarkMode ? '#1a1a1a' : '#fff' }]}>
                <QRCode value={referralLink} size={250} color={isDarkMode ? '#fff' : '#1a4c2e'} backgroundColor="transparent" />
              </View>
              <Text style={[styles.qrInstruction, { color: theme.subText }]}>
                Ask your friends to scan this code to join with your referral!
              </Text>
              <View style={styles.qrCodeInfo}>
                <Text style={[styles.qrCodeText, { color: theme.text }]}>Code: {referralCode}</Text>
                <TouchableOpacity style={[styles.qrCopyButton, { backgroundColor: theme.primary + '20' }]} onPress={copyToClipboard}>
                  <MaterialIcons name="content-copy" size={16} color={theme.primary} />
                  <Text style={[styles.qrCopyText, { color: theme.primary }]}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 20,
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  patternText: {
    fontSize: 40,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  infoButton: { padding: 8 },
  content: {
    padding: 20,
    marginTop: -10,
  },
  codeCard: {
    borderRadius: 20,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  codeGradient: { padding: 20 },
  codeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 8 },
  codeHeaderText: { fontSize: 16, fontWeight: '600' },
  codeContainer: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  codeText: { fontSize: 32, fontWeight: '800', letterSpacing: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 8 },
  copyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, gap: 4 },
  copyBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  referralLinkContainer: { marginBottom: 15 },
  referralLinkLabel: { fontSize: 12, marginBottom: 5 },
  referralLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 8 },
  referralLinkText: { fontSize: 12, color: '#4CAF50', flex: 1, marginRight: 8 },
  qrButton: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 10 },
  qrTextContainer: { flex: 1, marginLeft: 12 },
  qrButtonText: { fontSize: 16, fontWeight: '600' },
  qrButtonSubtext: { fontSize: 12 },
  regenerateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, gap: 8 },
  regenerateText: { fontSize: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { width: (width - 50) / 2, marginBottom: 10, borderRadius: 15, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  statGradient: { padding: 15, alignItems: 'center' },
  statIconContainer: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  rankCard: { borderRadius: 15, overflow: 'hidden', marginBottom: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  rankGradient: { padding: 20 },
  rankContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rankLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  rankTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  rankProgress: { width: 180 },
  rankProgressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, marginBottom: 4 },
  rankProgressFill: { height: '100%', borderRadius: 3 },
  rankProgressText: { fontSize: 10, color: 'rgba(255,255,255,0.8)' },
  platformsSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  platformsScroll: { flexDirection: 'row' },
  platformButton: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  shareButton: { borderRadius: 15, overflow: 'hidden', marginBottom: 20, elevation: 5, shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  shareGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  shareButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  xpBadge: { backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 8 },
  xpBadgeText: { color: '#1a4c2e', fontSize: 10, fontWeight: 'bold' },
  recentSection: { borderRadius: 20, padding: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  viewAllText: { color: '#4CAF50', fontSize: 14 },
  referralItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  referralItemBorder: { borderBottomWidth: 1 },
  referralAvatar: { marginRight: 12 },
  avatarGradient: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  referralInfo: { flex: 1 },
  referralName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  referralDate: { fontSize: 12, color: '#999' },
  referralStatus: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginBottom: 4 },
  statusText: { fontSize: 10, fontWeight: '600' },
  referralEarned: { fontSize: 12, fontWeight: '600', color: '#4CAF50' },
  rewardsSection: { marginBottom: 20 },
  rewardsScroll: { flexDirection: 'row' },
  rewardCard: {
    width: 140,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    opacity: 0.6,
  },
  rewardCardUnlocked: { opacity: 1 },
  rewardIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  rewardIconText: { fontSize: 24 },
  rewardValue: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  rewardLabel: { fontSize: 11, marginBottom: 2, textAlign: 'center' },
  rewardPoints: { fontSize: 10, color: '#4CAF50', fontWeight: '600', marginBottom: 4 },
  rewardClaimedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rewardClaimedText: { fontSize: 10, color: '#4CAF50' },
  rewardClaimButton: { backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  rewardClaimButtonText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  rewardProgress: { fontSize: 10, color: '#999' },
  footerNote: { fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalBody: { padding: 30, alignItems: 'center' },
  qrContainer: { padding: 20, borderRadius: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, marginBottom: 20 },
  qrInstruction: { fontSize: 14, textAlign: 'center', marginBottom: 15 },
  qrCodeInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qrCodeText: { fontSize: 16, fontWeight: '600' },
  qrCopyButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, gap: 4 },
  qrCopyText: {
    fontSize: 12,
    fontWeight: '600',
  },
});