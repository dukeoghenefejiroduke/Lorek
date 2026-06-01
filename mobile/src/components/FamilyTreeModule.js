// components/FamilyTreeModule.js
import React, { useState, useContext } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Animated 
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LanguageContext } from '../context/LanguageContext';

const kinshipData = {
  paternal: {
    title: "Dau-asain (Paternal)",
    description: "Lineage through your Father",
    color: "#2196F3",
    members: [
      { relation: "Grandfather", term: "Dau-idei", literal: "Father's Father", audioUrl: null },
      { relation: "Grandmother", term: "Dau-iyene", literal: "Father's Mother", audioUrl: null },
      { relation: "Uncle (Elder)", term: "Dau-asau", literal: "Father's Elder Brother", audioUrl: null },
      { relation: "Uncle (Younger)", term: "Dau-tari", literal: "Father's Younger Brother", audioUrl: null },
      { relation: "Aunt", term: "Dau-tua", literal: "Father's Sister", audioUrl: null },
      { relation: "Cousin", term: "Dau-omo", literal: "Father's Child", audioUrl: null },
    ]
  },
  maternal: {
    title: "Yene-asain (Maternal)",
    description: "Lineage through your Mother",
    color: "#E91E63",
    members: [
      { relation: "Grandfather", term: "Yene-idei", literal: "Mother's Father", audioUrl: null },
      { relation: "Grandmother", term: "Yene-iyene", literal: "Mother's Mother", audioUrl: null },
      { relation: "Uncle", term: "Yene-asau", literal: "Mother's Brother", audioUrl: null },
      { relation: "Aunt (Elder)", term: "Yene-tua", literal: "Mother's Elder Sister", audioUrl: null },
      { relation: "Aunt (Younger)", term: "Yene-keme", literal: "Mother's Younger Sister", audioUrl: null },
      { relation: "Cousin", term: "Yene-omo", literal: "Mother's Child", audioUrl: null },
    ]
  }
};

export default function FamilyTreeModule({ expanded = true }) {
  const { activeLanguage } = useContext(LanguageContext);
  const [activeSide, setActiveSide] = useState('paternal');
  const [selectedMember, setSelectedMember] = useState(null);
  const [scaleAnim] = useState(new Animated.Value(1));

  const data = kinshipData[activeSide];

  const handleMemberPress = (member) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    setSelectedMember(selectedMember?.relation === member.relation ? null : member);
  };

  return (
    <View style={styles.container}>
      <View style={styles.toggleWrapper}>
        <TouchableOpacity 
          style={[styles.sideBtn, activeSide === 'paternal' && styles.activeSideBtn]} 
          onPress={() => setActiveSide('paternal')}
        >
          <Icon name="people" size={20} color={activeSide === 'paternal' ? '#fff' : '#666'} />
          <Text style={[styles.sideText, activeSide === 'paternal' && styles.activeSideText]}>
            Father's Side
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sideBtn, activeSide === 'maternal' && styles.activeSideBtn]} 
          onPress={() => setActiveSide('maternal')}
        >
          <Icon name="favorite" size={20} color={activeSide === 'maternal' ? '#fff' : '#666'} />
          <Text style={[styles.sideText, activeSide === 'maternal' && styles.activeSideText]}>
            Mother's Side
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.treeHeader, { borderBottomColor: data.color }]}>
        <Text style={styles.sideTitle}>{data.title}</Text>
        <Text style={styles.sideSub}>{data.description}</Text>
      </View>

      <ScrollView style={styles.treeContainer} showsVerticalScrollIndicator={false}>
        {data.members.map((member, index) => (
          <Animated.View 
            key={index} 
            style={[
              styles.node,
              selectedMember?.relation === member.relation && styles.nodeSelected,
              { transform: [{ scale: selectedMember?.relation === member.relation ? scaleAnim : 1 }] }
            ]}
          >
            <View style={[styles.connector, { backgroundColor: data.color }]} />
            <TouchableOpacity 
              style={styles.card}
              onPress={() => handleMemberPress(member)}
              activeOpacity={0.7}
            >
              <Text style={[styles.relationLabel, { color: data.color }]}>
                {member.relation}
              </Text>
              <Text style={styles.izonTerm}>{member.term}</Text>
              <Text style={styles.literalText}>{member.literal}</Text>
              
              {selectedMember?.relation === member.relation && (
                <Animated.View style={styles.expandedInfo}>
                  <View style={styles.divider} />
                  <View style={styles.extraInfo}>
                    <Text style={styles.extraTitle}>Cultural Note</Text>
                    <Text style={styles.extraText}>
                      In {activeLanguage?.name || 'Izon'} culture, the extended family plays a crucial role in raising children. 
                      The term for {member.relation} ({member.term}) reflects deep respect and 
                      specific familial obligations.
                    </Text>
                    {member.audioUrl && (
                      <TouchableOpacity style={styles.audioButton}>
                        <Icon name="volume-up" size={20} color={data.color} />
                        <Text style={[styles.audioText, { color: data.color }]}>
                          Hear pronunciation
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Animated.View>
              )}
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  toggleWrapper: { 
    flexDirection: 'row', 
    padding: 15, 
    justifyContent: 'center',
    gap: 10,
  },
  sideBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    backgroundColor: '#e0e0e0', 
    borderRadius: 25, 
    marginHorizontal: 5 
  },
  activeSideBtn: { 
    backgroundColor: '#1a73e8' 
  },
  sideText: { 
    fontWeight: '600', 
    color: '#666' 
  },
  activeSideText: { 
    color: '#fff' 
  },
  treeHeader: { 
    alignItems: 'center', 
    marginVertical: 10,
    paddingBottom: 15,
    borderBottomWidth: 3,
    marginHorizontal: 20,
  },
  sideTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  sideSub: { 
    fontSize: 14, 
    color: '#888',
    marginTop: 4,
  },
  treeContainer: { 
    padding: 20,
    paddingTop: 10,
  },
  node: { 
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nodeSelected: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  connector: { 
    width: 4, 
    height: '100%', 
    position: 'absolute', 
    left: 0, 
    borderRadius: 2,
    zIndex: 1,
  },
  card: { 
    backgroundColor: '#fff', 
    padding: 15, 
    paddingLeft: 25,
    borderRadius: 12, 
    flex: 1, 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 2,
  },
  relationLabel: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  izonTerm: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#222', 
    marginVertical: 2 
  },
  literalText: { 
    fontSize: 13, 
    color: '#666', 
    fontStyle: 'italic' 
  },
  expandedInfo: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginBottom: 12,
  },
  extraInfo: {
    gap: 8,
  },
  extraTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  extraText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
  },
  audioText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
