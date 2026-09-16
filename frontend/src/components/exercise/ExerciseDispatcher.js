import React from 'react';
import { View, Text, Button } from 'react-native';
import { useExerciseEngine } from '../../context/ExerciseEngineContext';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import MultipleChoiceRenderer from './renderers/MultipleChoiceRenderer';

// Updated placeholders/renderers
const TranslationRenderer = ({ exercise, onComplete }) => <Text>Translation: {exercise.question.english}</Text>;
const ListeningRenderer = ({ exercise, onComplete }) => <Text>Listening: {exercise.question.english}</Text>;

const SpeakingRenderer = ({ exercise, onComplete }) => {
    const { startRecording, stopRecording, isRecording } = useAudioRecorder();
    
    const handleSpeak = async () => {
        if (isRecording) {
            const uri = await stopRecording();
            console.log('Recording stopped. URI:', uri);
            onComplete(true, "Audio recorded"); // Temporary
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

const FillBlankRenderer = ({ exercise, onComplete }) => <Text>Fill Blank: {exercise.question.english}</Text>;
const WordBankRenderer = ({ exercise, onComplete }) => <Text>Word Bank: {exercise.question.english}</Text>;
const SelectTranslationRenderer = ({ exercise, onComplete }) => <Text>Select Translation: {exercise.question.english}</Text>;
const TypeTranslationRenderer = ({ exercise, onComplete }) => <Text>Type Translation: {exercise.question.english}</Text>;
const ImageSelectionRenderer = ({ exercise, onComplete }) => <Text>Image Selection: {exercise.question.english}</Text>;
const MatchingRenderer = ({ exercise, onComplete }) => <Text>Matching: {exercise.question.english}</Text>;
const SentenceArrangementRenderer = ({ exercise, onComplete }) => <Text>Reorder: {exercise.question.english}</Text>;
const PronunciationRenderer = ({ exercise, onComplete }) => <Text>Pronunciation: {exercise.question.english}</Text>;

const renderers = {
  'multiple-choice': MultipleChoiceRenderer,
  'translation': TranslationRenderer,
  'listening': ListeningRenderer,
  'speaking': SpeakingRenderer,
  'fill-blank': FillBlankRenderer,
  'word-bank': WordBankRenderer,
  'matching': MatchingRenderer,
  'reorder': SentenceArrangementRenderer, 
  'image-selection': ImageSelectionRenderer,
  'select-translation': SelectTranslationRenderer,
  'type-translation': TypeTranslationRenderer,
  'pronunciation': PronunciationRenderer,
};

export default function ExerciseDispatcher() {
  const { currentExercise, submitAnswer } = useExerciseEngine();

  if (!currentExercise) return <View><Text>Loading...</Text></View>;

  const Renderer = renderers[currentExercise.type];

  if (!Renderer) return <View><Text>Unsupported exercise type: {currentExercise.type}</Text></View>;

  return <Renderer exercise={currentExercise} onComplete={submitAnswer} />;
}
