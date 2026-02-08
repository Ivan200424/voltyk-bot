// Placeholder for schedule service
const { fetchScheduleData } = require('../api');
const { parseScheduleForQueue } = require('../parser');

async function getScheduleForUser(user) {
  if (!user || !user.region || !user.queue) {
    return null;
  }
  
  const scheduleData = await fetchScheduleData(user.region);
  return parseScheduleForQueue(scheduleData, user.queue);
}

module.exports = {
  getScheduleForUser,
};
