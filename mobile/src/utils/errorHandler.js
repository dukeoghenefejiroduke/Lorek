import { Alert } from 'react-native';

/**
 * Global UI error handler to provide consistent feedback
 * across the application.
 */
export const handleGlobalError = (error, context = '') => {
  let message = 'An unexpected error occurred. Please try again.';
  let title = 'Oops!';

  if (error.isNetworkError) {
    title = 'Connection Issue';
    message = 'Please check your internet connection and try again.';
  } else if (error.status === 401) {
    title = 'Session Expired';
    message = 'Please login again to continue.';
  } else if (error.status === 429) {
    title = 'Slow Down';
    message = 'You are doing that too often. Please wait a moment.';
  } else if (error.message) {
    message = error.message;
  }

  console.error(`[Error Handler] ${context}:`, error);

  Alert.alert(title, message, [{ text: 'OK' }]);
};
