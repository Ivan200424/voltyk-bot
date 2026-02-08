// Placeholder for schedule service
const { fetchScheduleData } = require('../api');
const { parseScheduleData } = require('../parser');

async function getScheduleForUser(user) {
  if (!user || !user.region) {
    return null;
  }
  
  const scheduleData = await fetchScheduleData(user.region);
  return parseScheduleData(scheduleData);
}

module.exports = {
  getScheduleForUser,
};
