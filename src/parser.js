const { createLogger } = require('./utils/logger');

const logger = createLogger('Parser');

const MIN_HOUR = 1;
const MAX_HOUR = 24;

/**
 * Validate schedule data structure
 * Expected format: { fact: { data: { [timestamp]: { GPV1.1: {...}, ... } } } }
 */
function parseScheduleData(data) {
  try {
    if (!data || typeof data !== 'object') {
      logger.warn('Invalid schedule data: not an object');
      return null;
    }
    
    // Check for the real API format: data.fact.data
    if (!data.fact || !data.fact.data || typeof data.fact.data !== 'object') {
      logger.warn('Invalid schedule data format: missing fact.data');
      return null;
    }
    
    return data;
  } catch (error) {
    logger.error('Error parsing schedule data:', error);
    return null;
  }
}

/**
 * Create a Date object from a period's start/end time
 * @param {Date} baseDate - Base date for the period
 * @param {number} time - Time as a decimal (e.g., 13.5 for 13:30)
 * @returns {Date} Date object with the specified time
 */
function createDateFromPeriod(baseDate, time) {
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    Math.floor(time),
    (time % 1) * 60
  );
}

/**
 * Parse schedule for a specific queue
 * Constructs GPV key and parses hourly schedule data
 * @param {Object} data - Schedule data from API
 * @param {string} queue - Queue identifier (e.g., "1.1", "2.1") - already includes both major and minor components
 * @returns {Object} Parsed queue data with events array
 */
function parseScheduleForQueue(data, queue) {
  try {
    // Construct GPV key: queue "1.1" becomes "GPV1.1"
    const queueKey = `GPV${queue}`;
    
    // Validate data structure
    if (!data || !data.fact || !data.fact.data) {
      logger.warn('Invalid data structure for queue parsing');
      return {
        queue,
        queueKey,
        events: [],
        hasData: false,
      };
    }
    
    // Get available timestamps (days) and sort them
    const availableTimestamps = Object.keys(data.fact.data).map(Number).sort((a, b) => a - b);
    
    if (availableTimestamps.length === 0) {
      logger.warn('No timestamp data available');
      return {
        queue,
        queueKey,
        events: [],
        hasData: false,
      };
    }
    
    // Use first two timestamps (today and tomorrow if available)
    const todayTimestamp = availableTimestamps[0];
    const tomorrowTimestamp = availableTimestamps.length > 1 ? availableTimestamps[1] : null;
    
    const todaySchedule = data.fact.data[todayTimestamp]?.[queueKey];
    const tomorrowSchedule = tomorrowTimestamp ? data.fact.data[tomorrowTimestamp]?.[queueKey] : null;
    
    if (!todaySchedule) {
      logger.warn(`No schedule found for queue ${queue} (${queueKey})`);
      return {
        queue,
        queueKey,
        events: [],
        hasData: false,
      };
    }
    
    // Parse hourly schedules
    const todayParsed = parseHourlySchedule(todaySchedule);
    const tomorrowParsed = tomorrowSchedule ? parseHourlySchedule(tomorrowSchedule) : { planned: [], possible: [] };
    
    // Convert periods to events with absolute timestamps
    const events = [];
    const todayDate = new Date(todayTimestamp * 1000);
    
    // Add today's events
    todayParsed.planned.forEach(period => {
      events.push({
        type: 'outage',
        start: createDateFromPeriod(todayDate, period.start),
        end: createDateFromPeriod(todayDate, period.end),
        isPossible: false,
      });
    });
    
    todayParsed.possible.forEach(period => {
      events.push({
        type: 'outage',
        start: createDateFromPeriod(todayDate, period.start),
        end: createDateFromPeriod(todayDate, period.end),
        isPossible: true,
      });
    });
    
    // Add tomorrow's events if available
    if (tomorrowTimestamp && tomorrowSchedule) {
      const tomorrowDateObj = new Date(tomorrowTimestamp * 1000);
      
      tomorrowParsed.planned.forEach(period => {
        events.push({
          type: 'outage',
          start: createDateFromPeriod(tomorrowDateObj, period.start),
          end: createDateFromPeriod(tomorrowDateObj, period.end),
          isPossible: false,
        });
      });
      
      tomorrowParsed.possible.forEach(period => {
        events.push({
          type: 'outage',
          start: createDateFromPeriod(tomorrowDateObj, period.start),
          end: createDateFromPeriod(tomorrowDateObj, period.end),
          isPossible: true,
        });
      });
    }
    
    // Sort events by start time
    events.sort((a, b) => a.start - b.start);
    
    return {
      queue,
      queueKey,
      events,
      hasData: events.length > 0,
    };
  } catch (error) {
    logger.error(`Error parsing schedule for queue ${queue}:`, error);
    return {
      queue,
      queueKey: `GPV${queue}`,
      events: [],
      hasData: false,
      error: error.message,
    };
  }
}

/**
 * Parse hourly schedule data
 * Returns planned and possible outage periods
 */
function parseHourlySchedule(hourlyData) {
  const planned = [];
  const possible = [];
  
  for (let hour = MIN_HOUR; hour <= MAX_HOUR; hour++) {
    const hourStr = hour.toString();
    // Skip if hour data is missing
    if (!(hourStr in hourlyData)) {
      logger.debug(`Hour ${hour} not found in schedule data`);
      continue;
    }
    
    const factValue = hourlyData[hourStr];
    
    if (factValue === 'no' || factValue === 'first' || factValue === 'second') {
      addOutagePeriod(planned, hour, factValue);
    } else if (factValue === 'maybe' || factValue === 'mfirst' || factValue === 'msecond') {
      addOutagePeriod(possible, hour, factValue);
    }
  }
  
  return {
    planned: mergeConsecutivePeriods(planned),
    possible: mergeConsecutivePeriods(possible),
  };
}

/**
 * Add outage period based on hour and value
 * Note: Data uses 1-based hour indexing (1-24)
 * where hour=14 means period 13:00-14:00
 */
function addOutagePeriod(periods, hour, value) {
  if (value === 'no' || value === 'maybe') {
    // Full hour outage (e.g., hour=14 -> 13:00-14:00)
    addOrExtendPeriod(periods, hour - 1, hour);
  } else if (value === 'first' || value === 'mfirst') {
    // First half hour (e.g., hour=14 -> 13:00-13:30)
    addOrExtendPeriod(periods, hour - 1, hour - 0.5);
  } else if (value === 'second' || value === 'msecond') {
    // Second half hour (e.g., hour=14 -> 13:30-14:00)
    addOrExtendPeriod(periods, hour - 0.5, hour);
  }
}

/**
 * Add or extend a period
 */
function addOrExtendPeriod(periods, start, end) {
  const lastPeriod = periods[periods.length - 1];
  
  if (lastPeriod && lastPeriod.end === start) {
    // Extend existing period
    lastPeriod.end = end;
  } else {
    // Add new period
    periods.push({ start, end });
  }
}

/**
 * Merge consecutive periods
 */
function mergeConsecutivePeriods(periods) {
  const merged = [];
  
  for (const period of periods) {
    const last = merged[merged.length - 1];
    
    if (last && last.end === period.start) {
      last.end = period.end;
    } else {
      merged.push({ ...period });
    }
  }
  
  return merged;
}

/**
 * Get current outage status for a queue
 */
function getCurrentStatus(queueData) {
  try {
    if (!queueData || !queueData.events || queueData.events.length === 0) {
      return { 
        isOutage: false, 
        currentEvent: null,
        nextEvent: null,
        isPossible: false 
      };
    }
    
    const now = new Date();
    
    // Find current and next events
    let currentEvent = null;
    let nextEvent = null;
    
    for (const event of queueData.events) {
      if (now >= event.start && now <= event.end) {
        currentEvent = event;
      } else if (now < event.start) {
        if (!nextEvent || event.start < nextEvent.start) {
          nextEvent = event;
        }
      }
    }
    
    return {
      isOutage: currentEvent !== null,
      currentEvent,
      nextEvent,
      isPossible: currentEvent?.isPossible || false,
    };
  } catch (error) {
    logger.error('Error getting current status:', error);
    return { 
      isOutage: false, 
      currentEvent: null,
      nextEvent: null,
      isPossible: false 
    };
  }
}

/**
 * Get time until next event
 */
function getTimeUntilNextEvent(queueData) {
  try {
    const status = getCurrentStatus(queueData);
    
    if (status.currentEvent) {
      // Currently in outage, time until it ends
      return status.currentEvent.end.getTime() - Date.now();
    } else if (status.nextEvent) {
      // Time until next outage starts
      return status.nextEvent.start.getTime() - Date.now();
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
  parseScheduleForQueue,
  getCurrentStatus,
  getTimeUntilNextEvent,
  formatDuration,
  // Legacy export for backwards compatibility
  getQueueSchedule: (scheduleData, queue) => {
    // This is now a wrapper around parseScheduleForQueue
    if (!scheduleData) return null;
    return parseScheduleForQueue(scheduleData, queue);
  },
};
