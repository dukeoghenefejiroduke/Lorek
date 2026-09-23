import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { ThemeContext } from '../../context/ThemeContext';
import ScreenHeader from '../../components/ScreenHeader';
import { lessonAPI } from '../../services/api';

const UnitScreen = ({ navigation, route }) => {
  const { course } = route.params;
  const { theme } = useContext(ThemeContext);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Flatten hierarchy: Course -> Sections -> Units
    if (course && course.sections) {
      const allUnits = course.sections.flatMap(section => section.units);
      setUnits(allUnits);
    }
  }, [course]);

  const renderUnitCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('Lessons', { unitId: item._id })}
    >
      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator style={styles.centered} size="large" color={theme.accent} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Units" onBackPress={() => navigation.goBack()} />
      <FlatList
        data={units}
        renderItem={renderUnitCard}
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
  card: { padding: 20, borderRadius: 15, marginBottom: 15, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
});

export default UnitScreen;
