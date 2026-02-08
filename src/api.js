const axios = require('axios');
const { setCache, getCache } = require('./database/redis');
const { createLogger } = require('./utils/logger');

const logger = createLogger('API');

const BASE_URL = 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data';
const CACHE_TTL = 300; // 5 minutes

/**
 * Fetch schedule data for a region
 */
async function fetchScheduleData(region) {
  try {
    // Check cache first
    const cached = await getCache(`schedule:${region}`);
    if (cached) {
      logger.debug(`Cache hit for region ${region}`);
      return cached;
    }
    
    // Fetch from GitHub
    const url = `${BASE_URL}/${region}.json`;
    logger.info(`Fetching schedule from ${url}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Voltyk-Bot/2.0',
      },
    });
    
    if (response.status === 200 && response.data) {
      // Cache the response
      await setCache(`schedule:${region}`, response.data, CACHE_TTL);
      logger.info(`Successfully fetched and cached schedule for ${region}`);
      return response.data;
    }
    
    logger.warn(`Invalid response for region ${region}:`, response.status);
    return null;
  } catch (error) {
    logger.error(`Error fetching schedule for ${region}:`, error.message);
    return null;
  }
}

/**
 * Fetch all schedules for all regions
 */
async function fetchAllSchedules(regions) {
  const promises = regions.map(region => fetchScheduleData(region));
  const results = await Promise.allSettled(promises);
  
  const schedules = {};
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      schedules[regions[index]] = result.value;
    }
  });
  
  return schedules;
}

module.exports = {
  fetchScheduleData,
  fetchAllSchedules,
};
