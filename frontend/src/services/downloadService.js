import * as FileSystem from 'expo-file-system/legacy';
import db from './db';
import { handleDownloadError } from '../utils/errorHandler';

export const downloadLessonPack = async (packUri, fileUri) => {
  try {
    const downloadRes = await FileSystem.downloadAsync(packUri, fileUri);
    
    if (downloadRes.status === 200) {
        return true;
    } else {
        handleDownloadError(new Error('Download failed with status ' + downloadRes.status), 'downloadLessonPack');
        return false;
    }
} catch (error) {
    handleDownloadError(error, 'downloadLessonPack');
    return false;
}
return false;
};

export const getDownloadedLessonPacks = async () => {
  return db.getAllAsync('SELECT * FROM downloaded_lesson_packs');
};
