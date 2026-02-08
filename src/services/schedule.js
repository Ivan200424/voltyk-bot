import crypto from 'crypto';
import { get, set } from '../storage/index.js';
import { config } from '../config.js';

const DAYS_OF_WEEK = [
  'Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'
];

const CACHE_TTL = 60; // Cache TTL in seconds
const KYIV_UTC_OFFSET_MS = 2 * 60 * 60 * 1000; // Kyiv timezone offset: UTC+2 (no DST)

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
 * Returns hours with half-hour precision (e.g., 2.5)
 */
function calculateTotalHours(intervals) {
  let totalMinutes = 0;
  
  for (const interval of intervals) {
    const [startTime, endTime] = interval.split(' - ');
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    // Handle crossing midnight (end time is 00:00 meaning next day)
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
    }
    
    totalMinutes += endMinutes - startMinutes;
  }
  
  // Return hours with half-hour precision
  // Round to nearest 0.5 (e.g., 2.3 → 2.5, 2.7 → 3.0)
  const hours = Math.round(totalMinutes / 30) * 0.5;
  return hours;
}

/**
 * Convert hour status values to time intervals
 * Status values:
 *   "yes" - Power is ON (no outage)
 *   "no" - Planned outage for full hour
 *   "first" - Planned outage for first half (00-30 min)
 *   "second" - Planned outage for second half (30-60 min)
 *   "maybe" - Possible outage for full hour
 *   "mfirst" - Possible outage for first half
 *   "msecond" - Possible outage for second half
 * 
 * Key N represents period from (N-1):00 to N:00
 * Returns array of objects with { start, end, isPossible }
 */
function parseIntervalsFromHourlyData(hourlyData) {
  const outages = [];
  
  // Parse all outage periods from hourly data
  for (let hour = 1; hour <= 24; hour++) {
    const status = hourlyData[String(hour)];
    
    // Skip if power is ON
    if (status === 'yes' || !status) {
      continue;
    }
    
    const hourStart = hour - 1; // Key N → period starts at (N-1):00
    let startMinutes, endMinutes;
    let isPossible = false;
    
    switch (status) {
      case 'no':
        // Full hour outage: (N-1):00 to N:00
        startMinutes = hourStart * 60;
        endMinutes = hour * 60;
        break;
      case 'first':
        // First half: (N-1):00 to (N-1):30
        startMinutes = hourStart * 60;
        endMinutes = hourStart * 60 + 30;
        break;
      case 'second':
        // Second half: (N-1):30 to N:00
        startMinutes = hourStart * 60 + 30;
        endMinutes = hour * 60;
        break;
      case 'maybe':
        // Possible full hour: (N-1):00 to N:00
        startMinutes = hourStart * 60;
        endMinutes = hour * 60;
        isPossible = true;
        break;
      case 'mfirst':
        // Possible first half: (N-1):00 to (N-1):30
        startMinutes = hourStart * 60;
        endMinutes = hourStart * 60 + 30;
        isPossible = true;
        break;
      case 'msecond':
        // Possible second half: (N-1):30 to N:00
        startMinutes = hourStart * 60 + 30;
        endMinutes = hour * 60;
        isPossible = true;
        break;
      default:
        // Unknown status - skip
        continue;
    }
    
    outages.push({ start: startMinutes, end: endMinutes, isPossible });
  }
  
  // Merge consecutive outages of the same type (planned or possible)
  const merged = [];
  
  for (const outage of outages) {
    if (merged.length === 0) {
      merged.push(outage);
      continue;
    }
    
    const last = merged[merged.length - 1];
    
    // Merge if same type and consecutive (end of previous == start of current)
    if (last.isPossible === outage.isPossible && last.end === outage.start) {
      last.end = outage.end;
    } else {
      merged.push(outage);
    }
  }
  
  // Convert to time strings with HH:MM format
  return merged.map(outage => {
    const startH = Math.floor(outage.start / 60);
    const startM = outage.start % 60;
    let endH = Math.floor(outage.end / 60);
    const endM = outage.end % 60;
    
    // Handle midnight: 24:00 should be displayed as 00:00
    if (endH === 24 && endM === 0) {
      endH = 0;
    }
    
    const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    
    return `${startTime} - ${endTime}`;
  });
}

/**
 * Get current date in Kyiv timezone (UTC+2)
 * Returns a Date object representing midnight UTC for the current Kyiv date
 * Note: Ukraine is permanently UTC+2 (no DST since 2011)
 */
function getKyivDate() {
  const now = new Date();
  // Shift to Kyiv time (UTC+2) to get the correct date
  const kyivTime = new Date(now.getTime() + KYIV_UTC_OFFSET_MS);
  // Return a date object representing the Kyiv date at midnight UTC
  return new Date(Date.UTC(kyivTime.getUTCFullYear(), kyivTime.getUTCMonth(), kyivTime.getUTCDate()));
}

/**
 * Get date timestamp for schedule data lookup
 * The outage-data-ua repo stores dates at 22:00 UTC (which is midnight Kyiv time)
 * Note: Ukraine is permanently UTC+2 (no DST since 2011)
 */
function getDateTimestamp(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  // Get timestamp for 22:00 UTC (midnight Kyiv time) of the date
  const utcMidnight = Date.UTC(year, month, day, 0, 0, 0, 0);
  const kyivMidnight = utcMidnight - KYIV_UTC_OFFSET_MS; // Subtract UTC+2 offset
  return Math.floor(kyivMidnight / 1000);
}

/**
 * Check if date data is placeholder (all groups have "yes" for all 24 hours)
 * outage-data-ua fills unpublished days with "yes" x 24 for all GPV groups
 */
function isPlaceholderData(dateData) {
  const groups = Object.keys(dateData);
  if (groups.length === 0) return false; // No groups means malformed data, not placeholder
  
  return groups.every(gpvKey => {
    const hourlyData = dateData[gpvKey];
    if (!hourlyData || typeof hourlyData !== 'object') return false; // Invalid data structure
    
    for (let hour = 1; hour <= 24; hour++) {
      if (hourlyData[String(hour)] !== 'yes') {
        return false;
      }
    }
    return true;
  });
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
    
    // Get timestamp for the requested date (22:00 UTC / midnight Kyiv time)
    const dateTimestamp = getDateTimestamp(date);
    const dateKey = String(dateTimestamp);
    
    // Extract schedule for the date
    const dateData = jsonData?.fact?.data?.[dateKey];
    if (!dateData) {
      console.error(`No data found for date ${dateKey} in ${regionSlug}`);
      return null;
    }
    
    // Check if this is placeholder data (all "yes" for all groups)
    if (isPlaceholderData(dateData)) {
      console.log(`Placeholder data detected for ${dateKey} in ${regionSlug}, skipping`);
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
      hourlyData, // Include raw hourly data for hash generation
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
    const today = getKyivDate();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Fetch schedules
    const todaySchedule = await fetchScheduleFromRepo(region, queue, today);
    const tomorrowSchedule = await fetchScheduleFromRepo(region, queue, tomorrow);
    
    // If today's schedule is not available, return null
    if (!todaySchedule) {
      return null;
    }
    
    // Calculate hashes
    const todayHash = generateHash(todaySchedule.hourlyData);
    const tomorrowHash = tomorrowSchedule ? generateHash(tomorrowSchedule.hourlyData) : null;
    
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
