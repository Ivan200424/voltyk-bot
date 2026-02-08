const { createLogger } = require('./utils/logger');

const logger = createLogger('Parser');

/**
 * Parse schedule for a specific queue from real API format
 * @param {Object} data - API response with fact.data structure
 * @param {string} queue - Queue identifier (e.g., "1.1", "2.1")
 * @returns {Object} Parsed schedule with events array
 */
function parseScheduleForQueue(data, queue) {
  try {
    const queueKey = `GPV${queue}`;
    
    if (!data || !data.fact || !data.fact.data) {
      logger.warn('Invalid API data format: missing fact.data');
      return { queue, events: [], hasData: false };
    }
    
    const availableTimestamps = Object.keys(data.fact.data)
      .map(Number)
      .sort((a, b) => a - b);
    
    if (availableTimestamps.length === 0) {
      logger.warn('No timestamps found in API data');
      return { queue, events: [], hasData: false };
    }
    
    // Find today's timestamp in Europe/Kyiv timezone
    const now = new Date();
    const kyivOffset = 2; // UTC+2 for Europe/Kyiv (simplified)
    const kyivNow = new Date(now.getTime() + kyivOffset * 60 * 60 * 1000);
    const todayStart = new Date(kyivNow);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(todayStart.getTime() / 1000);
    
    // Find closest matching timestamp (prefer most recent before or equal to today)
    let bestTimestamp = availableTimestamps[availableTimestamps.length - 1];
    for (const ts of availableTimestamps) {
      if (ts <= todayTimestamp) {
        bestTimestamp = ts;
      }
    }
    
    const dayData = data.fact.data[bestTimestamp];
    if (!dayData || !dayData[queueKey]) {
      logger.warn(`No data found for queue ${queueKey} at timestamp ${bestTimestamp}`);
      return { queue, events: [], hasData: false };
    }
    
    const hourlyData = dayData[queueKey];
    const events = [];
    let currentStatus = null;
    let eventStart = null;
    
    // Parse hourly data and merge consecutive hours with same status
    for (let hour = 1; hour <= 24; hour++) {
      const status = hourlyData[String(hour)] || 'unknown';
      
      if (status !== currentStatus) {
        // Close previous event if exists
        if (currentStatus !== null) {
          events.push({
            start: eventStart,
            end: new Date((bestTimestamp + (hour - 1) * 3600) * 1000),
            status: currentStatus,
            hourStart: eventStart.getUTCHours(),
            hourEnd: hour - 1,
          });
        }
        // Start new event
        currentStatus = status;
        eventStart = new Date((bestTimestamp + (hour - 1) * 3600) * 1000);
      }
    }
    
    // Close last event
    if (currentStatus !== null) {
      events.push({
        start: eventStart,
        end: new Date((bestTimestamp + 24 * 3600) * 1000),
        status: currentStatus,
        hourStart: eventStart.getUTCHours(),
        hourEnd: 24,
      });
    }
    
    logger.debug(`Parsed ${events.length} events for queue ${queue}`);
    return { queue, events, hasData: true, timestamp: bestTimestamp };
  } catch (error) {
    logger.error(`Error parsing schedule for queue ${queue}:`, error);
    return { queue, events: [], hasData: false };
  }
}

/**
 * Get current power status for a parsed schedule
 * @param {Object} scheduleData - Parsed schedule from parseScheduleForQueue
 * @returns {Object} Current status with isOutage, currentEvent, nextEvent
 */
function getCurrentStatus(scheduleData) {
  try {
    if (!scheduleData || !scheduleData.events || scheduleData.events.length === 0) {
      return { isOutage: false, currentEvent: null, nextEvent: null };
    }
    
    const now = Date.now();
    
    // Find current and next events
    let currentEvent = null;
    let nextEvent = null;
    
    for (const event of scheduleData.events) {
      const startTime = new Date(event.start).getTime();
      const endTime = new Date(event.end).getTime();
      
      if (now >= startTime && now < endTime) {
        currentEvent = event;
      } else if (now < startTime) {
        if (!nextEvent || startTime < new Date(nextEvent.start).getTime()) {
          nextEvent = event;
        }
      }
    }
    
    // Determine if current status is an outage (no power)
    // "no" means power off, "yes" means power on, "maybe" is uncertain
    const isOutage = currentEvent && currentEvent.status === 'no';
    
    return {
      isOutage,
      currentEvent,
      nextEvent,
    };
  } catch (error) {
    logger.error('Error getting current status:', error);
    return { isOutage: false, currentEvent: null, nextEvent: null };
  }
}

/**
 * Get time until next status change event
 * @param {Object} scheduleData - Parsed schedule from parseScheduleForQueue
 * @returns {number|null} Milliseconds until next event or null
 */
function getTimeUntilNextEvent(scheduleData) {
  try {
    const status = getCurrentStatus(scheduleData);
    
    if (status.currentEvent) {
      // Currently in an event, time until it ends
      const endTime = new Date(status.currentEvent.end).getTime();
      return endTime - Date.now();
    } else if (status.nextEvent) {
      // Time until next event starts
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
  parseScheduleForQueue,
  getCurrentStatus,
  getTimeUntilNextEvent,
  formatDuration,
};
