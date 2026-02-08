const { config } = require('../config');

/**
 * Ukrainian day names
 */
const UKRAINIAN_DAY_NAMES = [
  'Неділя',
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  'П\'ятниця',
  'Субота',
];

/**
 * Get Ukrainian day name for a date
 * @param {Date} date - The date object
 * @returns {string} Ukrainian day name
 */
function getUkrainianDayName(date) {
  const dayIndex = date.getDay();
  return UKRAINIAN_DAY_NAMES[dayIndex];
}

/**
 * Format date in Ukrainian format: DD.MM.YYYY (DayName)
 * @param {Date} date - The date object
 * @returns {string} Formatted date string
 */
function formatDateUkrainian(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const dayName = getUkrainianDayName(date);
  
  return `${day}.${month}.${year} (${dayName})`;
}

/**
 * Get today's date string in YYYY-MM-DD format
 * @returns {string} Today's date
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get tomorrow's date string in YYYY-MM-DD format
 * @returns {string} Tomorrow's date
 */
function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date string or Date object is today
 * @param {string|Date} eventDate - Date string (YYYY-MM-DD) or Date object
 * @returns {boolean} True if today
 */
function isToday(eventDate) {
  const today = getTodayDateString();
  
  if (typeof eventDate === 'string') {
    // Extract date part from ISO string or date string
    const datePart = eventDate.split('T')[0];
    return datePart === today;
  } else if (eventDate instanceof Date) {
    const year = eventDate.getFullYear();
    const month = String(eventDate.getMonth() + 1).padStart(2, '0');
    const day = String(eventDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}` === today;
  }
  
  return false;
}

/**
 * Check if a date string or Date object is tomorrow
 * @param {string|Date} eventDate - Date string (YYYY-MM-DD) or Date object
 * @returns {boolean} True if tomorrow
 */
function isTomorrow(eventDate) {
  const tomorrow = getTomorrowDateString();
  
  if (typeof eventDate === 'string') {
    // Extract date part from ISO string or date string
    const datePart = eventDate.split('T')[0];
    return datePart === tomorrow;
  } else if (eventDate instanceof Date) {
    const year = eventDate.getFullYear();
    const month = String(eventDate.getMonth() + 1).padStart(2, '0');
    const day = String(eventDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}` === tomorrow;
  }
  
  return false;
}

/**
 * Get today's Date object
 * @returns {Date} Today's date
 */
function getTodayDate() {
  return new Date();
}

/**
 * Get tomorrow's Date object
 * @returns {Date} Tomorrow's date
 */
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

module.exports = {
  getUkrainianDayName,
  formatDateUkrainian,
  getTodayDateString,
  getTomorrowDateString,
  isToday,
  isTomorrow,
  getTodayDate,
  getTomorrowDate,
};
