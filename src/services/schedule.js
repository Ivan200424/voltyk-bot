import crypto from 'crypto';
import { get, set } from '../storage/index.js';

// Mock data structure for outage-data-ua repo
// In production, this would fetch from https://github.com/Baskerville42/outage-data-ua
// For now, we'll use mock data to implement the full logic

const DAYS_OF_WEEK = [
  'Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'
];

/**
 * Generate hash from schedule content
 */
function generateHash(content) {
  return crypto.createHash('md5').update(JSON.stringify(content)).digest('hex');
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
  
  const hours = Math.round(totalMinutes / 60);
  return hours;
}

/**
 * Fetch schedule data from outage-data-ua repository
 * This is a mock implementation - in production, fetch from actual GitHub repo
 */
async function fetchScheduleFromRepo(region, queue, date) {
  // TODO: Replace with actual fetch from https://github.com/Baskerville42/outage-data-ua
  // For now, return mock data structure
  
  // Mock data - simulating JSON structure from outage-data-ua
  const mockSchedule = {
    region,
    queue,
    date: formatDate(date),
    intervals: [
      '00:00 - 03:00',
      '06:30 - 13:30',
      '17:00 - 00:00'
    ],
    imageUrl: 'https://example.com/schedule.jpg' // Placeholder
  };
  
  return mockSchedule;
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
