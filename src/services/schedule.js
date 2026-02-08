import crypto from 'crypto';
import { get, set } from '../storage/index.js';
import { config } from '../config.js';

const DAYS_OF_WEEK = [
  'Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'
];

const CACHE_TTL = 60; // Cache TTL in seconds

/**
 * Generate hash from schedule content
 * Using SHA-256 for better collision resistance
 */
function generateHash(content) {
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

/**
 * Format date in DD.MM.YYYY format
 */
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Get day of week in Ukrainian
 */
function getDayOfWeek(date) {
  return DAYS_OF_WEEK[date.getDay()];
}

/**
 * Calculate total hours from time intervals
 * Returns rounded hours for display
 */
function calculateTotalHours(intervals) {
  let totalMinutes = 0;
  
  for (const interval of intervals) {
    const [startTime, endTime] = interval.split(' - ');
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    // Handle crossing midnight
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    
    totalMinutes += endMinutes - startMinutes;
  }
  
  // Using Math.round for display - spec shows whole hours
  const hours = Math.round(totalMinutes / 60);
  return hours;
}

/**
 * Convert hour status values to time intervals
 * Status values: "yes" (outage), "first" (partial), "second" (partial), "no" (power)
 */
function parseIntervalsFromHourlyData(hourlyData) {
  const intervals = [];
  let currentStart = null;
  
  for (let hour = 1; hour <= 24; hour++) {
    const status = hourlyData[String(hour)];
    const hasOutage = status === 'yes' || status === 'first' || status === 'second';
    
    if (hasOutage && currentStart === null) {
      // Start of an outage interval
      currentStart = hour - 1; // Hour 1 means 00:00-01:00, so start is 0
    } else if (!hasOutage && currentStart !== null) {
      // End of an outage interval
      const startTime = String(currentStart).padStart(2, '0') + ':00';
      const endTime = String(hour - 1).padStart(2, '0') + ':00';
      intervals.push(`${startTime} - ${endTime}`);
      currentStart = null;
    }
  }
  
  // Handle case where outage extends to end of day
  if (currentStart !== null) {
    const startTime = String(currentStart).padStart(2, '0') + ':00';
    // If starts at 00:00, it's the whole day
    if (currentStart === 0) {
      intervals.push('00:00 - 24:00');
    } else {
      intervals.push(`${startTime} - 24:00`);
    }
  }
  
  return intervals;
}

/**
 * Get date timestamp for schedule data lookup
 * The outage-data-ua repo stores dates at 22:00 UTC (which is midnight Kyiv time, UTC+2)
 */
function getDateTimestamp(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  // Get UTC midnight for the date, then subtract 2 hours to get 22:00 UTC of previous day
  const utcMidnight = Date.UTC(year, month, day, 0, 0, 0, 0);
  const kyivMidnight = utcMidnight - (2 * 60 * 60 * 1000); // Subtract 2 hours
  return Math.floor(kyivMidnight / 1000);
}

/**
 * Fetch schedule data from outage-data-ua repository
 */
async function fetchScheduleFromRepo(region, queue, date) {
  try {
    // Resolve region slug
    const regionSlug = config.regionSlugs[region];
    if (!regionSlug) {
      console.error(`No region slug found for region: ${region}`);
      return null;
    }
    
    // Check cache first
    const cacheKey = `schedule_json:${regionSlug}`;
    let jsonData = await get(cacheKey);
    
    if (!jsonData) {
      // Fetch from GitHub
      const url = `https://raw.githubusercontent.com/Baskerville42/outage-data-ua/refs/heads/main/data/${regionSlug}.json`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Failed to fetch schedule from ${url}: ${response.status}`);
        return null;
      }
      
      jsonData = await response.json();
      
      // Cache the result
      await set(cacheKey, jsonData, CACHE_TTL);
    }
    
    // Get timestamp for the requested date (midnight UTC)
    const dateTimestamp = getDateTimestamp(date);
    const dateKey = String(dateTimestamp);
    
    // Extract schedule for the date
    const dateData = jsonData?.fact?.data?.[dateKey];
    if (!dateData) {
      console.error(`No data found for date ${dateKey} in ${regionSlug}`);
      return null;
    }
    
    // Map queue to GPV key (e.g., "3.1" -> "GPV3.1")
    const [group, subgroup] = queue.split('.');
    const gpvKey = `GPV${group}.${subgroup}`;
    
    const hourlyData = dateData[gpvKey];
    if (!hourlyData) {
      console.error(`No data found for queue ${gpvKey} in ${regionSlug} on ${dateKey}`);
      return null;
    }
    
    // Parse intervals from hourly data
    const intervals = parseIntervalsFromHourlyData(hourlyData);
    
    // Build image URL
    const imageUrl = `https://raw.githubusercontent.com/Baskerville42/outage-data-ua/refs/heads/main/images/${regionSlug}/gpv-${group}-${subgroup}-emergency.png`;
    
    return {
      region,
      queue,
      date: formatDate(date),
      intervals,
      imageUrl
    };
  } catch (error) {
    console.error(`Error fetching schedule from repo:`, error);
    return null;
  }
}

/**
 * Get schedule for today and tomorrow
 */
export async function getScheduleData(region, queue) {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Fetch schedules
    const todaySchedule = await fetchScheduleFromRepo(region, queue, today);
    const tomorrowSchedule = await fetchScheduleFromRepo(region, queue, tomorrow);
    
    // Calculate hashes
    const todayHash = generateHash(todaySchedule.intervals);
    const tomorrowHash = tomorrowSchedule ? generateHash(tomorrowSchedule.intervals) : null;
    
    return {
      today: {
        date: formatDate(today),
        dayOfWeek: getDayOfWeek(today),
        intervals: todaySchedule.intervals,
        totalHours: calculateTotalHours(todaySchedule.intervals),
        hash: todayHash,
        imageUrl: todaySchedule.imageUrl
      },
      tomorrow: tomorrowSchedule ? {
        date: formatDate(tomorrow),
        dayOfWeek: getDayOfWeek(tomorrow),
        intervals: tomorrowSchedule.intervals,
        totalHours: calculateTotalHours(tomorrowSchedule.intervals),
        hash: tomorrowHash,
        imageUrl: tomorrowSchedule.imageUrl
      } : null
    };
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return null;
  }
}

/**
 * Get cached schedule hashes for a user
 */
export async function getScheduleHashes(userId) {
  return await get(`schedule_hashes:${userId}`) || {
    todayHash: null,
    tomorrowHash: null,
    lastCheck: null
  };
}

/**
 * Update cached schedule hashes
 */
export async function updateScheduleHashes(userId, todayHash, tomorrowHash) {
  await set(`schedule_hashes:${userId}`, {
    todayHash,
    tomorrowHash,
    lastCheck: Date.now()
  });
}

/**
 * Determine what changed between old and new schedules
 */
export function detectScheduleChanges(oldHashes, newSchedule) {
  const changes = {
    todayChanged: false,
    todayIsNew: false,
    tomorrowChanged: false,
    tomorrowIsNew: false
  };
  
  // Check today's schedule
  if (!oldHashes.todayHash) {
    changes.todayIsNew = true;
  } else if (oldHashes.todayHash !== newSchedule.today.hash) {
    changes.todayChanged = true;
  }
  
  // Check tomorrow's schedule
  if (newSchedule.tomorrow) {
    if (!oldHashes.tomorrowHash) {
      changes.tomorrowIsNew = true;
    } else if (oldHashes.tomorrowHash !== newSchedule.tomorrow.hash) {
      changes.tomorrowChanged = true;
    }
  }
  
  return changes;
}

/**
 * Get schedule check interval (in milliseconds)
 */
export async function getCheckInterval() {
  const interval = await get('schedule_check_interval');
  return interval || 60000; // Default: 1 minute
}

/**
 * Set schedule check interval
 */
export async function setCheckInterval(intervalMs) {
  await set('schedule_check_interval', intervalMs);
}
