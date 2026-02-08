// Placeholder for analytics
const { incrementStat } = require('./database/redis');

async function trackCommand(command) {
  await incrementStat('commands');
  await incrementStat(`command_${command}`);
}

async function trackMessage() {
  await incrementStat('messages');
}

async function trackError() {
  await incrementStat('errors');
}

module.exports = {
  trackCommand,
  trackMessage,
  trackError,
};
