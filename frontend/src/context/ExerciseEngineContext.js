import React, { createContext, useState, useContext } from 'react';

const ExerciseEngineContext = createContext();

export const ExerciseEngineProvider = ({ children }) => {
  const [currentExercise, setCurrentExercise] = useState(null);
  const [evaluation, setEvaluation] = useState(null);

  const loadExercise = (exercise) => {
    setCurrentExercise(exercise);
    setEvaluation(null);
  };

  const evaluateAnswer = (isCorrect, feedback) => {
    setEvaluation({ isCorrect, feedback });
  };

  return (
    <ExerciseEngineContext.Provider value={{ currentExercise, evaluation, loadExercise, evaluateAnswer }}>
      {children}
    </ExerciseEngineContext.Provider>
  );
};

export const useExerciseEngine = () => useContext(ExerciseEngineContext);
