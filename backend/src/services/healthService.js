/**
 * HealthService
 * Manages heart/lives logic for user engagement.
 */

const MAX_HEALTH = parseInt(process.env.MAX_HEALTH) || 5;
const REGEN_TIME_MS = parseInt(process.env.REGEN_TIME_MS) || (4 * 60 * 60 * 1000); // 4 hours per heart default


const deductHealth = async (user) => {
  if (user.progress.health.current > 0) {
    user.progress.health.current -= 1;
    await user.save();
  }
  return user.progress.health.current;
};

const checkAndRegenHealth = (user) => {
  const now = new Date();
  const lastRegen = new Date(user.progress.health.lastRegenAt);
  const timeDiff = now - lastRegen;

  if (timeDiff >= REGEN_TIME_MS && user.progress.health.current < MAX_HEALTH) {
    const heartsToRegen = Math.floor(timeDiff / REGEN_TIME_MS);
    user.progress.health.current = Math.min(MAX_HEALTH, user.progress.health.current + heartsToRegen);
    user.progress.health.lastRegenAt = new Date(lastRegen.getTime() + heartsToRegen * REGEN_TIME_MS);
    return true;
  }
  return false;
};

module.exports = {
  deductHealth,
  checkAndRegenHealth,
  MAX_HEALTH
};
