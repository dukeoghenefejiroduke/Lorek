import { progressAPI } from './api';

export const streakService = {
  syncOnAppLaunch: async () => {
    try {
      const response = await progressAPI.get();
      const data = response.data?.data || response.data;
      
      // Based on your logs, the value is in streakInfo.current 
      // or progress.currentStreak. Let's use streakInfo for better detail.
      if (data && data.streakInfo) {
        return {
          current: data.streakInfo.current || 0,
          longest: data.streakInfo.longest || 0,
          atRisk: data.streakInfo.atRisk || false
        };
      }
      
      // Fallback for the progress object
      if (data && data.progress) {
        return {
          current: data.progress.currentStreak || 0,
          longest: data.progress.longestStreak || 0
        };
      }

      console.warn("Streak data not found in response structure");
      return { current: 0 };
    } catch (error) {
      if (error.status === 429) {
        console.error("Streak sync failed: Rate limited.");
      } else {
        console.error("Streak sync failed:", error.message);
      }
      return { current: 0 };
    }
  },

  checkGoalCompletion: (user) => {
    const dailyGoal = user?.preferences?.dailyGoal || 10;
    const minutesToday = user?.progress?.lessonStats?.dailyProgress || 0;
    return minutesToday >= dailyGoal;
  }
};
