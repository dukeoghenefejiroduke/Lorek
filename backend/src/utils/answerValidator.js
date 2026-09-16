/**
 * Centralized Answer Validation System - Backend Version
 * Handles text validation, unicode normalization, and acceptable alternative mappings safely.
 */

const normalizeText = (text) => {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"]/g, '')
    .replace(/\s+/g, ' ');
};

const validateAnswer = (userInput, correctAnswer, acceptableAnswers = []) => {
  if (!userInput) return false;
  
  const normalizedUser = normalizeText(userInput);
  const normalizedCorrect = normalizeText(correctAnswer);
  
  if (normalizedUser === normalizedCorrect) {
    return true;
  }
  
  if (acceptableAnswers && acceptableAnswers.length > 0) {
    return acceptableAnswers.some(ans => normalizeText(ans) === normalizedUser);
  }
  
  return false;
};

module.exports = { normalizeText, validateAnswer };
