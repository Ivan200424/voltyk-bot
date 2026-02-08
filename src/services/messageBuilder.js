const { formatDateUkrainian } = require('../utils/dateHelpers');
const { escapeHtml } = require('../utils');
const { createLogger } = require('../utils/logger');

const logger = createLogger('MessageBuilder');

/**
 * Format schedule events into a readable table
 * @param {Array} events - Schedule events
 * @returns {string} Formatted schedule text
 */
function formatScheduleEvents(events) {
  if (!events || events.length === 0) {
    return '✅ Відключень не заплановано';
  }
  
  let text = '';
  let totalMinutes = 0;
  
  events.forEach((event) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    const startTime = start.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    });
    
    const endTime = end.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    });
    
    const durationMs = end.getTime() - start.getTime();
    const durationHours = Math.round(durationMs / (1000 * 60 * 60));
    totalMinutes += durationMs / (1000 * 60);
    
    text += `🪫 ${startTime} - ${endTime} (~${durationHours} год)\n`;
  });
  
  const totalHours = Math.round(totalMinutes / 60);
  text += `\nЗагалом без світла: ~${totalHours} год`;
  
  return text;
}

/**
 * Build base message with header and footer
 * @param {string} headerText - Header text with emoji and date
 * @param {string} queue - Queue number
 * @param {Date} date - Date of the schedule
 * @param {Array} events - Schedule events
 * @returns {string} Complete message
 */
function buildMessage(headerText, queue, date, events) {
  const dateStr = formatDateUkrainian(date);
  const scheduleText = formatScheduleEvents(events);
  
  return `${headerText}, ${escapeHtml(dateStr)}, для черги ${escapeHtml(queue)}:\n\n${scheduleText}`;
}

/**
 * Build secondary block without date/queue (for "без змін" / "Оновлено графік на сьогодні")
 * @param {string} headerText - Header text
 * @param {Array} events - Schedule events
 * @returns {string} Complete message
 */
function buildSecondaryBlock(headerText, events) {
  const scheduleText = formatScheduleEvents(events);
  return `${headerText}:\n\n${scheduleText}`;
}

/**
 * Scenario 1: First schedule today (no previous hash for today)
 * @param {string} queue - Queue number
 * @param {Date} todayDate - Today's date
 * @param {Array} todayEvents - Today's events
 * @returns {Object} Message object with text
 */
function buildScenario1Message(queue, todayDate, todayEvents) {
  const message = buildMessage(
    '💡 Графік відключень на сьогодні',
    queue,
    todayDate,
    todayEvents
  );
  
  return { text: message };
}

/**
 * Scenario 2: Updated schedule today (today hash changed)
 * @param {string} queue - Queue number
 * @param {Date} todayDate - Today's date
 * @param {Array} todayEvents - Today's events
 * @returns {Object} Message object with text
 */
function buildScenario2Message(queue, todayDate, todayEvents) {
  const message = buildMessage(
    '💡 Оновлено графік відключень на сьогодні',
    queue,
    todayDate,
    todayEvents
  );
  
  return { text: message };
}

/**
 * Scenario 3: Tomorrow schedule appeared, today unchanged
 * Returns single combined message with two blocks
 * @param {string} queue - Queue number
 * @param {Date} todayDate - Today's date
 * @param {Date} tomorrowDate - Tomorrow's date
 * @param {Array} todayEvents - Today's events
 * @param {Array} tomorrowEvents - Tomorrow's events
 * @returns {Array} Array with single message object
 */
function buildScenario3Messages(queue, todayDate, tomorrowDate, todayEvents, tomorrowEvents) {
  const primary = buildMessage(
    '💡 Зʼявився графік відключень на завтра',
    queue,
    tomorrowDate,
    tomorrowEvents
  );
  
  const secondary = buildSecondaryBlock(
    '💡 Графік на сьогодні без змін',
    todayEvents
  );
  
  return [{ text: `${primary}\n\n${secondary}` }];
}

/**
 * Scenario 4: Tomorrow appeared AND today updated
 * Returns single combined message with two blocks
 * @param {string} queue - Queue number
 * @param {Date} todayDate - Today's date
 * @param {Date} tomorrowDate - Tomorrow's date
 * @param {Array} todayEvents - Today's events
 * @param {Array} tomorrowEvents - Tomorrow's events
 * @returns {Array} Array with single message object
 */
function buildScenario4Messages(queue, todayDate, tomorrowDate, todayEvents, tomorrowEvents) {
  const primary = buildMessage(
    '💡 Зʼявився графік відключень на завтра',
    queue,
    tomorrowDate,
    tomorrowEvents
  );
  
  const secondary = buildSecondaryBlock(
    '💡 Оновлено графік на сьогодні',
    todayEvents
  );
  
  return [{ text: `${primary}\n\n${secondary}` }];
}

/**
 * Scenario 5: Tomorrow updated, today unchanged
 * Returns single combined message with two blocks
 * @param {string} queue - Queue number
 * @param {Date} todayDate - Today's date
 * @param {Date} tomorrowDate - Tomorrow's date
 * @param {Array} todayEvents - Today's events
 * @param {Array} tomorrowEvents - Tomorrow's events
 * @returns {Array} Array with single message object
 */
function buildScenario5Messages(queue, todayDate, tomorrowDate, todayEvents, tomorrowEvents) {
  const primary = buildMessage(
    '💡 Оновлено графік відключень на завтра',
    queue,
    tomorrowDate,
    tomorrowEvents
  );
  
  const secondary = buildSecondaryBlock(
    '💡 Графік на сьогодні без змін',
    todayEvents
  );
  
  return [{ text: `${primary}\n\n${secondary}` }];
}

/**
 * Determine which scenario applies and build appropriate messages
 * @param {Object} params - Parameters object
 * @param {string} params.queue - Queue number
 * @param {Date} params.todayDate - Today's date
 * @param {Date} params.tomorrowDate - Tomorrow's date
 * @param {Array} params.todayEvents - Today's events
 * @param {Array} params.tomorrowEvents - Tomorrow's events
 * @param {Object} params.todayChange - Today's change info {type, currentHash, previousHash}
 * @param {Object} params.tomorrowChange - Tomorrow's change info {type, currentHash, previousHash}
 * @returns {Array} Array of message objects, or empty array if no messages needed
 */
function buildMessagesForChanges(params) {
  const {
    queue,
    todayDate,
    tomorrowDate,
    todayEvents,
    tomorrowEvents,
    todayChange,
    tomorrowChange,
  } = params;
  
  const todayChanged = todayChange.type === 'new' || todayChange.type === 'updated';
  const tomorrowChanged = tomorrowChange.type === 'new' || tomorrowChange.type === 'updated';
  
  // Special case: If today is "new" (first time) and tomorrow is not changed, use scenario 1
  if (todayChange.type === 'new' && !tomorrowChanged) {
    logger.info(`Scenario 1: First schedule for today for queue ${queue}`);
    return [buildScenario1Message(queue, todayDate, todayEvents)];
  }
  
  // Scenario 4: Both changed (today updated AND tomorrow appeared/updated)
  if (todayChanged && tomorrowChanged) {
    logger.info(`Scenario 4: Today updated AND tomorrow appeared for queue ${queue}`);
    return buildScenario4Messages(queue, todayDate, tomorrowDate, todayEvents, tomorrowEvents);
  }
  
  // Scenario 2: Only today changed (and it's updated, not new)
  if (todayChanged && !tomorrowChanged) {
    logger.info(`Scenario 2: Today updated for queue ${queue}`);
    return [buildScenario2Message(queue, todayDate, todayEvents)];
  }
  
  // Scenario 3 or 5: Only tomorrow changed
  if (!todayChanged && tomorrowChanged) {
    // Determine if it's scenario 3 (appeared) or 5 (updated)
    if (tomorrowChange.type === 'new') {
      logger.info(`Scenario 3: Tomorrow appeared for queue ${queue}`);
      return buildScenario3Messages(queue, todayDate, tomorrowDate, todayEvents, tomorrowEvents);
    } else {
      logger.info(`Scenario 5: Tomorrow updated for queue ${queue}`);
      return buildScenario5Messages(queue, todayDate, tomorrowDate, todayEvents, tomorrowEvents);
    }
  }
  
  // No changes - no messages needed
  logger.debug(`No changes for queue ${queue}, skipping`);
  return [];
}

module.exports = {
  formatScheduleEvents,
  buildMessage,
  buildSecondaryBlock,
  buildScenario1Message,
  buildScenario2Message,
  buildScenario3Messages,
  buildScenario4Messages,
  buildScenario5Messages,
  buildMessagesForChanges,
};
