const { createLogger } = require('./utils/logger');

const logger = createLogger('Parser');

/**
 * Parse schedule JSON data
 */
function parseScheduleData(data) {
  try {
    if (!data || typeof data !== 'object') {
      return null;
    }
    
    // Expected format: { schedules: [...], updated: timestamp }
    if (!data.schedules || !Array.isArray(data.schedules)) {
      logger.warn('Invalid schedule data format: missing schedules array');
      return null;
    }
    
    return {
      schedules: data.schedules,
      updated: data.updated || Date.now(),
      region: data.region || null,
    };
  } catch (error) {
    logger.error('Error parsing schedule data:', error);
    return null;
  }
}

/**
 * Get schedule for a specific queue
 */
function getQueueSchedule(scheduleData, queue) {
  try {
    if (!scheduleData || !scheduleData.schedules) {
      return null;
    }
    
    const queueSchedule = scheduleData.schedules.find(s => s.queue === queue);
    return queueSchedule || null;
  } catch (error) {
    logger.error(`Error getting schedule for queue ${queue}:`, error);
    return null;
  }
}

/**
 * Get current outage status for a queue
 */
function getCurrentStatus(queueSchedule) {
  try {
    if (!queueSchedule || !queueSchedule.events) {
      return { isOutage: false, nextEvent: null };
    }
    
    const now = Date.now();
    
    // Find current and next events
    let currentEvent = null;
    let nextEvent = null;
    
    for (const event of queueSchedule.events) {
      const startTime = new Date(event.start).getTime();
      const endTime = new Date(event.end).getTime();
      
      if (now >= startTime && now <= endTime) {
        currentEvent = event;
      } else if (now < startTime) {
        if (!nextEvent || startTime < new Date(nextEvent.start).getTime()) {
          nextEvent = event;
        }
      }
    }
    
    return {
      isOutage: currentEvent !== null,
      currentEvent,
      nextEvent,
    };
  } catch (error) {
    logger.error('Error getting current status:', error);
    return { isOutage: false, nextEvent: null };
  }
}

/**
 * Get time until next event
 */
function getTimeUntilNextEvent(queueSchedule) {
  try {
    const status = getCurrentStatus(queueSchedule);
    
    if (status.currentEvent) {
      // Currently in outage, time until it ends
      const endTime = new Date(status.currentEvent.end).getTime();
      return endTime - Date.now();
    } else if (status.nextEvent) {
      // Time until next outage starts
      const startTime = new Date(status.nextEvent.start).getTime();
      return startTime - Date.now();
    }
    
    return null;
  } catch (error) {
    logger.error('Error calculating time until next event:', error);
    return null;
  }
}

/**
 * Format time duration
 */
function formatDuration(milliseconds) {
  if (!milliseconds || milliseconds < 0) {
    return 'невідомо';
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  const parts = [];
  if (days > 0) parts.push(`${days}д`);
  if (hours % 24 > 0) parts.push(`${hours % 24}г`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}хв`);
  
  return parts.join(' ') || 'менше хвилини';
}

module.exports = {
  parseScheduleData,
  getQueueSchedule,
  getCurrentStatus,
  getTimeUntilNextEvent,
  formatDuration,
};
