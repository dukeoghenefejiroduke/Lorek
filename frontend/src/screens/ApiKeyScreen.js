import SafeAreaContainer from '../components/SafeAreaContainer';
import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  Clipboard,
  Share,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { ThemeContext, lightTheme } from '../context/ThemeContext';

export default function ApiKeyScreen({ navigation }) {
  const { user, token } = useContext(AuthContext);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState('');

  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in ApiKeyScreen.js:', contextValue);
  const { isDarkMode, theme } = contextValue;

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getApiKeys();
      if (response.data.success) {
        setApiKeys(response.data.keys || []);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      Alert.alert('Error', 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      Alert.alert('Error', 'Please enter a name for your API key');
      return;
    }

    try {
      setGenerating(true);
      const response = await authAPI.generateApiKey({ name: newKeyName.trim() });
      
      if (response.data.success) {
        const newKey = response.data.apiKey;
        setNewlyGeneratedKey(newKey);
        setShowNewKey(true);
        setModalVisible(false);
        setNewKeyName('');
        
        // Refresh the list
        await fetchApiKeys();
      }
    } catch (error) {
      console.error('Failed to generate API key:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const revokeApiKey = (keyId) => {
    Alert.alert(
      'Revoke API Key',
      'Are you sure you want to revoke this API key? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await authAPI.revokeApiKey(keyId);
              if (response.data.success) {
                Alert.alert('Success', 'API key revoked successfully');
                fetchApiKeys();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to revoke API key');
            }
          },
        },
      ]
    );
  };

  const copyToClipboard = (key) => {
    Clipboard.setString(key);
    Alert.alert('Copied!', 'API key copied to clipboard');
  };

  const shareApiKey = async (key) => {
    try {
      await Share.share({
        message: `Your Lorek App API Key: ${key}\n\nKeep this key secure. It provides access to the Lorek API.`,
        title: 'API Key',
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const getKeyPreview = (key) => {
    if (!key) return '';
    const visible = key.slice(0, 10);
    const hidden = '*'.repeat(Math.min(key.length - 10, 20));
    return `${visible}${hidden}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderApiKeyCard = (key) => (
    <View key={key._id} style={[styles.keyCard, { backgroundColor: theme.card }]}>
      <View style={styles.keyHeader}>
        <View style={[styles.keyIcon, { backgroundColor: theme.primary + '20' }]}>
          <FontAwesome5 name="key" size={20} color={theme.primary} />
        </View>
        <View style={styles.keyInfo}>
          <Text style={[styles.keyName, { color: theme.text }]}>{key.name || 'Default Key'}</Text>
          <Text style={[styles.keyPreview, { color: theme.subText }]}>{getKeyPreview(key.key)}</Text>
        </View>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            setSelectedKey(key);
            setModalVisible(true);
          }}
        >
          <MaterialIcons name="more-vert" size={20} color={theme.subText} />
        </TouchableOpacity>
      </View>

      <View style={[styles.keyDetails, { borderTopColor: theme.border }]}>
        <View style={styles.detailRow}>
          <MaterialIcons name="schedule" size={14} color={theme.subText} />
          <Text style={[styles.detailText, { color: theme.subText }]}>
            Created: {formatDate(key.createdAt)}
          </Text>
        </View>
        {key.lastUsed && (
          <View style={styles.detailRow}>
            <MaterialIcons name="history" size={14} color={theme.subText} />
            <Text style={[styles.detailText, { color: theme.subText }]}>
              Last used: {formatDate(key.lastUsed)}
            </Text>
          </View>
        )}
        {key.expiresAt && (
          <View style={styles.detailRow}>
            <MaterialIcons name="event" size={14} color={theme.subText} />
            <Text style={[styles.detailText, { color: theme.subText }]}>
              Expires: {formatDate(key.expiresAt)}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.keyActions, { borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => copyToClipboard(key.key)}
        >
          <MaterialIcons name="content-copy" size={18} color={theme.primary} />
          <Text style={[styles.actionText, { color: theme.primary }]}>Copy</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => shareApiKey(key.key)}
        >
          <MaterialIcons name="share" size={18} color={theme.primary} />
          <Text style={[styles.actionText, { color: theme.primary }]}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.revokeButton]}
          onPress={() => revokeApiKey(key._id)}
        >
          <MaterialIcons name="delete" size={18} color={theme.error} />
          <Text style={[styles.actionText, { color: theme.error }]}>Revoke</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>API Keys</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.headerSubtitle}>
          Manage your API keys for accessing the Lorek API
        </Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <MaterialIcons name="info" size={24} color={theme.primary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: theme.text }]}>What are API Keys?</Text>
            <Text style={[styles.infoText, { color: theme.subText }]}>
              API keys allow you to access Lorek data programmatically. 
              Keep them secure and never share them publicly.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.generateButton, { backgroundColor: theme.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
          <Text style={styles.generateButtonText}>Generate New API Key</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Your API Keys</Text>

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
        ) : apiKeys.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="key" size={60} color={theme.subText} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No API Keys</Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>
              Generate your first API key to start using the Lorek API
            </Text>
          </View>
        ) : (
          apiKeys.map(renderApiKeyCard)
        )}
      </ScrollView>

      {/* Generate Key Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={isDarkMode ? ['#000000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Generate API Key</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              <Text style={[styles.modalLabel, { color: theme.text }]}>Key Name</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g., Production, Development, My App"
                placeholderTextColor={theme.subText}
                value={newKeyName}
                onChangeText={setNewKeyName}
                autoCapitalize="none"
              />
              <Text style={[styles.modalHint, { color: theme.subText }]}>
                Give your key a descriptive name to remember what it's used for
              </Text>

              <TouchableOpacity
                style={[styles.modalButton, generating && styles.buttonDisabled, { backgroundColor: theme.primary }]}
                onPress={generateApiKey}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Generate Key</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Key Display Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showNewKey}
        onRequestClose={() => setShowNewKey(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.newKeyModal, { backgroundColor: theme.card }]}>
            <LinearGradient
              colors={isDarkMode ? ['#000000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>API Key Generated!</Text>
              <TouchableOpacity onPress={() => setShowNewKey(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              <View style={styles.successIcon}>
                <MaterialIcons name="check-circle" size={60} color={theme.success} />
              </View>
              
              <Text style={[styles.warningText, { backgroundColor: theme.surface }]}>
                ⚠️ Important: This key will only be shown once!
              </Text>
              
              <View style={[styles.keyDisplay, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.keyDisplayText, { color: theme.text }]}>{newlyGeneratedKey}</Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyToClipboard(newlyGeneratedKey)}
                >
                  <MaterialIcons name="content-copy" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.keyInstructions, { color: theme.subText }]}>
                Copy and store this key securely. You won't be able to see it again.
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.copyAction, { backgroundColor: theme.primary }]}
                  onPress={() => copyToClipboard(newlyGeneratedKey)}
                >
                  <MaterialIcons name="content-copy" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Copy</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.shareAction, { backgroundColor: theme.secondary }]}
                  onPress={() => shareApiKey(newlyGeneratedKey)}
                >
                  <MaterialIcons name="share" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Share</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: theme.border }]}
                onPress={() => setShowNewKey(false)}
              >
                <Text style={[styles.doneButtonText, { color: theme.text }]}>Done</Text>
              </TouchableOpacity>
            </View>
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
  infoCard: {
    flexDirection: 'row',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
    gap: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  generateButton: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  loader: {
    marginTop: 50,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  keyCard: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  keyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  keyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  keyInfo: {
    flex: 1,
  },
  keyName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  keyPreview: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  menuButton: {
    padding: 8,
  },
  keyDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#999',
  },
  keyActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
  },
  revokeButton: {
    marginLeft: 'auto',
  },
  revokeText: {
    color: '#f44336',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
  },
  newKeyModal: {
    maxHeight: '90%',
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
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    marginBottom: 20,
  },
  modalButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 20,
  },
  warningText: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 15,
  },
  keyDisplay: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
  },
  keyDisplayText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    padding: 8,
  },
  keyInstructions: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  copyAction: {
  },
  shareAction: {
  },
  modalActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  doneButton: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});