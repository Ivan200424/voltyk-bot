/**
 * API module for fetching schedule data
 */

import { get, set } from './storage/index.js';
import { config } from './config.js';

const CACHE_TTL = 60; // Cache TTL in seconds

/**
 * Fetch schedule data from GitHub repository
 * @param {string} region - Region code (e.g., 'kyiv', 'kyiv-region')
 * @returns {Promise<Object|null>} Schedule JSON data or null if failed
 */
export async function fetchScheduleData(region) {
  try {
    // Validate region parameter against known values
    const validRegions = Object.values(config.regionSlugs);
    if (!validRegions.includes(region)) {
      console.error(`Invalid region parameter: ${region}`);
      return null;
    }
    
    // Check cache first
    const cacheKey = `schedule_json:${region}`;
    let jsonData = await get(cacheKey);
    
    if (!jsonData) {
      // Fetch from GitHub
      const url = `https://raw.githubusercontent.com/Baskerville42/outage-data-ua/refs/heads/main/data/${region}.json`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Failed to fetch schedule from ${url}: ${response.status}`);
        return null;
      }
      
      jsonData = await response.json();
      
      // Cache the result
      await set(cacheKey, jsonData, CACHE_TTL);
    }
    
    return jsonData;
  } catch (error) {
    console.error(`Error fetching schedule data for ${region}:`, error);
    return null;
  }
}

/**
 * Get schedule image URL
 * @param {string} region - Region code
 * @param {string} queue - Queue (e.g., '3.1')
 * @returns {string} Image URL
 */
export function getScheduleImageUrl(region, queue) {
  const [group, subgroup] = queue.split('.');
  return `https://raw.githubusercontent.com/Baskerville42/outage-data-ua/refs/heads/main/images/${region}/gpv-${group}-${subgroup}-emergency.png`;
}
