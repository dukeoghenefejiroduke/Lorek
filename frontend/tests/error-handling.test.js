// frontend/tests/error-handling.test.js
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'web',
  },
}));

import { handleGlobalError, handleNetworkError, handleDownloadError } from '../src/utils/errorHandler';
import { Alert } from 'react-native';

describe('Error Handling Utilities & Error Detection Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('handleNetworkError detects network / connection loss', () => {
    const networkError = new Error('Network Error');
    networkError.response = undefined;

    handleNetworkError(networkError, 'LoginTest');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Network error. Please check your internet connection.'
    );
  });

  test('handleNetworkError detects 401 unauthorized', () => {
    const authError = {
      response: {
        status: 401,
      },
    };

    handleNetworkError(authError, 'AuthTest');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Session expired. Please log in again.'
    );
  });

  test('handleNetworkError detects 500 server error', () => {
    const serverError = {
      response: {
        status: 500,
      },
    };

    handleNetworkError(serverError, 'ServerTest');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Server is currently unreachable. Please try again later.'
    );
  });

  test('handleDownloadError detects insufficient storage space', () => {
    const downloadError = {
      code: 'ERR_FILESYSTEM_OUT_OF_SPACE',
    };

    handleDownloadError(downloadError, 'DownloadTest');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Download Error',
      'Insufficient storage space on your device.'
    );
  });

  test('handleDownloadError detects corrupt content', () => {
    const corruptError = new Error('File download corrupt');

    handleDownloadError(corruptError, 'DownloadTest');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Download Error',
      'Downloaded content is corrupt. Please try again.'
    );
  });

  test('handleGlobalError calls console.error and network error handler', () => {
    const err = { response: { status: 409 } };
    handleGlobalError(err, 'GlobalTest');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Sync conflict. Please try again.'
    );
  });
});
