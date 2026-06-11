import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import { userAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext, lightTheme } from '../context/ThemeContext';

export default function ChangePasswordScreen({ navigation }) {
  const { logout } = useContext(AuthContext);
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in ChangePasswordScreen.js:', contextValue);
  const { isDarkMode, theme } = contextValue;
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasLower: false,
    hasUpper: false,
    hasNumber: false,
    hasSpecial: false,
    isLongEnough: false,
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    startAnimations();
  }, []);

  useEffect(() => {
    checkPasswordStrength();
  }, [newPassword]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const checkPasswordStrength = () => {
    const strength = {
      hasLower: /[a-z]/.test(newPassword),
      hasUpper: /[A-Z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
      isLongEnough: newPassword.length >= 8,
    };
    
    let score = 0;
    if (strength.isLongEnough) score += 1;
    if (strength.hasLower && strength.hasUpper) score += 1;
    if (strength.hasNumber) score += 1;
    if (strength.hasSpecial) score += 1;
    
    setPasswordStrength({ ...strength, score });
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength.score) {
      case 0: return '#f44336';
      case 1: return '#ff9800';
      case 2: return '#ffc107';
      case 3: return '#4caf50';
      case 4: return '#2196f3';
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

  const validateForm = () => {
    if (!currentPassword.trim()) {
      Alert.alert('Error', 'Please enter your current password');
      return false;
    }
    
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return false;
    }
    
    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return false;
    }
    
    if (!passwordStrength.hasNumber) {
      Alert.alert('Error', 'New password must contain at least one number');
      return false;
    }
    
    if (!passwordStrength.hasUpper) {
      Alert.alert('Error', 'New password must contain at least one uppercase letter');
      return false;
    }
    
    if (!passwordStrength.hasSpecial) {
      Alert.alert('Error', 'New password must contain at least one special character');
      return false;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return false;
    }
    
    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return false;
    }
    
    return true;
  };

  const handleChangePassword = async () => {
    if (!validateForm()) return;

    setLoading(true);
    haptics.impactMedium();

    try {
      const response = await userAPI.changePassword({
        currentPassword,
        newPassword,
      });

      if (response.data.success) {
        haptics.notificationSuccess();
        Alert.alert(
          'Success!',
          'Your password has been changed successfully. Please login again with your new password.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await logout();
                navigation.replace('Login');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      const errorMsg = error.response?.data?.error || 'Failed to change password';
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={isDarkMode ? ['#000000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32', '#43a047']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.headerSubtitle}>
          Update your password to keep your account secure
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
       <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Current Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <MaterialIcons name="lock-outline" size={20} color={theme.subText} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter current password"
                placeholderTextColor={theme.subText}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                <Ionicons name={showCurrentPassword ? 'eye-off' : 'eye'} size={20} color={theme.subText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>New Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <MaterialIcons name="lock" size={20} color={theme.subText} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter new password"
                placeholderTextColor={theme.subText}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={20} color={theme.subText} />
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {newPassword.length > 0 && (
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

            {/* Password Requirements */}
            <View style={[styles.requirementsContainer, { backgroundColor: theme.surface }]}>
              <Text style={[styles.requirementsTitle, { color: theme.subText }]}>Password must contain:</Text>
              <View style={styles.requirementItem}>
                <MaterialIcons
                  name={passwordStrength.isLongEnough ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={passwordStrength.isLongEnough ? theme.success : theme.subText}
                />
                <Text style={[styles.requirementText, { color: theme.subText }]}>At least 8 characters</Text>
              </View>
              <View style={styles.requirementItem}>
                <MaterialIcons
                  name={passwordStrength.hasUpper && passwordStrength.hasLower ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={passwordStrength.hasUpper && passwordStrength.hasLower ? theme.success : theme.subText}
                />
                <Text style={[styles.requirementText, { color: theme.subText }]}>Uppercase and lowercase letters</Text>
              </View>
              <View style={styles.requirementItem}>
                <MaterialIcons
                  name={passwordStrength.hasNumber ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={passwordStrength.hasNumber ? theme.success : theme.subText}
                />
                <Text style={[styles.requirementText, { color: theme.subText }]}>At least one number</Text>
              </View>
              <View style={styles.requirementItem}>
                <MaterialIcons
                  name={passwordStrength.hasSpecial ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={passwordStrength.hasSpecial ? theme.success : theme.subText}
                />
                <Text style={[styles.requirementText, { color: theme.subText }]}>At least one special character</Text>
              </View>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Confirm New Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <MaterialIcons name="lock-outline" size={20} color={theme.subText} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Confirm new password"
                placeholderTextColor={theme.subText}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={theme.subText} />
              </TouchableOpacity>
            </View>

            {/* Password Match Indicator */}
            {confirmPassword.length > 0 && (
              <View style={styles.matchContainer}>
                <MaterialIcons
                  name={newPassword === confirmPassword ? 'check-circle' : 'error'}
                  size={16}
                  color={newPassword === confirmPassword ? theme.success : theme.error}
                />
                <Text
                  style={[
                    styles.matchText,
                    { color: newPassword === confirmPassword ? theme.success : theme.error },
                  ]}
                >
                  {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              </View>
            )}
          </View>

          {/* Security Tips */}
          <View style={[styles.tipsCard, { backgroundColor: theme.card }]}>
            <View style={styles.tipsHeader}>
              <MaterialIcons name="security" size={20} color={theme.success} />
              <Text style={[styles.tipsTitle, { color: theme.text }]}>Security Tips</Text>
            </View>
            <View style={styles.tipItem}>
              <MaterialIcons name="check" size={16} color={theme.success} />
              <Text style={[styles.tipText, { color: theme.subText }]}>Use a unique password you haven't used before</Text>
            </View>
            <View style={styles.tipItem}>
              <MaterialIcons name="check" size={16} color={theme.success} />
              <Text style={[styles.tipText, { color: theme.subText }]}>Don't share your password with anyone</Text>
            </View>
            <View style={styles.tipItem}>
              <MaterialIcons name="check" size={16} color={theme.success} />
              <Text style={[styles.tipText, { color: theme.subText }]}>Consider using a password manager</Text>
            </View>
          </View>

          {/* Update Button */}
          <TouchableOpacity
            style={[styles.updateButton, loading && styles.updateButtonDisabled]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            <LinearGradient colors={isDarkMode ? ['#333', '#555'] : ['#4CAF50', '#2E7D32']} style={styles.updateButtonGradient}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="lock-reset" size={20} color="#fff" />
                  <Text style={styles.updateButtonText}>Update Password</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
       </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  keyboardView: {
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 15,
    gap: 10,
  },
  inputIcon: {
    marginRight: 5,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  strengthContainer: {
    marginTop: 10,
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
  requirementsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  requirementText: {
    fontSize: 12,
    color: '#666',
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  matchText: {
    fontSize: 12,
  },
  tipsCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  updateButton: {
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
