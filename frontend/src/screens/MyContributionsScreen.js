import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext, lightTheme } from '../context/ThemeContext';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { communityAPI } from '../services/api';

const MyContributionsScreen = () => {
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in MyContributionsScreen.js:', contextValue);
  const { theme } = contextValue;
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyContributions();
  }, []);

  const fetchMyContributions = async () => {
    try {
      setLoading(true);
      const res = await communityAPI.getMyContributions();
      if (res.data.success) {
        setContributions(res.data.data);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load your contributions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return theme.success;
      case 'rejected': return theme.error;
      default: return theme.warning;
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.info}>
        <Text style={[styles.type, { color: theme.subText }]}>{item.type.toUpperCase()}</Text>
        <Text style={[styles.text, { color: theme.text }]}>{item.data.text || 'Audio Contribution'}</Text>
        <Text style={[styles.date, { color: theme.subText }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
        <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
      </View>
    </View>
  );

  if (loading) return <ActivityIndicator style={[styles.loader, { marginTop: 50 }]} size="large" color={theme.primary} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>My Contributions</Text>
      <FlatList
        data={contributions}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.subText }]}>No contributions yet.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  card: { padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  info: { flex: 1 },
  type: { fontSize: 12, fontWeight: 'bold' },
  text: { fontSize: 16, marginVertical: 4 },
  date: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 50 }
});

export default MyContributionsScreen;
