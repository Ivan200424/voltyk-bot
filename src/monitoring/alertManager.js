// Placeholder for alert manager
const { createLogger } = require('../utils/logger');

const logger = createLogger('AlertManager');

async function sendAlert(chatId, message) {
  logger.info(`Sending alert to ${chatId}: ${message}`);
  // TODO: Implement alert sending
}

module.exports = {
  sendAlert,
};
