import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { adminAPI, contentAPI } from '../../services/api';
import { ThemeContext } from '../../context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';

export default function ContentStudioScreen() {
    const { theme } = useContext(ThemeContext) || {};
    const [hierarchy, setHierarchy] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadHierarchy();
    }, []);

    const loadHierarchy = async () => {
        setLoading(true);
        try {
            const res = await contentAPI.getHierarchy();
            setHierarchy(res.data.data || []);
        } catch (e) {
            console.error('Failed to load hierarchy', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
            <Text style={[styles.title, { color: theme.text }]}>Content Studio & Hierarchy</Text>
            
            {loading ? (
                <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
            ) : hierarchy.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.subText }]}>No courses found in hierarchy.</Text>
            ) : (
                hierarchy.map(course => (
                    <View key={course._id} style={[styles.courseItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.courseHeader}>
                            <MaterialIcons name="school" size={20} color="#4CAF50" />
                            <Text style={[styles.courseTitle, { color: theme.text }]}>{course.title?.english || course.title}</Text>
                        </View>
                        {course.sections?.map(section => (
                            <View key={section._id} style={[styles.sectionItem, { borderColor: theme.border }]}>
                                <MaterialIcons name="folder" size={16} color="#2196F3" />
                                <Text style={[styles.sectionText, { color: theme.subText }]}>{section.title?.english || section.title}</Text>
                            </View>
                        ))}
                    </View>
                ))
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    courseItem: { padding: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, elevation: 2 },
    courseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    courseTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
    sectionItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 24, marginTop: 8, paddingVertical: 4 },
    sectionText: { fontSize: 14, marginLeft: 8 },
    emptyText: { textAlign: 'center', fontStyle: 'italic', marginTop: 20 }
});
