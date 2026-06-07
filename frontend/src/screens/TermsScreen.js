import React, { useState, useRef, useEffect, useContext } from 'react';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import haptics from "../utils/haptics";

const { width } = Dimensions.get('window');

// ============================================================================
// SECTIONS DATA
// ============================================================================

const SECTIONS = [
  { id: 'introduction', title: 'Introduction', icon: 'info' },
  { id: 'acceptance', title: 'Acceptance of Terms', icon: 'check-circle' },
  { id: 'user-obligations', title: 'User Obligations', icon: 'person' },
  { id: 'account-registration', title: 'Account Registration', icon: 'person-add' },
  { id: 'content', title: 'User Content', icon: 'description' },
  { id: 'privacy', title: 'Privacy Policy', icon: 'privacy-tip' },
  { id: 'data-collection', title: 'Data Collection', icon: 'data-usage' },
  { id: 'cookies', title: 'Cookies', icon: 'cookie' },
  { id: 'third-party', title: 'Third-Party Services', icon: 'share' },
  { id: 'intellectual-property', title: 'Intellectual Property', icon: 'copyright' },
  { id: 'prohibited-conduct', title: 'Prohibited Conduct', icon: 'block' },
  { id: 'termination', title: 'Termination', icon: 'cancel' },
  { id: 'disclaimers', title: 'Disclaimers', icon: 'warning' },
  { id: 'limitation-liability', title: 'Limitation of Liability', icon: 'gavel' },
  { id: 'indemnification', title: 'Indemnification', icon: 'shield' },
  { id: 'changes', title: 'Changes to Terms', icon: 'update' },
  { id: 'governing-law', title: 'Governing Law', icon: 'gavel' },
  { id: 'contact', title: 'Contact Us', icon: 'email' },
];

const PRIVACY_SECTIONS = [
  { id: 'information-collection', title: 'Information We Collect', icon: 'database' },
  { id: 'information-use', title: 'How We Use Information', icon: 'analytics' },
  { id: 'information-sharing', title: 'Information Sharing', icon: 'share' },
  { id: 'data-security', title: 'Data Security', icon: 'security' },
  { id: 'user-rights', title: 'Your Rights', icon: 'verified-user' },
  { id: 'children-privacy', title: 'Children\'s Privacy', icon: 'child-care' },
  { id: 'international-transfer', title: 'International Transfer', icon: 'public' },
  { id: 'data-retention', title: 'Data Retention', icon: 'history' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

const SectionHeader = ({ title, icon, isActive, onPress, index, theme }) => (
  <TouchableOpacity
    style={[styles.sectionHeader, { backgroundColor: theme.card }, isActive && styles.sectionHeaderActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.sectionHeaderLeft}>
      <View style={[styles.sectionIcon, isActive && styles.sectionIconActive]}>
        <MaterialIcons name={icon} size={20} color={isActive ? '#fff' : '#4CAF50'} />
      </View>
      <Text style={[styles.sectionHeaderText, { color: theme.text }, isActive && styles.sectionHeaderTextActive]}>
        {title}
      </Text>
    </View>
    <MaterialIcons 
      name={isActive ? 'expand-less' : 'expand-more'} 
      size={24} 
      color={isActive ? '#4CAF50' : '#999'} 
    />
  </TouchableOpacity>
);

const SectionContent = ({ title, content, isVisible, theme }) => {
  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.sectionContent, { backgroundColor: theme.card }]}>
      <Text style={styles.sectionContentText}>{content}</Text>
    </Animated.View>
  );
};

const TabButton = ({ title, isActive, onPress, theme }) => (
  <TouchableOpacity
    style={[styles.tabButton, isActive && styles.tabButtonActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.tabButtonText, { color: theme.subText }, isActive && styles.tabButtonTextActive]}>
      {title}
    </Text>
  </TouchableOpacity>
);

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function TermsScreen({ navigation, route }) {
  const { type = 'terms' } = route.params || {};
  const [activeTab, setActiveTab] = useState(type);
  const [expandedSections, setExpandedSections] = useState({});
  const [lastUpdated, setLastUpdated] = useState('April 13, 2024');
  const [version, setVersion] = useState('2.0');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startAnimations();
  }, []);

  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in TermsScreen.js:', contextValue);
  const { isDarkMode, theme } = contextValue;

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const toggleSection = (sectionId) => {
    haptics.impactLight();
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleLinkPress = async (url) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Cannot open link');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out the ${activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'} for Lorek App:\n\n${getShareText()}`,
        title: activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const getShareText = () => {
    if (activeTab === 'terms') {
      return 'https://izonapp.com/terms';
    }
    return 'https://izonapp.com/privacy';
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const scrollRef = useRef(null);

  const renderTermsContent = () => (
    <View>
      {SECTIONS.map((section, index) => (
        <React.Fragment key={section.id}>
          <SectionHeader
            title={section.title}
            icon={section.icon}
            isActive={expandedSections[section.id]}
            onPress={() => toggleSection(section.id)}
            index={index}
            theme={theme}
          />
          <SectionContent
            title={section.title}
            isVisible={expandedSections[section.id]}
            content={getTermsContent(section.id)}
            theme={theme}
          />
        </React.Fragment>
      ))}

      {/* Version Info */}
      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>
          Version {version} • Last updated: {lastUpdated}
        </Text>
      </View>
    </View>
  );

  const renderPrivacyContent = () => (
    <View>
      {PRIVACY_SECTIONS.map((section, index) => (
        <React.Fragment key={section.id}>
          <SectionHeader
            title={section.title}
            icon={section.icon}
            isActive={expandedSections[section.id]}
            onPress={() => toggleSection(section.id)}
            index={index}
            theme={theme}
          />
          <SectionContent
            title={section.title}
            isVisible={expandedSections[section.id]}
            content={getPrivacyContent(section.id)}
            theme={theme}
          />
        </React.Fragment>
      ))}
    </View>
  );

  const getTermsContent = (id) => {
    switch (id) {
      case 'introduction': return 'welcome to the Lorek App (\"we,\" \"our,\" or \"us\"). These Terms of Service (\"Terms\") govern your use of our mobile application and related services. By accessing or using the Lorek App, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service.';
      case 'acceptance': return 'By creating an account, accessing, or using the Lorek App, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms.';
      case 'user-obligations': return 'You agree to:\n\n• Provide accurate and complete information when creating your account\n• Maintain the security and confidentiality of your login credentials\n• Notify us immediately of any unauthorized use of your account\n• Comply with all applicable laws and regulations\n• Use the Service only for lawful purposes\n• Respect the intellectual property rights of others\n• Not interfere with or disrupt the Service or servers';
      case 'account-registration': return "To access certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password and for all activities that occur under your account. We reserve the right to suspend or terminate your account if any information provided is inaccurate, false, or incomplete.";
      case 'content': return "Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, or other material. You are responsible for the content you post. By posting content, you grant us a non-exclusive, worldwide, royalty-free license to use, modify, publicly perform, publicly display, reproduce, and distribute such content on and through the Service. You represent and warrant that you own or have the necessary licenses, rights, consents, and permissions to publish content you submit.";
      case 'privacy': return "Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your personal information. By using our Service, you agree to the collection and use of information in accordance with the Privacy Policy. Please read our Privacy Policy carefully.";
      case 'data-collection': return "We collect information you provide directly to us, such as when you create an account, update your profile, or communicate with us. This may include your name, email address, username, and learning progress data. We also automatically collect certain information about your device and usage of the Service, including IP address, browser type, and app usage statistics.";
      case 'cookies': return "We use cookies and similar tracking technologies to track activity on our Service and hold certain information. Cookies are files with small amount of data which may include an anonymous unique identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.";
      case 'third-party': return "Our Service may contain links to third-party web sites or services that are not owned or controlled by us. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third party web sites or services. You further acknowledge and agree that we shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with use of or reliance on any such content, goods or services available on or through any such web sites or services.";
      case 'intellectual-property': return "The Service and its original content, features, and functionality are and will remain the exclusive property of Lorek App and its licensors. The Service is protected by copyright, trademark, and other laws of both Nigeria and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Lorek App.";
      case 'prohibited-conduct': return "You agree not to:\n\n• Use the Service for any illegal purpose\n• Post or transmit any content that is defamatory, obscene, or otherwise objectionable\n• Impersonate any person or entity\n• Interfere with or disrupt the Service or servers\n• Attempt to gain unauthorized access to any portion of the Service\n• Use any automated means to access the Service\n• Collect or harvest any personally identifiable information from the Service\n• Reverse engineer, decompile, or disassemble any portion of the Service";
      case 'termination': return "We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service or contact us to request account deletion.";
      case 'disclaimers': return 'YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK. THE SERVICE IS PROVIDED ON AN \"AS IS\" AND \"AS AVAILABLE\" BASIS. THE SERVICE IS PROVIDED WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT OR COURSE OF PERFORMANCE. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE.';
      case 'limitation-liability': return "IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (i) YOUR USE OR INABILITY TO USE THE SERVICE; (ii) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE; (iii) ANY CONTENT OBTAINED FROM THE SERVICE; AND (iv) UNAUTHORIZED ACCESS, USE OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT.";
      case 'indemnification': return "You agree to defend, indemnify and hold harmless Lorek App and its licensors, employees, contractors, agents, officers and directors from and against any and all claims, damages, obligations, losses, liabilities, costs or debt, and expenses (including but not limited to attorney's fees), resulting from or arising out of (i) your use and access of the Service; (ii) your violation of any term of these Terms; (iii) your violation of any third-party right, including without limitation any copyright, property, or privacy right; or (iv) any claim that your content caused damage to a third party.";
      case 'changes': return "We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.";
      case 'governing-law': return "These Terms shall be governed and construed in accordance with the laws of Nigeria, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.";
      case 'contact': return "If you have any questions about these Terms, please contact us at:\n\n📧 Email: legal@izonapp.com\n🌐 Website: https://izonapp.com/contact\n📍 Address: Otuoke, Bayelsa State, Nigeria\n\nWe aim to respond to all inquiries within 3-5 business days.";
      default: return "";
    }
  };

  const getPrivacyContent = (id) => {
    switch (id) {
      case 'information-collection': return "We collect several types of information from and about users of our Service, including:\n\n• Personal Information: Name, email address, username, and profile information\n• Learning Data: Lesson progress, vocabulary mastery, quiz scores, and language proficiency\n• Usage Data: How you interact with the app, features used, time spent\n• Device Information: IP address, device type, operating system, browser type\n• Location Data: General location (country/city level) for analytics\n• Communication Data: Messages, comments, and feedback you provide";
      case 'information-use': return "We use the collected information for various purposes:\n\n• To provide and maintain our Service\n• To personalize your learning experience\n• To track your progress and provide insights\n• To improve and optimize our Service\n• To communicate with you about updates and features\n• To analyze usage patterns and trends\n• To detect, prevent, and address technical issues\n• To comply with legal obligations";
      case 'information-sharing': return "We do not sell your personal information. We may share your information in the following circumstances:\n\n• With your consent\n• With service providers who assist in operating our Service\n• To comply with legal obligations\n• To protect our rights and property\n• In connection with a business transfer or merger\n• With community features you choose to participate in (e.g., leaderboards, discussions)";
      case 'data-security': return "We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These include encryption, secure servers, access controls, and regular security assessments. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.";
      case 'user-rights': return 'Depending on your location, you may have certain rights regarding your personal information:\n\n• Access: Request a copy of your data\n• Correction: Request corrections to inaccurate data\n• Deletion: Request deletion of your data\n• Portability: Request a copy of your data in a machine-readable format\n• Objection: Object to certain data processing\n• Restriction: Request restriction of data processing\n\nTo exercise these rights, contact us at privacy@izonapp.com';
      case 'children-privacy': return "Our Service is not intended for children under 13 years of age. We do not knowingly collect personally identifiable information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us. If we become aware that we have collected personal information from children under 13 without verification of parental consent, we take steps to remove that information from our servers.";
      case 'international-transfer': return "Your information may be transferred to — and maintained on — computers located outside of your state, province, country, or other governmental jurisdiction where the data protection laws may differ from those of your jurisdiction. If you are located outside Nigeria and choose to provide information to us, please note that we transfer the data to Nigeria and process it there. Your consent to this Privacy Policy followed by your submission of such information represents your agreement to that transfer.";
      case 'data-retention': return "We will retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your information to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our legal agreements and policies. When you delete your account, we will remove your personal information within 30 days, except for information we are required to retain for legal purposes.";
      default: return "";
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />

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
          <Text style={styles.headerTitle}>
            {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          </Text>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <MaterialIcons name="share" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          {activeTab === 'terms' 
            ? 'Last updated: April 13, 2024 | Version 2.0'
            : 'Your privacy matters to us'}
        </Text>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.card }]}>
        <TabButton
          title="Terms of Service"
          isActive={activeTab === 'terms'}
          onPress={() => setActiveTab('terms')}
          theme={theme}
        />
        <TabButton
          title="Privacy Policy"
          isActive={activeTab === 'privacy'}
          onPress={() => setActiveTab('privacy')}
          theme={theme}
        />
      </View>

      {/* Content */}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {activeTab === 'terms' ? renderTermsContent() : renderPrivacyContent()}
        </Animated.View>

        {/* Last Updated Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Lorek App. All rights reserved.
          </Text>
          <Text style={styles.footerSubtext}>
            Made with ❤️ in Otuoke, Bayelsa, Nigeria
          </Text>
        </View>
      </Animated.ScrollView>

      {/* Scroll to Top Button */}
      <Animated.View 
        style={[
          styles.scrollTopButton,
          {
            opacity: scrollY.interpolate({
              inputRange: [0, 300],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <TouchableOpacity onPress={scrollToTop} style={styles.scrollTopInner}>
          <MaterialIcons name="keyboard-arrow-up" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  shareButton: {
    padding: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 25,
    marginHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: '#4CAF50',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionHeaderActive: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionIconActive: {
    backgroundColor: '#4CAF50',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeaderTextActive: {
    color: '#4CAF50',
  },
  sectionContent: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderTopWidth: 0,
  },
  sectionContentText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  versionInfo: {
    marginTop: 20,
    padding: 16,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
  footer: {
    marginTop: 30,
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  footerSubtext: {
    fontSize: 11,
    color: '#ccc',
  },
  scrollTopButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  scrollTopInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});