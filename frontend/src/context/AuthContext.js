import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, apiUtils } from '../services/api';
import * as Crypto from 'expo-crypto';
import haptics from '../utils/haptics';
import { Platform, AppState, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const AuthContext = createContext();

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days
const TOKEN_REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [networkStatus, setNetworkStatus] = useState(true);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  
  // Refs for timers
  const refreshTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    initializeAuth();
    const unsubscribeNetwork = setupNetworkListener();
    const unsubscribeAppState = setupAppStateListener();
    checkBiometricSupport();

    return () => {
      clearTimers();
      unsubscribeNetwork();
      unsubscribeAppState();
    };
  }, []); // Run only once on mount

  useEffect(() => {
    if (isAuthenticated && sessionExpiry) {
      scheduleTokenRefresh(sessionExpiry);
      validateSession();
    }
  }, [isAuthenticated, sessionExpiry]);

  // Clear all timers on unmount
  const clearTimers = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
    }
  };

const refreshUser = async () => {
  try {
    const response = await authAPI.getProfile(); // Assuming you have a /me or /profile endpoint
    const updatedUser = response.data.data || response.data;
    
    // Save the fresh data so it persists on reload
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  } catch (error) {
    console.error('Failed to refresh user stats:', error);
  }
};

  // Initialize authentication
  const initializeAuth = async () => {
    try {
      await checkAuth();
      await loadSecuritySettings();
    } catch (error) {
      console.error('Auth initialization failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load security settings from storage
  const loadSecuritySettings = async () => {
    try {
      const results = await AsyncStorage.multiGet(['loginAttempts', 'lockoutUntil', 'biometricEnabled']);
      const attempts = results[0][1];
      const lockout = results[1][1];
      const biometric = results[2][1];
      
      if (attempts) setLoginAttempts(parseInt(attempts));
      if (lockout) setLockoutUntil(parseInt(lockout));
      if (biometric) setBiometricEnabled(biometric === 'true');
    } catch (error) {
      console.error('Failed to load security settings:', error);
    }
  };

  // Check if device supports biometric authentication
  const checkBiometricSupport = async () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      
      // It's helpful to know if hardware exists even if not enrolled
      setBiometricAvailable(compatible && types.length > 0);
      // You should only allow "Enable Biometric" if enrolled is true
    } catch (error) {
      console.error('Biometric check failed:', error);
    }
  }
};


  // Setup network connectivity listener
  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected;
      setNetworkStatus(isConnected);
      
      if (isConnected && !isAuthenticated) {
        // Try to restore session if we're offline and now online
        restoreSession();
      }
    });
    
    return unsubscribe;
  };

  // Setup app state listener (foreground/background)
  const setupAppStateListener = () => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  };

  // Handle app state changes
  const handleAppStateChange = async (nextAppState) => {
    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground
      await validateSession();
    }
    appStateRef.current = nextAppState;
  };

  // Validate session when app comes to foreground
  const validateSession = async () => {
    if (!user || !sessionExpiry) return;
    
    const now = Date.now();
    if (now > sessionExpiry) {
      // Session expired
      await handleSessionExpired();
    } else if (sessionExpiry - now < TOKEN_REFRESH_INTERVAL) {
      // Session about to expire, refresh token
      await refreshAuthToken();
    }
  };

  // Handle session expiration
  const handleSessionExpired = async () => {
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please login again.',
      [{ text: 'OK', onPress: () => logout() }]
    );
  };

  // Check authentication status
  const checkAuth = async () => {
    try {
      const keys = ['token', 'refreshToken', 'user', 'sessionExpiry'];
      const results = await AsyncStorage.multiGet(keys);
      
      const token = results[0][1];
      const refreshToken = results[1][1];
      const userData = results[2][1];
      const expiry = results[3][1];
      
      if (token && userData && expiry) {
        const parsedExpiry = parseInt(expiry);
        
        // Check if session is still valid
        if (Date.now() < parsedExpiry) {
          try {
            setUser(JSON.parse(userData));
            setIsAuthenticated(true);
            setSessionExpiry(parsedExpiry);
            
            // Schedule token refresh
            scheduleTokenRefresh(parsedExpiry);
            
            // Validate token with server (optional, can be done in background)
            validateTokenWithServer();
          } catch (e) {
            console.error('Failed to parse user data from storage:', e);
            await clearAuthData();
          }
        } else {
          // Session expired, try to refresh
          if (refreshToken) {
            await refreshAuthToken(refreshToken);
          } else {
            await clearAuthData();
          }
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  // Validate token with server
  const validateTokenWithServer = async () => {
    try {
      await authAPI.validateToken();
    } catch (error) {
      if (error.type === 'UNAUTHORIZED') {
        await refreshAuthToken();
      }
    }
  };

  // Refresh authentication token

const refreshAuthToken = async (manualToken) => {
  try {
    // 1. Get the best available refresh token
    const refreshToken = manualToken || await AsyncStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      if (isAuthenticated) await logout(); 
      return null;
    }

    // 2. Call the API (Ensure your authAPI.refreshToken sends { refreshToken } in the body)
    const response = await authAPI.refreshToken({ refreshToken });

    if (response?.data?.success) {
      const { token: newToken, refreshToken: newRefreshToken } = response.data;
      
      // Use the 'expiresIn' from server or default to your constant
      const expiresIn = response.data.expiresIn || (SESSION_TIMEOUT / 1000);
      const newExpiry = Date.now() + (expiresIn * 1000);

      // 3. Update Storage
      await AsyncStorage.multiSet([
        ['token', newToken],
        ['refreshToken', newRefreshToken],
        ['sessionExpiry', newExpiry.toString()]
      ]);

      // 4. Update State
      setUser(prev => ({ ...prev })); // Trigger a shallow re-render if needed
      setIsAuthenticated(true);
      setSessionExpiry(newExpiry);
      
      // 5. Reschedule the next silent refresh
      scheduleTokenRefresh(newExpiry);
      
      
      return newToken;
    }
    return null;
  } catch (error) {
    // 429 means "Wait", not "Log out"
    if (error.status === 429 || error.response?.status === 429) {
      console.warn("⚠️ Rate limit hit. Keeping session alive for retry.");
      throw error; 
    }

    // If it's a 401 or invalid token, the party is over.
    console.error('🚨 Refresh failed:', error.message);
    await logout();
    return null;
  }
};


  // Schedule automatic token refresh
  const scheduleTokenRefresh = (expiry) => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    
    const now = Date.now();
    const timeUntilRefresh = expiry - now - (5 * 60 * 1000); // Refresh 5 minutes before expiry
    
    if (timeUntilRefresh > 0) {
      refreshTimerRef.current = setTimeout(async () => {
        await refreshAuthToken();
      }, timeUntilRefresh);
    }
  };

  // Clear all authentication data
  const clearAuthData = async () => {
    try {
      await AsyncStorage.multiRemove([
        'token',
        'refreshToken',
        'user',
        'sessionExpiry',
        'loginAttempts',
        'lockoutUntil'
      ]);
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setSessionExpiry(null);
      clearTimers();
    }
  };

  // Restore session after network reconnection
  const restoreSession = async () => {
    const token = await AsyncStorage.getItem('token');
    const userData = await AsyncStorage.getItem('user');
    
    if (token && userData && !user) {
      setUser(JSON.parse(userData));
      setIsAuthenticated(true);
    }
  };

  // Check if account is locked
  const isAccountLocked = () => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingMinutes = Math.ceil((lockoutUntil - Date.now()) / 60000);
      return { locked: true, remaining: remainingMinutes };
    }
    return { locked: false };
  };

  // Handle login attempts
  const handleLoginAttempt = async (success) => {
    if (success) {
      // Reset login attempts on successful login
      setLoginAttempts(0);
      setLockoutUntil(null);
      await AsyncStorage.multiRemove(['loginAttempts', 'lockoutUntil']);
    } else {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      await AsyncStorage.setItem('loginAttempts', newAttempts.toString());
      
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockoutTime = Date.now() + LOCKOUT_DURATION;
        setLockoutUntil(lockoutTime);
        await AsyncStorage.setItem('lockoutUntil', lockoutTime.toString());
        
        // Provide haptic feedback for lockout
        haptics.notificationWarning();
      }
    }
  };

  // Enhanced login with security features
  const login = async (email, password, rememberMe = true) => {
    console.log('🔑 AuthContext.login called for:', email);
    
    // Check if account is locked
    const lockStatus = isAccountLocked();
    if (lockStatus.locked) {
      console.log('🔒 Account locked');
      return { 
        success: false, 
        error: `Too many failed attempts. Please try again in ${lockStatus.remaining} minutes.`,
        locked: true
      };
    }

    // Check network status
    console.log('🌐 Network status:', networkStatus);
    if (!networkStatus) {
      console.log('🚫 Offline');
      return { 
        success: false, 
        error: 'No internet connection. Please check your network.',
        offline: true
      };
    }

    try {
      console.log('📡 Attempting authAPI.login...');
      const response = await authAPI.login({ email, password });
      console.log('✅ authAPI.login success, full response.data:', JSON.stringify(response.data, null, 2));
      
      const { user, token, refreshToken } = response.data.data;
      const expiresIn = 3600; // Default if not provided in data
      
      const sessionExpiry = Date.now() + (expiresIn * 1000);
      
      // Store auth data
      const storageItems = [
        ['sessionExpiry', sessionExpiry.toString()]
      ];

      if (token) storageItems.push(['token', token]);
      if (refreshToken) storageItems.push(['refreshToken', refreshToken]);
      if (user) storageItems.push(['user', JSON.stringify(user)]);

      await AsyncStorage.multiSet(storageItems);
      
      // Ensure removal if missing
      if (!token) await AsyncStorage.removeItem('token');
      if (!refreshToken) await AsyncStorage.removeItem('refreshToken');
      if (!user) await AsyncStorage.removeItem('user');
      
      if (rememberMe) {
        await AsyncStorage.setItem('rememberedEmail', email);
      } else {
        await AsyncStorage.removeItem('rememberedEmail');
      }
      
      setUser(user);
      console.log('DEBUG: AuthContext setUser called (login block) with:', user?.username);
      setIsAuthenticated(true);
      console.log('DEBUG: AuthContext isAuthenticated set to true (login block)');
      setSessionExpiry(sessionExpiry);
      
      // Reset login attempts on success
      await handleLoginAttempt(true);
      
      // Schedule token refresh
      scheduleTokenRefresh(sessionExpiry);
      
      // Provide haptic feedback
      haptics.notificationSuccess();
      
      return { success: true, user };
    } catch (error) {
      console.error('❌ AuthContext.login error:', error);
      // Handle failed login attempt
      await handleLoginAttempt(false);
      
      // Provide haptic feedback for error
      haptics.notificationError();
      
      return { 
        success: false, 
        error: error.message || 'Login failed. Please check your credentials.',
        attempts: loginAttempts + 1,
        maxAttempts: MAX_LOGIN_ATTEMPTS
      };
    }
  };

  // Enhanced registration with validation
  const register = async (userData) => {
    // Validate input
    if (!userData.username || userData.username.trim().length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long.' };
    }

    if (!userData.email || !/^\S+@\S+\.\S+$/.test(userData.email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    
    if (!userData.password || userData.password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }
    
    if (!/[A-Z]/.test(userData.password)) {
      return { success: false, error: 'Password must contain at least one uppercase letter.' };
    }
    
    if (!/[0-9]/.test(userData.password)) {
      return { success: false, error: 'Password must contain at least one number.' };
    }

    // Check network status
    if (!networkStatus) {
      return { 
        success: false, 
        error: 'No internet connection. Please check your network.',
        offline: true
      };
    }

    try {
      const response = await authAPI.register({
        ...userData,
        email: userData.email,
        password: userData.password,
        acceptTerms: userData.acceptTerms,
        platform: Platform.OS,
        appVersion: '1.0.4'
      });
      
      const { user, token, refreshToken } = response.data.data;
      const expiresIn = 3600; // Default if not provided
      const sessionExpiry = Date.now() + (expiresIn * 1000);
      
      // Store auth data
      const storageItems = [
        ['sessionExpiry', sessionExpiry.toString()]
      ];

      if (token) storageItems.push(['token', token]);
      if (refreshToken) storageItems.push(['refreshToken', refreshToken]);
      if (user) storageItems.push(['user', JSON.stringify(user)]);

      await AsyncStorage.multiSet(storageItems);
      
      // Ensure removal if missing
      if (!token) await AsyncStorage.removeItem('token');
      if (!refreshToken) await AsyncStorage.removeItem('refreshToken');
      if (!user) await AsyncStorage.removeItem('user');
      
      setUser(user);
      setIsAuthenticated(true);
      console.log('DEBUG: AuthContext isAuthenticated set to true (register block)');
      setSessionExpiry(sessionExpiry);
      
      // Schedule token refresh
      scheduleTokenRefresh(sessionExpiry);
      
      // Provide haptic feedback
      haptics.notificationSuccess();
      
      return { success: true, user };
    } catch (error) {
      // Provide haptic feedback for error
      haptics.notificationError();
      
      let errorMessage = 'Registration failed. Please try again.';
      if (error.response && error.response.data && error.response.data.errors) {
        // Handle validation errors from backend
        errorMessage = error.response.data.errors.map(e => e.message).join(', ');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  // Enhanced logout with cleanup
  const logout = useCallback(async () => {
    try {
      // Notify server about logout (optional)
      if (networkStatus) {
        await authAPI.logout().catch(() => {});
      }
      
      // Clear all auth data
      await clearAuthData();
      
      // Clear API cache
      apiUtils.clearCache();
      
      // Provide haptic feedback
      haptics.impactMedium();
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local data even if server logout fails
      await clearAuthData();
    }
  }, [networkStatus]);

  // Biometric authentication
  const authenticateWithBiometric = async () => {
    if (!biometricAvailable) {
      return { success: false, error: 'Biometric authentication not available' };
    }

    try {
      // Implement biometric authentication here
      // This would use expo-local-authentication
      
      // If successful, retrieve stored credentials and login
      const email = await AsyncStorage.getItem('biometricEmail');
      const password = await SecureStore.getItemAsync('biometricPassword');
      
      if (email && password) {
        return await login(email, password, true);
      }
      
      return { success: false, error: 'No biometric credentials stored' };
    } catch (error) {
      return { success: false, error: 'Biometric authentication failed' };
    }
  };

  // Enable biometric login
  const enableBiometric = async (email, password) => {
    try {
      // Store credentials securely
      await AsyncStorage.setItem('biometricEmail', email);
      await SecureStore.setItemAsync('biometricPassword', password);
      await AsyncStorage.setItem('biometricEnabled', 'true');
      
      setBiometricEnabled(true);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to enable biometric login' };
    }
  };

  // Disable biometric login
  const disableBiometric = async () => {
    try {
      await AsyncStorage.multiRemove(['biometricEmail', 'biometricPassword', 'biometricEnabled']);
      setBiometricEnabled(false);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to disable biometric login' };
    }
  };

  // Update user profile
  const updateUserProfile = async (userData) => {
    try {
      const response = await authAPI.updateProfile(userData);
      const updatedUser = response.data.user;
      
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      return { success: true, user: updatedUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const hashedCurrent = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        currentPassword
      );
      
      await authAPI.changePassword({ currentPassword, newPassword });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Forgot password
  const forgotPassword = async (email) => {
    try {
      await authAPI.forgotPassword({ email });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Reset password with token
  const resetPassword = async (token, newPassword) => {
    try {
      
      await authAPI.resetPassword({ token, password: newPassword });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Get remembered email for login screen
  const getRememberedEmail = async () => {
    return await AsyncStorage.getItem('rememberedEmail');
  };

  // Get session status
  const getSessionStatus = () => {
    if (!sessionExpiry) return { valid: false };
    
    const now = Date.now();
    const timeLeft = sessionExpiry - now;
    
    return {
      valid: timeLeft > 0,
      expiresIn: Math.max(0, Math.floor(timeLeft / 1000)), // seconds
      expiresInMinutes: Math.max(0, Math.floor(timeLeft / 60000)),
      isExpired: timeLeft <= 0,
      willExpireSoon: timeLeft > 0 && timeLeft < TOKEN_REFRESH_INTERVAL
    };
  };

const getApiKeys = async () => {
  try {
    const response = await authAPI.getApiKeys();
    return response;
  } catch (error) {
    console.error('Failed to get API keys:', error);
    throw error;
  }
};

const generateApiKey = async (name) => {
  try {
    const response = await authAPI.generateApiKey({ name });
    return response;
  } catch (error) {
    console.error('Failed to generate API key:', error);
    throw error;
  }
};

const revokeApiKey = async (keyId) => {
  try {
    const response = await authAPI.revokeApiKey(keyId);
    return response;
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    throw error;
  }
};


  // Google authentication
  const googleLogin = async (token, profile) => {
    try {
      const response = await authAPI.googleAuth({ token, profile });
      const { token: accessToken, refreshToken, user, expiresIn } = response.data;
      
      const sessionExpiry = Date.now() + (expiresIn * 1000);
      
      // Store auth data
      await AsyncStorage.multiSet([
        ['token', accessToken],
        ['refreshToken', refreshToken],
        ['user', JSON.stringify(user)],
        ['sessionExpiry', sessionExpiry.toString()]
      ]);
      
      setUser(user);
      setIsAuthenticated(true);
      setSessionExpiry(sessionExpiry);
      
      // Schedule token refresh
      scheduleTokenRefresh(sessionExpiry);
      
      // Provide haptic feedback
      haptics.notificationSuccess();
      
      return { success: true, user };
    } catch (error) {
      console.error('Google login error:', error);
      
      haptics.notificationError();
      
      return { 
        success: false, 
        error: error.message || 'Google authentication failed.'
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        // State
        user,
        loading,
        isAuthenticated,
        networkStatus,
        biometricAvailable,
        biometricEnabled,
        loginAttempts,
        maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
        isAccountLocked: isAccountLocked(),
        
        // Auth methods
        login,
        register,
        googleLogin,
        logout,
        updateUserProfile,
        updateUser: updateUserProfile,
        changePassword,
        forgotPassword,
        resetPassword,
        
        // Biometric methods
        authenticateWithBiometric,
        enableBiometric,
        disableBiometric,
        
        // Utility methods
        getRememberedEmail,
        getSessionStatus,
        refreshAuthToken,
        
        // Session info
        sessionExpiry,
        
        getApiKeys,
        generateApiKey,
        revokeApiKey,
        
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


//Add this to AuthContext.js
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};