const User = require('../models/User');
const LeaderboardHistory = require('../models/LeaderboardHistory');
const redis = require('../config/redis');

const getDateRange = (period) => {
  const now = new Date();
  let start, end;
  switch (period) {
    case 'daily': start = new Date(now.setHours(0, 0, 0, 0)); end = new Date(now.setHours(23, 59, 59, 999)); break;
    case 'weekly': const firstDay = now.getDate() - now.getDay(); start = new Date(now.setDate(firstDay)); start.setHours(0, 0, 0, 0); end = new Date(now.setDate(firstDay + 6)); end.setHours(23, 59, 59, 999); break;
    case 'monthly': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); break;
    case 'yearly': start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); break;
    default: return null;
  }
  return { start, end };
};

const getPointsLeaderboard = async (dateRange, limit, skip) => {
  let query = {};
  if (dateRange) { query = { 'progress.lastActive': { $gte: dateRange.start, $lte: dateRange.end } }; }
  const users = await User.find(query).select('username progress.totalPoints progress.streak badges').sort({ 'progress.totalPoints': -1 }).skip(skip).limit(limit);
  return users.map((user, index) => ({ rank: skip + index + 1, userId: user._id, username: user.username, points: user.progress?.totalPoints || 0, streak: user.progress?.streak || 0, badgeCount: user.badges?.length || 0, trend: 'stable' }));
};

const getStreakLeaderboard = async (limit, skip) => {
  const users = await User.find({}).select('username progress.streak badges').sort({ 'progress.streak': -1 }).skip(skip).limit(limit);
  return users.map((user, index) => ({ rank: skip + index + 1, userId: user._id, username: user.username, streak: user.progress?.streak || 0, badgeCount: user.badges?.length || 0 }));
};

const getWordsLeaderboard = async (limit, skip) => {
  const users = await User.find({}).select('username vocabularyMastery badges').sort({ vocabularyMastery: -1 }).skip(skip).limit(limit);
  return users.map((user, index) => ({ rank: skip + index + 1, userId: user._id, username: user.username, wordsMastered: user.vocabularyMastery?.length || 0, badgeCount: user.badges?.length || 0 }));
};

const getLessonsLeaderboard = async (limit, skip) => {
  const users = await User.find({}).select('username lessonsCompleted badges').sort({ lessonsCompleted: -1 }).skip(skip).limit(limit);
  return users.map((user, index) => ({ rank: skip + index + 1, userId: user._id, username: user.username, lessonsCompleted: user.lessonsCompleted || 0, badgeCount: user.badges?.length || 0 }));
};

const getUserPointsRank = async (userId, dateRange) => {
  const user = await User.findById(userId);
  if (!user) return null;
  const higherRanked = await User.countDocuments({ 'progress.totalPoints': { $gt: user.progress?.totalPoints || 0 } });
  const totalUsers = await User.countDocuments();
  return { rank: higherRanked + 1, outOf: totalUsers, percentile: ((higherRanked) / totalUsers * 100).toFixed(1) };
};

const getUserStreakRank = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;
  const higherRanked = await User.countDocuments({ 'progress.streak': { $gt: user.progress?.streak || 0 } });
  const totalUsers = await User.countDocuments();
  return { rank: higherRanked + 1, outOf: totalUsers };
};

const getUserWordsRank = async (userId) => {
  const user = await User.findById(userId).select('vocabularyMastery');
  if (!user) return null;
  const wordsCount = user.vocabularyMastery?.length || 0;
  const higherRanked = await User.countDocuments({ "vocabularyMastery.wordsCount": { $gt: wordsCount } });
  const totalUsers = await User.countDocuments();
  return { rank: higherRanked + 1, outOf: totalUsers };
};

const getUserLessonsRank = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;
  const higherRanked = await User.countDocuments({ lessonsCompleted: { $gt: user.lessonsCompleted || 0 } });
  const totalUsers = await User.countDocuments();
  return { rank: higherRanked + 1, outOf: totalUsers };
};

const getNearbyCompetitors = async (userId, userRank, period) => {
  const range = 3;
  const startRank = Math.max(1, userRank - range);
  const endRank = userRank + range;
  const users = await User.find({}).select('username progress.totalPoints').sort({ 'progress.totalPoints': -1 }).skip(startRank - 1).limit(endRank - startRank + 1);
  return users.map((user, index) => ({ rank: startRank + index, userId: user._id, username: user.username, points: user.progress?.totalPoints || 0, isCurrentUser: user._id.toString() === userId }));
};

const getLeaderboardTotalCount = async (category, dateRange) => {
  switch (category) {
    case 'points': return await User.countDocuments(dateRange ? { 'progress.lastActive': { $gte: dateRange.start, $lte: dateRange.end } } : {});
    default: return await User.countDocuments();
  }
};

module.exports = {
  getDateRange,
  getPointsLeaderboard,
  getStreakLeaderboard,
  getWordsLeaderboard,
  getLessonsLeaderboard,
  getUserPointsRank,
  getUserStreakRank,
  getUserWordsRank,
  getUserLessonsRank,
  getNearbyCompetitors,
  getLeaderboardTotalCount,
};