import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { adminAPI, contentAPI } from '../../services/api';

export default function ContentStudioScreen() {
    const [hierarchy, setHierarchy] = useState([]);
    const [selectedAction, setSelectedAction] = useState(null);

    useEffect(() => {
        loadHierarchy();
    }, []);

    const loadHierarchy = async () => {
        try {
            const res = await contentAPI.getHierarchy();
            setHierarchy(res.data.data);
        } catch (e) {
            console.error('Failed to load hierarchy', e);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Content Studio</Text>
            
            <View style={styles.actions}>
                <TouchableOpacity style={styles.button} onPress={() => setSelectedAction('create_course')}>
                    <Text style={styles.buttonText}>+ Add Course</Text>
                </TouchableOpacity>
                {/* Add more admin actions here */}
            </View>

            {hierarchy.map(course => (
                <View key={course._id} style={styles.courseItem}>
                    <Text style={styles.courseTitle}>{course.title}</Text>
                    {course.sections.map(section => (
                        <View key={section._id} style={styles.sectionItem}>
                            <Text>{section.title}</Text>
                        </View>
                    ))}
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    actions: { flexDirection: 'row', marginBottom: 20 },
    button: { padding: 10, backgroundColor: '#4CAF50', borderRadius: 8, marginRight: 10 },
    buttonText: { color: '#fff' },
    courseItem: { padding: 15, backgroundColor: '#f0f0f0', marginBottom: 10, borderRadius: 10 },
    sectionItem: { marginLeft: 20, marginTop: 5 }
});
