import React, { useState, useEffect } from 'react';
import { ThemeContext, lightTheme as theme } from '../context/ThemeContext';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { communityAPI } from '../services/api';
import { Ionicons } from '@expo/vector-icons';

const MyContributionsScreen = () => {
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

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.type}>{item.type.toUpperCase()}</Text>
        <Text style={styles.text}>{item.data.text || 'Audio Contribution'}</Text>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
        <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
      </View>
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#4CAF50';
      case 'rejected': return '#F44336';
      default: return '#FF9800';
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#4CAF50" />;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Contributions</Text>
      <FlatList
        data={contributions}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No contributions yet.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  loader: { marginTop: 50 },
  card: { backgroundColor: theme.card, padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  info: { flex: 1 },
  type: { fontSize: 12, color: theme.subText, fontWeight: 'bold' },
  text: { fontSize: 16, marginVertical: 4 },
  date: { fontSize: 12, color: '#999' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' }
});

export default MyContributionsScreen;
