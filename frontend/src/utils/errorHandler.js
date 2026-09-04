import { Alert } from 'react-native';

export const handleNetworkError = (error, context = '') => {
  console.error(`Error in ${context}:`, error);

  let message = 'An unexpected error occurred.';

  if (!error.response) {
    // Network error (No internet, timeout)
    message = 'Network error. Please check your internet connection.';
  } else if (error.response.status === 401) {
    message = 'Session expired. Please log in again.';
    // Handle logout/redirect
  } else if (error.response.status >= 500) {
    message = 'Server is currently unreachable. Please try again later.';
  } else if (error.response.status === 409) {
    message = 'Sync conflict. Please try again.';
  }

  Alert.alert('Error', message);
};

export const handleDownloadError = (error, context = '') => {
  console.error(`Download Error in ${context}:`, error);

  let message = 'Failed to download content.';
  
  if (error.code === 'ERR_FILESYSTEM_OUT_OF_SPACE') {
    message = 'Insufficient storage space on your device.';
  } else if (error.message && error.message.includes('corrupt')) {
    message = 'Downloaded content is corrupt. Please try again.';
  }

  Alert.alert('Download Error', message);
};
