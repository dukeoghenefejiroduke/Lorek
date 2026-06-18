import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useContext, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Keyboard,
  Modal,
  StatusBar,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AuthContext } from '../context/AuthContext';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';
import { authAPI } from '../services/api';
import GoogleLoginButton from '../components/GoogleLoginButton';
import KeyboardAvoidingWrapper from '../components/KeyboardAvoidingWrapper';

export default function RegisterScreen({ navigation }) {
  const { activeLanguage } = useContext(LanguageContext);
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in RegisterScreen.js:', contextValue);
  const { isDarkMode, theme } = contextValue;
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [referralError, setReferralError] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  
  // Password strength
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasLower: false,
    hasUpper: false,
    hasNumber: false,
    hasSpecial: false,
    isLongEnough: false,
  });

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const { register } = useContext(AuthContext);

  // Password strength checker
  useEffect(() => {
    const strength = {
      hasLower: /[a-z]/.test(password),
      hasUpper: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      isLongEnough: password.length >= 8,
    };
    
    let score = 0;
    if (strength.isLongEnough) score += 1;
    if (strength.hasLower && strength.hasUpper) score += 1;
    if (strength.hasNumber) score += 1;
    if (strength.hasSpecial) score += 1;
    
    setPasswordStrength({
      ...strength,
      score,
    });
  }, [password]);

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength.score) {
      case 0: return '#ff6b6b'; // Red
      case 1: return '#ffa502'; // Orange
      case 2: return '#ffd32a'; // Yellow
      case 3: return '#4cd137'; // Light Green
      case 4: return '#00a8ff'; // Blue (strong)
      default: return '#ccc';
    }
  };

  const getPasswordStrengthText = () => {
    switch (passwordStrength.score) {
      case 0: return 'Very Weak';
      case 1: return 'Weak';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Strong';
      default: return '';
    }
  };

const handleRegister = async () => {
  setErrorMsg('');
  setSuccessMsg('');

  // 1. Basic Field Presence
  if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
    setErrorMsg('Please fill in all fields');
    return;
  }

  // 2. Username Length (Allows exactly 3 and exactly 30)
  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3) {
    setErrorMsg('Username must be at least 3 characters');
    return;
  }
  if (trimmedUsername.length > 30) {
    setErrorMsg('Username must be 30 characters or less');
    return;
  }

  // 3. Email Validation
  if (!validateEmail(email.trim())) {
    setErrorMsg('Please enter a valid email address');
    return;
  }

  // 4. Password Length & Complexity
  if (password.length < 8) {
    setErrorMsg('Password must be at least 8 characters');
    return;
  }

  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    setErrorMsg('Password must include an uppercase letter and a number');
    return;
  }

  // 5. Password Match
  if (password !== confirmPassword) {
    setErrorMsg('Passwords do not match');
    return;
  }

  // 6. Terms Agreement
  if (!agreeToTerms) {
    setErrorMsg('You must agree to the Terms of Service');
    return;
  }

  setLoading(true);
  try {
    const result = await register({
      username: trimmedUsername,
      email: email.trim(),
      password: password.trim(),
      referredByCode: referralCode.trim() || undefined,
      acceptTerms: agreeToTerms,
    });

    if (result?.success) {
      setSuccessMsg('Registration successful! Redirecting...');
    } else {
      // Improved error parsing
      const errorMsg = result?.message || result?.error || 'Registration failed. Please try again.';
      setErrorMsg(errorMsg);
    }
  } catch (error) {
    // Check if error is the structured object from api.js
    const errorMessage = error?.message || 'Network error. Please check your connection.';
    setErrorMsg(errorMessage);
    console.error('Registration error:', error);
  } finally {
    setLoading(false);
  }
};

const handleReferralCheck = async (code) => {
  const cleanCode = code.trim().toUpperCase();
  setReferralCode(cleanCode);
  setReferralError('');
  setReferrerName('');

  if (cleanCode.length >= 4) { // Most codes are Prefix + Random (e.g., DUK-A1B2)
    try {
      // Use your existing axios/api instance
      const response = await authAPI.verifyReferralCode(cleanCode);
      if (response.data.success) {
        setReferrerName(response.data.referrer.displayName || response.data.referrer.username);
        setReferralError('');
      }
    } catch (error) {
      // If 404, the code is just invalid
      if (error.response?.status === 404) {
        setReferralError("Invalid referral code");
      }
    }
  }
};



// ... other imports

// ...

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingWrapper>
        <LinearGradient
          colors={isDarkMode ? ['#000000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32', '#4CAF50']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Pressable style={styles.content} onPress={Keyboard.dismiss}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join our {activeLanguage?.name || 'Izon'} learning community</Text>
            </View>

            {errorMsg ? (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={20} color={theme.error} />
                <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
              </View>
            ) : null}

            {successMsg ? (
              <View style={styles.successContainer}>
                <MaterialIcons name="check-circle" size={20} color={theme.success} />
                <Text style={[styles.successText, { color: theme.success }]}>{successMsg}</Text>
              </View>
            ) : null}

            {/* Username Input */}
            <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
              <MaterialIcons name="person" size={20} color={theme.subText} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Username"
                placeholderTextColor={theme.subText}
                value={username}
                onChangeText={(val) => {
                  setUsername(val);
                  if (errorMsg.toLowerCase().includes('username')) {
                       setErrorMsg('');
                  }
                 if (val.trim().length >= 3 && val.trim().length <= 30) {
                     setErrorMsg('');
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
              />
             {username.length > 0 && (
                 <Text style={{ 
                   fontSize: 10, 
                   color: (username.trim().length < 3 || username.length > 30) ? theme.error : theme.subText, 
                   marginRight: 10 
                 }}>
                   {username.length}/30
                </Text>
              )}
            </View>

            {/* Email Input */}
            <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
              <MaterialIcons name="email" size={20} color={theme.subText} style={styles.inputIcon} />
              <TextInput
                ref={emailRef}
                style={[styles.input, { color: theme.text }]}
                placeholder="Email"
                placeholderTextColor={theme.subText}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            {/* Password Input */}
            <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
              <MaterialIcons name="lock" size={20} color={theme.subText} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { paddingRight: 50, color: theme.text }]}
                placeholder="Password"
                placeholderTextColor={theme.subText}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color={theme.subText} 
                />
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor: level <= passwordStrength.score 
                            ? getPasswordStrengthColor() 
                            : theme.border,
                          width: '23%',
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthText, { color: getPasswordStrengthColor() }]}>
                  {getPasswordStrengthText()}
                </Text>
              </View>
            )}

            {/* Confirm Password Input */}
            <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
              <MaterialIcons name="lock-outline" size={20} color={theme.subText} style={styles.inputIcon} />
              <TextInput
                ref={confirmPasswordRef}
                style={[styles.input, { paddingRight: 50, color: theme.text }]}
                placeholder="Confirm Password"
                placeholderTextColor={theme.subText}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons 
                  name={showConfirmPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color={theme.subText} 
                />
              </TouchableOpacity>
            </View>

            {/* Password Match Indicator */}
            {confirmPassword.length > 0 && (
              <View style={styles.matchContainer}>
                <Ionicons
                  name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={password === confirmPassword ? theme.success : theme.error}
                />
                <Text style={[
                  styles.matchText,
                  { color: password === confirmPassword ? theme.success : theme.error }
                ]}>
                  {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              </View>
            )}

{/* Referral Code (Optional) */}
<View style={[styles.inputContainer, referralError ? { borderColor: theme.error, borderWidth: 1 } : null, { backgroundColor: theme.card }]}>
  <MaterialIcons name="share" size={20} color={theme.subText} style={styles.inputIcon} />
  <TextInput
    style={[styles.input, { color: theme.text }]}
    placeholder="Referral Code (Optional)"
    placeholderTextColor={theme.subText}
    value={referralCode}
    onChangeText={handleReferralCheck} // Trigger check on type
    autoCapitalize="characters"
    returnKeyType="done"
  />
</View>

{/* Show Success/Error Feedback */}
{referrerName ? (
  <Text style={{ color: theme.success, fontSize: 12, marginLeft: 15, marginBottom: 10 }}>
    Invited by: <Text style={{ fontWeight: 'bold' }}>{referrerName}</Text>
  </Text>
) : null}
{referralError ? (
  <Text style={{ color: theme.error, fontSize: 12, marginLeft: 15, marginBottom: 10 }}>
    {referralError}
  </Text>
) : null}

            {/* Terms and Conditions */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAgreeToTerms(!agreeToTerms)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked, { borderColor: theme.text }]}>
                {agreeToTerms && <MaterialIcons name="check" size={16} color="#fff" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                I agree to the{' '}
                <Text 
                  style={[styles.linkHighlight, { color: theme.accent }]}
                  onPress={() => setTermsModalVisible(true)}
                >
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text 
                  style={[styles.linkHighlight, { color: theme.accent }]}
                  onPress={() => navigation.navigate('PrivacyPolicy')}
                >
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: theme.surface }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <Text style={[styles.buttonText, { color: theme.primary }]}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, { color: theme.text }]}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={[styles.loginLink, { color: theme.accent }]}>Sign In</Text>
              </TouchableOpacity>
            </View>

            {/* Social Registration (Optional) */}
            <View style={styles.socialContainer}>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.subText }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              <GoogleLoginButton type="register" />
            </View>
          </Pressable>
        </LinearGradient>
      </KeyboardAvoidingWrapper>

      {/* Terms Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={termsModalVisible}
        onRequestClose={() => setTermsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={isDarkMode ? ['#000000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Terms of Service</Text>
              <TouchableOpacity onPress={() => setTermsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalText, { color: theme.text }]}>
                Welcome to {activeLanguage?.name || 'Izon'} Language App! By creating an account, you agree to:
                {'\n\n'}1. Provide accurate information
                {'\n'}2. Maintain the security of your account
                {'\n'}3. Respect other users and their learning journey
                {'\n'}4. Not misuse or abuse the platform
                {'\n\n'}We respect your privacy and will never share your personal information.
                {'\n\n'}Happy learning! 🎉
              </Text>
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                setAgreeToTerms(true);
                setTermsModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>I Agree</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
  },
  headerContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    gap: 8,
  },
  errorText: {
    color: '#ff6b6b',
    flex: 1,
    fontSize: 14,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    gap: 8,
  },
  successText: {
    color: '#4CAF50',
    flex: 1,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 10,
  },
  strengthContainer: {
    marginTop: -10,
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  strengthBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -10,
    marginBottom: 15,
    paddingHorizontal: 5,
    gap: 5,
  },
  matchText: {
    fontSize: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  checkboxLabel: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  linkHighlight: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#1a4c2e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  loginText: {
    color: '#fff',
    fontSize: 14,
  },
  loginLink: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  socialContainer: {
    marginTop: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dividerText: {
    color: '#fff',
    paddingHorizontal: 15,
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
