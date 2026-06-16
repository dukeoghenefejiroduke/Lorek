import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleLoginButton({ type = 'login' }) {
  const { googleLogin } = useAuth();
  const [loading, setLoading] = useState(false);

  // NOTE: You must configure your Client IDs in the Google Cloud Console
  // and update these placeholders.
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: '299491860065-8f5l0idc7t5m7bngu2ruo698gcs70892.apps.googleusercontent.com', // Lorek andriod
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleAuth(authentication.accessToken, authentication.idToken);
    }
  }, [response]);

  const handleGoogleAuth = async (accessToken, idToken) => {
    setLoading(true);
    try {
      // Fetch user profile from Google using the access token
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = await userInfoResponse.json();

      await googleLogin(idToken, profile);
    } catch (error) {
      console.error('Google Auth Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => promptAsync()}
      disabled={!request || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Ionicons name="logo-google" size={20} color="#fff" style={styles.icon} />
          <Text style={styles.text}>{type === 'login' ? 'Sign in with Google' : 'Sign up with Google'}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    backgroundColor: '#DB4437',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
