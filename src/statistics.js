// Placeholder for statistics
const { getStats, getDailyStats } = require('./database/redis');

async function getTotalStats() {
  return await getStats();
}

async function getDayStats(date) {
  return await getDailyStats(date);
}

module.exports = {
  getTotalStats,
  getDayStats,
};
