import { useState, useEffect } from 'react';
import { apiUtils } from '../services/api';
import * as Constants from 'expo-constants';

export const useAppUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    // FOR TESTING: Set this to true to force the modal to appear
    const DEBUG_FORCE_UPDATE = false; 
    
    if (DEBUG_FORCE_UPDATE) {
      setUpdateInfo({ latestVersion: '99.9.9', updateUrl: 'https://example.com' });
      setUpdateAvailable(true);
      return;
    }

    checkVersion();
  }, []);

  const checkVersion = async () => {
    try {
      // Fetch latest version from backend every time
      const response = await apiUtils.getVersion();
      const { latestVersion, updateUrl } = response.data;

      // Compare with current version
      const currentVersion = Constants.expoConfig.version || '1.0.0';
      if (latestVersion !== currentVersion) {
        setUpdateInfo({ latestVersion, updateUrl });
        setUpdateAvailable(true);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  return { updateAvailable, updateInfo };
};
