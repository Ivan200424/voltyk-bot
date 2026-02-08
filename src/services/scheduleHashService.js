const crypto = require('crypto');
const { setCache, getCache } = require('../database/redis');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ScheduleHashService');

/**
 * Compute hash of schedule events
 * @param {Array} events - Array of schedule events
 * @returns {string} MD5 hash of events
 */
function computeHash(events) {
  if (!events || events.length === 0) {
    return '';
  }
  
  // Sort events by start time for consistent hashing
  const sortedEvents = [...events].sort((a, b) => {
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });
  
  // Create a stable string representation
  const dataString = JSON.stringify(sortedEvents);
  
  // Compute MD5 hash
  return crypto.createHash('md5').update(dataString).digest('hex');
}

/**
 * Get stored hash for a region/queue/day combination
 * @param {string} region - Region code
 * @param {string} queue - Queue number (e.g., '1.1')
 * @param {string} day - 'today' or 'tomorrow'
 * @returns {Promise<string|null>} Stored hash or null
 */
async function getStoredHash(region, queue, day) {
  try {
    const key = `hash:schedule:${region}:${queue}:${day}`;
    const hash = await getCache(key);
    return hash;
  } catch (error) {
    logger.error(`Error getting stored hash for ${region}:${queue}:${day}:`, error.message);
    return null;
  }
}

/**
 * Store hash for a region/queue/day combination
 * @param {string} region - Region code
 * @param {string} queue - Queue number (e.g., '1.1')
 * @param {string} day - 'today' or 'tomorrow'
 * @param {string} hash - Hash value to store
 * @returns {Promise<boolean>} Success status
 */
async function storeHash(region, queue, day, hash) {
  try {
    const key = `hash:schedule:${region}:${queue}:${day}`;
    // Use a long TTL (24 hours) so hashes persist across the day
    await setCache(key, hash, 86400);
    logger.debug(`Stored hash for ${region}:${queue}:${day}: ${hash}`);
    return true;
  } catch (error) {
    logger.error(`Error storing hash for ${region}:${queue}:${day}:`, error.message);
    return false;
  }
}

/**
 * Compare current events with stored hash and determine change type
 * @param {string} region - Region code
 * @param {string} queue - Queue number (e.g., '1.1')
 * @param {string} day - 'today' or 'tomorrow'
 * @param {Array} currentEvents - Current schedule events
 * @returns {Promise<Object>} Change information: { type, currentHash, previousHash }
 *   type: 'new' | 'updated' | 'unchanged' | 'removed'
 */
async function detectChange(region, queue, day, currentEvents) {
  try {
    const currentHash = computeHash(currentEvents);
    const previousHash = await getStoredHash(region, queue, day);
    
    // No previous hash - this is new data
    if (!previousHash) {
      // But only consider it "new" if there are actually events
      if (currentHash) {
        logger.info(`New schedule detected for ${region}:${queue}:${day}`);
        return { type: 'new', currentHash, previousHash: null };
      } else {
        // No previous hash and no current events - unchanged (no data)
        return { type: 'unchanged', currentHash, previousHash: null };
      }
    }
    
    // Data was removed (had hash, now empty)
    if (previousHash && !currentHash) {
      logger.info(`Schedule removed for ${region}:${queue}:${day}`);
      return { type: 'removed', currentHash, previousHash };
    }
    
    // Data changed
    if (currentHash !== previousHash) {
      logger.info(`Schedule updated for ${region}:${queue}:${day}`);
      return { type: 'updated', currentHash, previousHash };
    }
    
    // Data unchanged
    logger.debug(`Schedule unchanged for ${region}:${queue}:${day}`);
    return { type: 'unchanged', currentHash, previousHash };
  } catch (error) {
    logger.error(`Error detecting change for ${region}:${queue}:${day}:`, error.message);
    return { type: 'unchanged', currentHash: null, previousHash: null };
  }
}

/**
 * Filter events for a specific day (today or tomorrow)
 * @param {Array} events - All events
 * @param {string} targetDateString - Target date in YYYY-MM-DD format
 * @returns {Array} Filtered events
 */
function filterEventsByDate(events, targetDateString) {
  if (!events || events.length === 0) {
    return [];
  }
  
  return events.filter(event => {
    const eventDate = new Date(event.start);
    const eventDateString = eventDate.toISOString().split('T')[0];
    return eventDateString === targetDateString;
  });
}

module.exports = {
  computeHash,
  getStoredHash,
  storeHash,
  detectChange,
  filterEventsByDate,
};
