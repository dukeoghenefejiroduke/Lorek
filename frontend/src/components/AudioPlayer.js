// components/AudioPlayer.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Animated,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Audio } from 'expo-av';
import haptics from '../utils/haptics';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { ThemeContext, lightTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function AudioPlayer({ 
  audioUrl, 
  word, 
  onRecord, 
  showControls = true,
  compact = false,
  autoPlay = false 
}) {
  const contextValue = useContext(ThemeContext) || {};
  console.log('DEBUG: Accessing ThemeContext in AudioPlayer.js:', contextValue);
  const { theme = lightTheme } = contextValue;
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [userAudioUri, setUserAudioUri] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const soundRef = useRef(null);
  const recordingRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const positionIntervalRef = useRef(null);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (audioUrl) {
      loadAudio();
    }
    
    return () => {
      cleanupAudio();
    };
  }, [audioUrl]);

  useEffect(() => {
    if (autoPlay && audioUrl && soundRef.current) {
      setTimeout(() => handleNativePlay(), 500);
    }
  }, [autoPlay, soundRef.current]);

  const cleanupAudio = async () => {
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
    }
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };

  async function loadAudio() {
    try {
      setIsLoading(true);
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false, rate: playbackSpeed }
      );
      
      soundRef.current = sound;
      setDuration(status.durationMillis || 0);
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPosition(status.positionMillis);
          setIsPlaying(status.isPlaying);
          
          if (!status.isPlaying && status.positionMillis === status.durationMillis) {
            setPosition(0);
            if (positionIntervalRef.current) {
              clearInterval(positionIntervalRef.current);
            }
          }
        }
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading audio:', error);
      setIsLoading(false);
      Alert.alert('Audio Error', 'Could not load audio file');
    }
  }

  async function handleNativePlay() {
    if (!soundRef.current || !audioUrl) {
      Alert.alert('No Audio', 'Native pronunciation is not available.');
      return;
    }

    try {
      haptics.impactLight();
      
      const status = await soundRef.current.getStatusAsync();
      
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        if (positionIntervalRef.current) {
          clearInterval(positionIntervalRef.current);
        }
      } else {
        await soundRef.current.setRateAsync(playbackSpeed, true);
        await soundRef.current.playAsync();
        setIsPlaying(true);
        
        positionIntervalRef.current = setInterval(async () => {
          const newStatus = await soundRef.current.getStatusAsync();
          if (newStatus.isLoaded) {
            setPosition(newStatus.positionMillis);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Playback error:', error);
      Alert.alert('Playback Error', 'Could not play audio');
    }
  }

  async function startRecording() {
    try {
      haptics.impactMedium();
      
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Please grant microphone access');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      
      await newRecording.startAsync();
      
      recordingRef.current = newRecording;
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start timer for recording duration
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // Pulse animation while recording
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Could not start recording: ' + err.message);
    }
  }

  async function stopRecording() {
    try {
      haptics.notificationSuccess();
      
      if (!recordingRef.current) return;
      
      await recordingRef.current.stopAndUnloadAsync();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      
      const uri = recordingRef.current.getURI();
      setUserAudioUri(uri);
      
      if (onRecord) {
        onRecord(uri);
      }
      
      recordingRef.current = null;
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to save recording');
    }
  }

  async function playUserRecording() {
    if (!userAudioUri) return;
    
    try {
      haptics.impactLight();
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: userAudioUri },
        { shouldPlay: true }
      );
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isPlaying && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Error playing user recording:', error);
      Alert.alert('Error', 'Could not play your recording');
    }
  }

  function handleSpeedChange() {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    
    haptics.impactLight();
    
    setPlaybackSpeed(newSpeed);
    if (soundRef.current) {
      soundRef.current.setRateAsync(newSpeed, true);
    }
  }

  function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

const styles = StyleSheet.create({
  container: {
    borderRadius: 15,
    padding: 15,
    marginVertical: 10,
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactRecordButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactPlaybackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 15,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  timeText: {
    fontSize: 11,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    minWidth: 110,
    justifyContent: 'center',
  },
  playButton: {
  },
  speedButton: {
  },
  recordButton: {
    backgroundColor: '#FF9800',
  },
  userAudioButton: {
    backgroundColor: '#9C27B0',
  },
  recordingActive: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  waveformContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 15,
    height: 50,
  },
  waveformBar: {
    width: 4,
    backgroundColor: '#FF9800',
    borderRadius: 2,
  },
});

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <TouchableOpacity
          style={[styles.compactPlayButton, { backgroundColor: theme.background }]}
          onPress={handleNativePlay}
          disabled={isLoading}
        >
          <Icon 
            name={isPlaying ? 'pause' : 'play-arrow'} 
            size={24} 
            color={theme.primary} 
          />
        </TouchableOpacity>
        {onRecord && (
          <TouchableOpacity
            style={[styles.compactRecordButton, isRecording && styles.recordingActive]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Icon 
              name={isRecording ? 'stop' : 'mic'} 
              size={20} 
              color="#fff" 
            />
          </TouchableOpacity>
        )}
        {userAudioUri && (
          <TouchableOpacity
            style={[styles.compactPlaybackButton, { backgroundColor: theme.background }]}
            onPress={playUserRecording}
          >
            <Icon name="replay" size={20} color="#9C27B0" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.card, opacity: fadeAnim }]}>
      {word && <Text style={[styles.wordTitle, { color: theme.primary }]}>{word}</Text>}
      
      {/* Progress Bar */}
      {audioUrl && duration > 0 && (
        <View style={styles.progressContainer}>
          <Slider
            style={styles.slider}
            value={position}
            minimumValue={0}
            maximumValue={duration}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.subText}
            thumbTintColor={theme.primary}
            onSlidingComplete={async (value) => {
              if (soundRef.current) {
                await soundRef.current.setPositionAsync(value);
              }
            }}
          />
          <View style={styles.timeContainer}>
            <Text style={[styles.timeText, { color: theme.subText }]}>{formatTime(position)}</Text>
            <Text style={[styles.timeText, { color: theme.subText }]}>{formatTime(duration)}</Text>
          </View>
        </View>
      )}
      
      {/* Main Controls */}
      <View style={styles.controls}>
        {/* Native Audio Playback */}
        {audioUrl && (
          <TouchableOpacity
            style={[styles.button, styles.playButton, { backgroundColor: theme.primary }]}
            onPress={handleNativePlay}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Icon name={isPlaying ? 'pause' : 'play-arrow'} size={20} color="#fff" />
                <Text style={styles.buttonText}>
                  {isPlaying ? 'Pause' : 'Play Native'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Speed Control */}
        {showControls && audioUrl && (
          <TouchableOpacity
            style={[styles.button, styles.speedButton, { backgroundColor: theme.secondary }]}
            onPress={handleSpeedChange}
          >
            <Icon name="speed" size={20} color="#fff" />
            <Text style={styles.buttonText}>{playbackSpeed}x</Text>
          </TouchableOpacity>
        )}

        {/* User Recording */}
        {onRecord && (
          <Animated.View style={{ transform: [{ scale: isRecording ? pulseAnim : 1 }] }}>
            <TouchableOpacity
              style={[
                styles.button, 
                styles.recordButton,
                isRecording && styles.recordingActive
              ]}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <Icon name={isRecording ? 'stop' : 'mic'} size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {isRecording ? `Recording ${recordingDuration}s` : 'Record'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Play User Recording */}
        {userAudioUri && (
          <TouchableOpacity
            style={[styles.button, styles.userAudioButton]}
            onPress={playUserRecording}
          >
            <Icon name="replay" size={20} color="#fff" />
            <Text style={styles.buttonText}>Play Your Voice</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recording Waveform Animation */}
      {isRecording && (
        <View style={styles.waveformContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.waveformBar,
                {
                  height: pulseAnim.interpolate({
                    inputRange: [1, 1.1],
                    outputRange: [20 + index * 3, 40 + index * 3],
                  }),
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.1],
                    outputRange: [0.6, 1],
                  }),
                },
              ]}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}
