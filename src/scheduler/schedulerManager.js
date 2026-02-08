// Placeholder for scheduler manager
const { createLogger } = require('../utils/logger');

const logger = createLogger('SchedulerManager');

function initSchedulerManager() {
  logger.info('Scheduler manager initialized (placeholder)');
}

function stopSchedulerManager() {
  logger.info('Scheduler manager stopped');
}

module.exports = {
  initSchedulerManager,
  stopSchedulerManager,
};
