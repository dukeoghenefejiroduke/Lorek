import React from 'react';
import { View, Text, Button } from 'react-native';
import { useExerciseEngine } from '../../context/ExerciseEngineContext';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

// Placeholder renderers
const MultipleChoiceRenderer = ({ exercise }) => <Text>Multiple Choice: {exercise.question.english}</Text>;
const TranslationRenderer = ({ exercise }) => <Text>Translation: {exercise.question.english}</Text>;
const ListeningRenderer = ({ exercise }) => <Text>Listening: {exercise.question.english}</Text>;

const SpeakingRenderer = ({ exercise }) => {
    const { startRecording, stopRecording, isRecording } = useAudioRecorder();
    
    const handleSpeak = async () => {
        if (isRecording) {
            const uri = await stopRecording();
            console.log('Recording stopped. URI:', uri);
            // TODO: Integrate speech recognition & comparison here
        } else {
            await startRecording();
        }
    };

    return (
        <View>
            <Text>Speaking: {exercise.question}</Text>
            <Button 
                title={isRecording ? "Stop Recording" : "Start Speaking"} 
                onPress={handleSpeak}
            />
        </View>
    );
};

const FillBlankRenderer = ({ exercise }) => <Text>Fill Blank: {exercise.question.english}</Text>;
const WordBankRenderer = ({ exercise }) => <Text>Word Bank: {exercise.question.english}</Text>;
const SelectTranslationRenderer = ({ exercise }) => <Text>Select Translation: {exercise.question.english}</Text>;
const TypeTranslationRenderer = ({ exercise }) => <Text>Type Translation: {exercise.question.english}</Text>;
const ImageSelectionRenderer = ({ exercise }) => <Text>Image Selection: {exercise.question.english}</Text>;
const MatchingRenderer = ({ exercise }) => <Text>Matching: {exercise.question.english}</Text>;
const SentenceArrangementRenderer = ({ exercise }) => <Text>Reorder: {exercise.question.english}</Text>;
const PronunciationRenderer = ({ exercise }) => <Text>Pronunciation: {exercise.question.english}</Text>;

const renderers = {
  'multiple-choice': MultipleChoiceRenderer,
  'translation': TranslationRenderer,
  'listening': ListeningRenderer,
  'speaking': SpeakingRenderer,
  'fill-blank': FillBlankRenderer,
  'word-bank': WordBankRenderer,
  'matching': MatchingRenderer,
  'reorder': SentenceArrangementRenderer, // Map reorder to sentence arrangement
  'image-selection': ImageSelectionRenderer,
  'select-translation': SelectTranslationRenderer,
  'type-translation': TypeTranslationRenderer,
  'pronunciation': PronunciationRenderer,
};

export default function ExerciseDispatcher() {
  const { currentExercise } = useExerciseEngine();

  if (!currentExercise) return <View><Text>Loading...</Text></View>;

  const Renderer = renderers[currentExercise.type];

  if (!Renderer) return <View><Text>Unsupported exercise type: {currentExercise.type}</Text></View>;

  return <Renderer exercise={currentExercise} />;
}
