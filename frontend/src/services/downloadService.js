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

export const downloadLanguagePack = async (code, name, packUri, fileUri, version) => {
  try {
    const downloadRes = await FileSystem.downloadAsync(packUri, fileUri);
    
    if (downloadRes.status === 200) {
        await db.runAsync(
            'INSERT OR REPLACE INTO downloaded_language_packs (code, name, uri, version) VALUES (?, ?, ?, ?)',
            [code, name, fileUri, version]
        );
        return true;
    } else {
        handleDownloadError(new Error('Download failed with status ' + downloadRes.status), 'downloadLanguagePack');
        return false;
    }
} catch (error) {
    handleDownloadError(error, 'downloadLanguagePack');
    return false;
}
};

export const getDownloadedLessonPacks = async () => {
  return db.getAllAsync('SELECT * FROM downloaded_lesson_packs');
};
