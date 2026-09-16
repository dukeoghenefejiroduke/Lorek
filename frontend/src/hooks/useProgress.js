import { useState, useEffect } from 'react';
import { progressAPI } from '../services/api';

export const useProgress = (lessonId) => {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, [lessonId]);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      // Fetching progress for the specific lesson
      const response = await progressAPI.get();
      // Filter or find the progress for the lesson
      const lessonProgress = response.data.data.find(p => p.lesson === lessonId);
      setProgress(lessonProgress);
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (data) => {
    try {
      const response = await progressAPI.update(data);
      setProgress(response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('Failed to update progress:', error);
      throw error;
    }
  };

  return { progress, loading, updateProgress, refetch: fetchProgress };
};
