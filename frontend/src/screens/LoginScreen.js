import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useContext, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
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
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthContext } from '../context/AuthContext';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';
import GoogleLoginButton from '../components/GoogleLoginButton';
import LoadingOverlay from '../components/LoadingOverlay';
import KeyboardAvoidingWrapper from '../components/KeyboardAvoidingWrapper';

export default function LoginScreen({ navigation }) {
  const { activeLanguage } = useContext(LanguageContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const passwordRef = useRef(null);
  const { login, authenticateWithBiometric } = useContext(AuthContext);

   const contextValue = useContext(ThemeContext) || {};
   console.log('DEBUG: Accessing ThemeContext in LoginScreen.js:', contextValue);
   const { isDarkMode, theme } = contextValue;

  // Check for saved email and biometric availability
  useEffect(() => {
    loadSavedEmail();
    checkBiometricSupport();
    
    // Connectivity test
    fetch('https://jsonplaceholder.typicode.com/posts/1')
      .then(response => response.json())
      .then(json => console.log('✅ HTTPS Test Success:', json))
      .catch(error => console.error('❌ HTTPS Test Failed:', error));
  }, []);

  const loadSavedEmail = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('rememberedEmail');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Failed to load saved email:', error);
    }
  };

  const checkBiometricSupport = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
    }
  };

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setErrorMsg('');

    // Validation
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password');
      return;
    }

    if (!validateEmail(email.trim())) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      const result = await login(email.trim(), password, rememberMe);

      if (!result?.success) {
        // Improved error parsing
        if (result?.errors && Array.isArray(result.errors)) {
          // Join all error messages with newlines
          const errorMsg = result.errors.map(err => err.msg).join('\n');
          setErrorMsg(errorMsg);
        } else {
          // Fallback to existing error parsing
          const errorMessage = handleErrorMessage(result?.error || result?.message, result?.status);
          setErrorMsg(errorMessage);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      // Try to get status from error object
      const status = err.response?.status;
      setErrorMsg(handleErrorMessage(err.message, status));
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      setBiometricLoading(true);
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to login',
        fallbackLabel: 'Use password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const biometricResult = await authenticateWithBiometric();
        
        if (biometricResult?.success) {
          // Success - AuthContext handles navigation
        } else {
          setErrorMsg('Biometric login failed. Please use password.');
        }
      }
    } catch (error) {
      console.error('Biometric error:', error);
      setErrorMsg('Biometric authentication failed');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim() || !validateEmail(resetEmail.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setResetLoading(true);
    
    // Simulate API call - replace with actual password reset logic
    setTimeout(() => {
      setResetLoading(false);
      setResetSuccess(true);
      
      setTimeout(() => {
        setResetModalVisible(false);
        setResetSuccess(false);
        setResetEmail('');
        Alert.alert(
          'Reset Email Sent',
          'Check your inbox for password reset instructions.'
        );
      }, 1500);
    }, 1500);
  };

  const handleErrorMessage = (error, status) => {
    if (!error) return 'Login failed. Please try again.';
    
    // Check for explicit status code 423
    if (status === 423) {
      return error; // The backend already provides the "Try again in X minutes" message
    }
    
    const errorStr = error.toString().toLowerCase(); 
    
    if (errorStr.includes('401') || errorStr.includes('unauthorized')) {
      return 'Incorrect email or password.';
    }
    if (errorStr.includes('user-not-found') || errorStr.includes('no user')) {
      return 'We couldn\'t find an account with that email.';
    } else if (errorStr.includes('wrong-password') || errorStr.includes('invalid-password')) {
      return 'Incorrect password.';
    } else if (errorStr.includes('network')) {
      return 'Network error. Please check your internet connection.';
    } else if (errorStr.includes('locked') || errorStr.includes('too many attempts')) {
      return 'Your account is temporarily locked. Please try again later.';
    } else if (errorStr.includes('not verified')) {
      return 'Please verify your email before logging in.';
    }
    
    return error;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingWrapper>
        <LinearGradient
          colors={isDarkMode ? ['#000000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32', '#43a047']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Pressable style={styles.content} onPress={Keyboard.dismiss}>
            {/* Header */}
            <View style={styles.headerContainer}>
              <Text style={[styles.title, { color: '#fff' }]}>{activeLanguage?.name || 'Izon'} Language</Text>
              <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.9)' }]}>Welcome back! 👋</Text>
            </View>

            {/* Error Message */}
            {errorMsg ? (
              <View style={[styles.errorContainer, { backgroundColor: theme.error + '20' }]}>
                <MaterialIcons name="error-outline" size={20} color={theme.error} />
                <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
              <MaterialIcons name="email" size={20} color={theme.subText} style={styles.inputIcon} />
              <TextInput
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
                editable={!loading}
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
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color={theme.subText} 
                />
              </TouchableOpacity>
            </View>

            {/* Remember Me & Forgot Password */}
            <View style={styles.rowContainer}>
              <TouchableOpacity
                style={styles.rememberContainer}
                onPress={() => setRememberMe(!rememberMe)}
                disabled={loading}
              >
                <View style={[styles.checkbox, rememberMe && {backgroundColor: theme.accent, borderColor: theme.accent}, { borderColor: theme.text }]}>
                  {rememberMe && <MaterialIcons name="check" size={14} color="#fff" />}
                </View>
                <Text style={[styles.rememberText, { color: theme.text }]}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setResetModalVisible(true)}
                disabled={loading}
              >
                <Text style={[styles.forgotText, { color: theme.accent }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: theme.primary }]}
              onPress={handleLogin}
              disabled={loading || biometricLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>

            <GoogleLoginButton type="login" />

            {/* Biometric Login */}
            {biometricAvailable && !loading && (
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricLogin}
                disabled={biometricLoading}
              >
                  <>
                    <Ionicons 
                      name={Platform.OS === 'ios' ? 'finger-print' : 'finger-print-outline'} 
                      size={20} 
                      color="#fff" 
                    />
                    <Text style={styles.biometricText}>
                      {Platform.OS === 'ios' ? 'Use Face ID' : 'Use Fingerprint'}
                    </Text>
                  </>
              </TouchableOpacity>
            )}

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={[styles.registerText, { color: theme.text }]}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={[styles.registerLink, { color: theme.accent }]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Demo Credentials (for testing) */}
            {__DEV__ && (
              <View style={[styles.demoContainer, { backgroundColor: theme.surface }]}>
                <Text style={[styles.demoTitle, { color: theme.accent }]}>Demo Credentials:</Text>
                <Text style={[styles.demoText, { color: theme.text }]}>Email: demo@izon.com</Text>
                <Text style={[styles.demoText, { color: theme.text }]}>Password: demo123</Text>
              </View>
            )}
          </Pressable>
        </LinearGradient>
      </KeyboardAvoidingWrapper>

      <LoadingOverlay visible={loading || biometricLoading || resetLoading} message="Please wait..." />

      {/* Password Reset Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={resetModalVisible}
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={isDarkMode ? ['#000000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setResetModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              {resetSuccess ? (
                <View style={styles.successContainer}>
                  <MaterialIcons name="check-circle" size={60} color={theme.success} />
                  <Text style={[styles.successTitle, { color: theme.text }]}>Email Sent!</Text>
                  <Text style={[styles.successText, { color: theme.subText }]}>
                    Check your inbox for password reset instructions.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.modalDescription, { color: theme.subText }]}>
                    Enter your email address and we'll send you instructions to reset your password.
                  </Text>

                  <View style={[styles.inputContainer, { backgroundColor: theme.background }]}>
                    <MaterialIcons name="email" size={20} color={theme.subText} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Email"
                      placeholderTextColor={theme.subText}
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!resetLoading}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.modalButton, resetLoading && styles.buttonDisabled, { backgroundColor: theme.primary }]}
                    onPress={handleForgotPassword}
                    disabled={resetLoading}
                  >
                    <Text style={styles.modalButtonText}>Send Reset Instructions</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 30 },
  headerContainer: { marginBottom: 40 },
  title: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 18, textAlign: 'center' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 15, gap: 8 },
  errorText: { flex: 1, fontSize: 14 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, marginBottom: 15, paddingHorizontal: 15, elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, padding: 15, fontSize: 16 },
  eyeIcon: { padding: 10 },
  rowContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  rememberContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  rememberText: { fontSize: 14 },
  forgotText: { fontSize: 14, fontWeight: '600' },
  button: { padding: 16, borderRadius: 10, alignItems: 'center', elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, marginBottom: 15 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  biometricButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 10, marginBottom: 20, gap: 8 },
  biometricText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  registerText: { fontSize: 14 },
  registerLink: { fontSize: 14, fontWeight: 'bold' },
  demoContainer: { padding: 15, borderRadius: 10, marginTop: 20 },
  demoTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  demoText: { fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalBody: { padding: 20 },
  modalDescription: { fontSize: 14, lineHeight: 20, marginBottom: 20, textAlign: 'center' },
  modalButton: { padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 15 },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  successContainer: { alignItems: 'center', padding: 20 },
  successTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
  successText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});