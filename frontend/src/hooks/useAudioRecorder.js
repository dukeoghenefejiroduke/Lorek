import { useState, useRef } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

export const useAudioRecorder = () => {
  const [recording, setRecording] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('MediaDevices API not supported in this browser.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          setRecording({ uri: audioUrl, blob: audioBlob });
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setRecording({ status: 'recording' });
        return;
      }

      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        if (mediaRecorderRef.current) {
          return new Promise((resolve) => {
            mediaRecorderRef.current.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const audioUrl = URL.createObjectURL(audioBlob);
              setRecording(null);
              resolve(audioUrl);
            };
            mediaRecorderRef.current.stop();
          });
        }
        return null;
      }

      if (!recording) return null;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      return uri;
    } catch (err) {
      console.error('Failed to stop recording', err);
      return null;
    }
  };

  return { startRecording, stopRecording, isRecording: !!recording };
};
