const Achievement = require('../models/Achievement');
const Badge = require('../models/Badge');
const { logger } = require('../config/logger');
const notificationService = require('./notificationService');

const BADGE_TIERS = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
  DIAMOND: 'diamond',
};

const BADGE_CATEGORIES = {
  STREAK: 'streak',
  VOCABULARY: 'vocabulary',
  LESSONS: 'lessons',
  SOCIAL: 'social',
  SPECIAL: 'special',
  MASTERY: 'mastery',
};

const BADGE_RULES = [
  // Streak Badges
  { name: 'First Flame', description: 'Started your learning journey with a 3-day streak', criteria: { streak: 3 }, icon: '🔥', tier: BADGE_TIERS.BRONZE, category: BADGE_CATEGORIES.STREAK, points: 50 },
  { name: 'Week Warrior', description: 'Maintained a 7-day learning streak', criteria: { streak: 7 }, icon: '⚡', tier: BADGE_TIERS.SILVER, category: BADGE_CATEGORIES.STREAK, points: 100 },
  { name: 'Monthly Master', description: '30 days of consecutive learning', criteria: { streak: 30 }, icon: '🌙', tier: BADGE_TIERS.GOLD, category: BADGE_CATEGORIES.STREAK, points: 300 },
  { name: 'Year-Long Legend', description: '365 days of dedication to Izon', criteria: { streak: 365 }, icon: '👑', tier: BADGE_TIERS.DIAMOND, category: BADGE_CATEGORIES.STREAK, points: 1000 },
  // Vocabulary Badges
  { name: 'Izon Novice', description: 'Learned your first 10 Izon words', criteria: { wordsMastered: 10 }, icon: '🌱', tier: BADGE_TIERS.BRONZE, category: BADGE_CATEGORIES.VOCABULARY, points: 50 },
  { name: 'Word Collector', description: 'Mastered 50 Izon words', criteria: { wordsMastered: 50 }, icon: '📚', tier: BADGE_TIERS.SILVER, category: BADGE_CATEGORIES.VOCABULARY, points: 150 },
  { name: 'Vocabulary King', description: 'Command of 200 Izon words', criteria: { wordsMastered: 200 }, icon: '👑', tier: BADGE_TIERS.GOLD, category: BADGE_CATEGORIES.VOCABULARY, points: 400 },
  { name: 'Izon Lexicographer', description: 'Mastered 500 Izon words', criteria: { wordsMastered: 500 }, icon: '📖', tier: BADGE_TIERS.PLATINUM, category: BADGE_CATEGORIES.VOCABULARY, points: 800 },
  { name: 'Living Dictionary', description: 'Achieved mastery of 1000 Izon words', criteria: { wordsMastered: 1000 }, icon: '🗣️', tier: BADGE_TIERS.DIAMOND, category: BADGE_CATEGORIES.VOCABULARY, points: 1500 },
  // Points Badges
  { name: 'Point Seeker', description: 'Earned 100 points', criteria: { points: 100 }, icon: '⭐', tier: BADGE_TIERS.BRONZE, category: BADGE_CATEGORIES.LESSONS, points: 25 },
  { name: 'Centurion', description: 'Earned 1000 points', criteria: { points: 1000 }, icon: '💫', tier: BADGE_TIERS.SILVER, category: BADGE_CATEGORIES.LESSONS, points: 100 },
  { name: 'Point Millionaire', description: 'Earned 5000 points', criteria: { points: 5000 }, icon: '💰', tier: BADGE_TIERS.GOLD, category: BADGE_CATEGORIES.LESSONS, points: 500 },
  { name: 'Izon Elder', description: 'Achieved 10000 points and deep cultural understanding', criteria: { points: 10000 }, icon: '🦅', tier: BADGE_TIERS.DIAMOND, category: BADGE_CATEGORIES.SPECIAL, points: 1000 },
  // Lesson Completion Badges
  { name: 'Lesson Starter', description: 'Completed your first lesson', criteria: { lessonsCompleted: 1 }, icon: '🎓', tier: BADGE_TIERS.BRONZE, category: BADGE_CATEGORIES.LESSONS, points: 25 },
  { name: 'Dedicated Learner', description: 'Completed 25 lessons', criteria: { lessonsCompleted: 25 }, icon: '📝', tier: BADGE_TIERS.SILVER, category: BADGE_CATEGORIES.LESSONS, points: 150 },
  { name: 'Course Conqueror', description: 'Completed 100 lessons', criteria: { lessonsCompleted: 100 }, icon: '🏆', tier: BADGE_TIERS.GOLD, category: BADGE_CATEGORIES.LESSONS, points: 500 },
  // Social Badges
  { name: 'Social Butterfly', description: 'Invited 3 friends to learn Izon', criteria: { referrals: 3 }, icon: '🦋', tier: BADGE_TIERS.SILVER, category: BADGE_CATEGORIES.SOCIAL, points: 100 },
  { name: 'Community Leader', description: 'Invited 10 friends to learn Izon', criteria: { referrals: 10 }, icon: '👥', tier: BADGE_TIERS.GOLD, category: BADGE_CATEGORIES.SOCIAL, points: 300 },
  { name: 'Ambassador', description: 'Invited 25 friends to learn Izon', criteria: { referrals: 25 }, icon: '🤝', tier: BADGE_TIERS.PLATINUM, category: BADGE_CATEGORIES.SOCIAL, points: 600 },
  // Special Badges
  { name: 'Early Bird', description: 'Joined during the first month of Izon App', criteria: { earlyAdopter: true }, icon: '🐦', tier: BADGE_TIERS.SPECIAL, category: BADGE_CATEGORIES.SPECIAL, points: 200, secret: true },
  { name: 'Perfect Week', description: 'Completed at least one lesson every day for a week', criteria: { perfectWeek: 1 }, icon: '✨', tier: BADGE_TIERS.SILVER, category: BADGE_CATEGORIES.STREAK, points: 150 },
  { name: 'Night Owl', description: 'Learned after midnight 5 times', criteria: { nightStudy: 5 }, icon: '🦉', tier: BADGE_TIERS.BRONZE, category: BADGE_CATEGORIES.SPECIAL, points: 75 },
];

const getUserStats = async (user) => {
  return {   
    points: user.progress?.totalPoints || 0,
    streak: typeof user.progress?.streak === 'number' ? user.progress.streak : user.progress?.streak?.current || 0,
    wordsMastered: user.vocabularyMastery?.length || 0,
    lessonsCompleted: user.lessonsCompleted || user.progress?.completedLessons?.length || 0,
    referrals: user.referrals?.length || 0,
    createdAt: user.createdAt,
    studyTimes: user.studyTimes || [],
  };
};

const meetsCriteria = async (user, stats, rule) => {
  const criteria = rule.criteria;
  if (criteria.streak && stats.streak < criteria.streak) return false;
  if (criteria.points && stats.points < criteria.points) return false;
  if (criteria.wordsMastered && stats.wordsMastered < criteria.wordsMastered) return false;
  if (criteria.lessonsCompleted && stats.lessonsCompleted < criteria.lessonsCompleted) return false;
  if (criteria.referrals && stats.referrals < criteria.referrals) return false;
  if (criteria.earlyAdopter) {
    const launchDate = new Date('2024-01-01');
    if (user.createdAt > launchDate) return false;
  }
  if (criteria.perfectWeek) {
    const perfectWeeks = await checkPerfectWeeks(user);
    if (perfectWeeks < criteria.perfectWeek) return false;
  }
  if (criteria.nightStudy) {
    const nightStudyCount = stats.studyTimes.filter(t => {
      const hour = new Date(t).getHours();
      return hour >= 0 && hour <= 4;
    }).length;
    if (nightStudyCount < criteria.nightStudy) return false;
  }
  return true;
};

const sendAchievementNotification = async (userId, badge) => {
  try {
    await notificationService.sendBadgeEarned(userId, {
      type: 'achievement',
      title: '🏆 New Badge Earned!',
      body: `Congratulations! You've earned the "${badge.name}" badge.`,
      data: { badge },
    });
  } catch (error) {
    logger.error('Failed to send achievement notification:', error);
  }
};

const checkPerfectWeeks = async (user) => { return 0; }; // Simplified

const calculateProgress = (stats, criteria) => {
  if (criteria.streak) return Math.min(100, (stats.streak / criteria.streak) * 100);
  if (criteria.points) return Math.min(100, (stats.points / criteria.points) * 100);
  if (criteria.wordsMastered) return Math.min(100, (stats.wordsMastered / criteria.wordsMastered) * 100);
  if (criteria.lessonsCompleted) return Math.min(100, (stats.lessonsCompleted / criteria.lessonsCompleted) * 100);
  if (criteria.referrals) return Math.min(100, (stats.referrals / criteria.referrals) * 100);
  return 0;
};

const calculateRemaining = (stats, criteria) => {
  if (criteria.streak) return Math.max(0, criteria.streak - stats.streak);
  if (criteria.points) return Math.max(0, criteria.points - stats.points);
  if (criteria.wordsMastered) return Math.max(0, criteria.wordsMastered - stats.wordsMastered);
  if (criteria.lessonsCompleted) return Math.max(0, criteria.lessonsCompleted - stats.lessonsCompleted);
  if (criteria.referrals) return Math.max(0, criteria.referrals - stats.referrals);
  return 0;
};

const getNextAchievableBadge = async (user) => {
  const stats = await getUserStats(user);
  const earnedNames = new Set(user.badges?.map(b => b.name) || []);
  for (const rule of BADGE_RULES) {
    if (!earnedNames.has(rule.name)) {
      return { ...rule, progress: calculateProgress(stats, rule.criteria), remaining: calculateRemaining(stats, rule.criteria) };
    }
  }
  return null;
};

module.exports = {
  BADGE_RULES,
  getUserStats,
  meetsCriteria,
  sendAchievementNotification,
  getNextAchievableBadge,
};