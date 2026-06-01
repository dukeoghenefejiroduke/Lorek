import React, { useEffect, useState, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import haptics from "../utils/haptics";
import { notificationAPI } from '../services/api';

const STORAGE_KEY = 'learningReminderSettings';

const DAYS = [
  { id: 'mon', label: 'M' },
  { id: 'tue', label: 'T' },
  { id: 'wed', label: 'W' },
  { id: 'thu', label: 'T' },
  { id: 'fri', label: 'F' },
  { id: 'sat', label: 'S' },
  { id: 'sun', label: 'S' },
];

const TIMES = ['07:00', '09:00', '12:00', '18:00', '20:00'];

const DEFAULT_SETTINGS = {
  enabled: true,
  time: '09:00',
  streakAlerts: true,
  lessonReminders: true,
  proverbReminders: true,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
};

export default function RemindersScreen({ navigation }) {
  const { activeLanguage } = useContext(LanguageContext);
  const { theme, isDarkMode } = useContext(ThemeContext);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const local = await AsyncStorage.getItem(STORAGE_KEY);
      if (local) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(local) });
      }

      const response = await notificationAPI.getSettings();
      const remote = response.data?.data;
      if (remote?.types || remote?.quietHours) {
        setSettings(prev => ({
          ...prev,
          lessonReminders: remote.types?.lessonReminders ?? prev.lessonReminders,
          streakAlerts: remote.types?.streakAlerts ?? prev.streakAlerts,
          enabled: remote.channels?.push ?? prev.enabled,
        }));
      }
    } catch (error) {
    }
  };

  const updateSetting = (key, value) => {
    haptics.impactLight();
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day) => {
    setSettings(prev => {
      const exists = prev.days.includes(day);
      const days = exists ? prev.days.filter(d => d !== day) : [...prev.days, day];
      return { ...prev, days };
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      await notificationAPI.updateSettings({
        channels: { push: settings.enabled, inApp: true },
        types: {
          lessonReminders: settings.lessonReminders,
          streakAlerts: settings.streakAlerts,
          tipsAndTricks: settings.proverbReminders,
        },
      });
      haptics.notificationSuccess();
      Alert.alert('Reminders saved', `Learning nudges are set for ${settings.time}.`);
    } catch (error) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      Alert.alert('Saved locally', 'Reminder settings will sync when the server is reachable.');
    } finally {
      setSaving(false);
    }
  };

  const ReminderRow = ({ icon, title, subtitle, value, onValueChange }) => (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: theme.primary + '20' }]}>
        <MaterialIcons name={icon} size={22} color={theme.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: theme.subText }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary + '80' }}
        thumbColor={value ? theme.primary : '#f5f5f5'}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4c2e" />
      <LinearGradient colors={isDarkMode ? ['#000', '#1a1a1a'] : ['#1a4c2e', '#2e7d32']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reminders</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.headerSubtitle}>Keep your {activeLanguage?.name || 'Izon'} practice consistent.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.heroCard, { backgroundColor: theme.card }]}>
          <View>
            <Text style={[styles.heroLabel, { color: theme.subText }]}>Next reminder</Text>
            <Text style={[styles.heroTime, { color: theme.primary }]}>{settings.enabled ? settings.time : 'Paused'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.pauseButton, !settings.enabled && styles.resumeButton, !settings.enabled && { backgroundColor: theme.primary }]}
            onPress={() => updateSetting('enabled', !settings.enabled)}
          >
            <Ionicons name={settings.enabled ? 'pause' : 'play'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Reminder Time</Text>
        <View style={styles.timeGrid}>
          {TIMES.map(time => (
            <TouchableOpacity
              key={time}
              style={[styles.timeChip, { backgroundColor: theme.card, borderColor: theme.border }, settings.time === time && styles.timeChipActive, settings.time === time && { borderColor: theme.primary }]}
              onPress={() => updateSetting('time', time)}
            >
              <Text style={[styles.timeText, { color: theme.subText }, settings.time === time && styles.timeTextActive, settings.time === time && { color: theme.primary }]}>{time}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Practice Days</Text>
        <View style={styles.daysRow}>
          {DAYS.map(day => {
            const active = settings.days.includes(day.id);
            return (
              <TouchableOpacity
                key={day.id}
                style={[styles.dayButton, { backgroundColor: theme.card, borderColor: theme.border }, active && styles.dayButtonActive, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => toggleDay(day.id)}
              >
                <Text style={[styles.dayText, { color: theme.subText }, active && styles.dayTextActive]}>{day.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Nudges</Text>
        <View style={[styles.panel, { backgroundColor: theme.card }]}>
          <ReminderRow
            icon="school"
            title="Lesson reminders"
            subtitle="A prompt to complete today’s lesson."
            value={settings.lessonReminders}
            onValueChange={(value) => updateSetting('lessonReminders', value)}
          />
          <ReminderRow
            icon="local-fire-department"
            title="Streak alerts"
            subtitle="A warning before your streak resets."
            value={settings.streakAlerts}
            onValueChange={(value) => updateSetting('streakAlerts', value)}
          />
          <ReminderRow
            icon="auto-stories"
            title="Daily proverb"
            subtitle="A short cultural prompt each day."
            value={settings.proverbReminders}
            onValueChange={(value) => updateSetting('proverbReminders', value)}
          />
        </View>

        <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={saveSettings} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Reminders'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', marginTop: 12, fontSize: 15 },
  content: { padding: 20, paddingBottom: 36 },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
  },
  heroLabel: { fontSize: 13 },
  heroTime: { fontSize: 36, fontWeight: '800', marginTop: 4 },
  pauseButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F57C00', alignItems: 'center', justifyContent: 'center' },
  resumeButton: { backgroundColor: '#2e7d32' },
  sectionTitle: { marginTop: 24, marginBottom: 12, fontSize: 16, fontWeight: '700' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1 },
  timeChipActive: { backgroundColor: '#E8F5E9' },
  timeText: { fontWeight: '600' },
  timeTextActive: { },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dayButtonActive: { },
  dayText: { fontWeight: '700' },
  dayTextActive: { color: '#fff' },
  panel: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  rowIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { color: '#777', fontSize: 12, marginTop: 3 },
  saveButton: { marginTop: 26, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
