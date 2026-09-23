import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../../context/ThemeContext';
import ScreenHeader from '../../components/ScreenHeader';
import api from '../../services/api';

const CourseScreen = ({ navigation }) => {
  const { theme } = useContext(ThemeContext);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await api.get('/content/hierarchy');
      setCourses(response.data.data);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCourseCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('UnitScreen', { course: item })}
    >
      <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.cardGradient}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDescription}>{item.description}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator style={styles.centered} size="large" color={theme.accent} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Courses" onBackPress={() => navigation.goBack()} />
      <FlatList
        data={courses}
        renderItem={renderCourseCard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center' },
  list: { padding: 20 },
  card: { borderRadius: 15, marginBottom: 15, overflow: 'hidden', elevation: 3 },
  cardGradient: { padding: 20 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  cardDescription: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 5 },
});

export default CourseScreen;
