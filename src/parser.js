/**
 * Parser module for schedule data
 */

/**
 * Parse intervals from hourly data
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
 * @param {Object} hourlyData - Hourly status data
 * @returns {Array} Array of time intervals (e.g., ["00:00 - 03:00", "06:00 - 09:00"])
 */
export function parseIntervalsFromHourlyData(hourlyData) {
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
 * Calculate total hours from time intervals
 * @param {Array<string>} intervals - Array of time intervals
 * @returns {number} Total hours with half-hour precision
 */
export function calculateTotalHours(intervals) {
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
  const hours = Math.round(totalMinutes / 30) * 0.5;
  return hours;
}

/**
 * Check if date data is placeholder (all groups have "yes" for all 24 hours)
 * @param {Object} dateData - Date data object
 * @returns {boolean} True if placeholder data
 */
export function isPlaceholderData(dateData) {
  const groups = Object.keys(dateData);
  if (groups.length === 0) return false;
  
  return groups.every(gpvKey => {
    const hourlyData = dateData[gpvKey];
    if (!hourlyData || typeof hourlyData !== 'object') return false;
    
    for (let hour = 1; hour <= 24; hour++) {
      if (hourlyData[String(hour)] !== 'yes') {
        return false;
      }
    }
    return true;
  });
}
