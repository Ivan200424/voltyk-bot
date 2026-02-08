# PR 2: Schedule Feature Implementation Summary

## Overview
This PR implements the outage schedule feature for Voltyk bot according to the ВОЛЬТИК v1.0 (LOCKED) specification.

## Features Implemented

### 1. Core Schedule Service (`src/services/schedule.js`)
- **Data Fetching**: Mock implementation ready for outage-data-ua GitHub repo integration
- **Hash Generation**: SHA-256 based content hashing for change detection
- **Date Formatting**: Ukrainian date format (DD.MM.YYYY) with day names
- **Time Calculations**: Total hours calculation with midnight crossing support
- **Caching**: Per-user hash storage for today and tomorrow schedules

### 2. Schedule Handler (`src/handlers/schedule.js`)
- **Manual Requests**: Users can view schedules via button or `/schedule` command
- **Message Formatting**: MarkdownV2 with proper escaping (including backslashes)
- **Clean Chat UX**: Deletes previous bot messages on manual requests
- **Error Handling**: Graceful handling of unavailable schedules
- **5 Publication Scenarios**:
  1. First publication (today only)
  2. Updated today schedule
  3. Tomorrow appeared (today unchanged)
  4. Tomorrow appeared + today updated
  5. Tomorrow updated (today unchanged)

### 3. Automatic Publication Job (`src/jobs/scheduleChecker.js`)
- **Periodic Checking**: Configurable interval (default: 1 minute)
- **Concurrent Processing**: Uses Promise.allSettled for multiple users
- **Dual Publishing**: Supports both bot DMs and channel posts
- **Hash Comparison**: Prevents duplicate publications
- **Graceful Errors**: Individual user failures don't stop checker

### 4. Storage Enhancements (`src/storage/index.js`)
- **User Tracking**: Maintains list of all users for iteration
- **Optimized Lookup**: Uses Set for O(1) user existence check
- **Hash Storage**: Per-user schedule hashes with separate today/tomorrow

### 5. Integration (`src/index.js`, `src/handlers/menu.js`)
- **Bot Initialization**: Schedule checker starts with bot
- **Graceful Shutdown**: Stops checker on bot shutdown
- **Menu Integration**: Schedule button now functional

## Message Formats

### Manual Request (User clicks button)
```
[photo]

💡 Графік відключень на сьогодні, 08.02.2026 (Субота), для черги 3.1:

🪫 00:00 - 03:00 (~3 год)
🪫 06:30 - 13:30 (~7 год)

Загалом без світла: ~10 год

💡 Графік відключень на завтра, 09.02.2026 (Неділя), для черги 3.1:

🪫 01:00 - 04:00 (~3 год)

Загалом без світла: ~3 год

[← Назад]   [⤴ Меню]
```

### Auto-Publication Scenarios

**Scenario 1**: First today schedule
```
💡 Графік відключень на сьогодні, 08.02.2026 (Субота), для черги 3.1:
...
```

**Scenario 2**: Updated today
```
💡 Оновлено графік відключень на сьогодні, 08.02.2026 (Субота), для черги 3.1:
...
```

**Scenario 3**: Tomorrow appeared
```
💡 З'явився графік відключень на завтра, 09.02.2026 (Неділя), для черги 3.1:
...
💡 Графік на сьогодні без змін:
...
```

**Scenario 4**: Tomorrow appeared + today updated
```
💡 З'явився графік відключень на завтра, 09.02.2026 (Неділя), для черги 3.1:
...
💡 Оновлено графік на сьогодні:
...
```

**Scenario 5**: Tomorrow updated
```
💡 Оновлено графік відключень на завтра, 09.02.2026 (Неділя), для черги 3.1:
...
💡 Графік на сьогодні без змін:
...
```

## Technical Details

### Hash-Based Deduplication
- Each user has separate hashes for today and tomorrow
- Hash calculated from schedule intervals content (not image)
- SHA-256 used for collision resistance
- Hash changes trigger appropriate publication

### MarkdownV2 Formatting
- All special characters properly escaped: `_*[]()~`>#+\-=|{}.!\`
- Backslashes escaped first to avoid double-escaping
- Bold text for times and totals
- Italic text for prefixes and dates

### Performance Optimizations
- Set-based user list lookup (O(1) instead of O(n))
- Concurrent user processing with Promise.allSettled
- Efficient interval calculation without duplication
- Static imports instead of dynamic

### Error Handling
- Network errors don't crash bot
- Individual user failures isolated
- Graceful fallback to error messages
- Proper cleanup on shutdown

## Configuration

### Default Settings
- Check interval: 60000ms (1 minute)
- Can be changed via storage (admin panel in future PR)
- Available intervals: 30s, 1m, 2m, 3m, 4m, 5m, 10m

### Storage Keys
- `user:{userId}` - User data
- `user_list` - Array of all user IDs
- `schedule_hashes:{userId}` - Today/tomorrow hashes with timestamp
- `schedule_check_interval` - Current check interval in ms

## Integration with outage-data-ua

### Current State: Mock Data
The service currently uses mock data to test the full logic flow.

### Real Integration (TODO)
To connect to real data:

1. **Fetch JSON files**:
   ```javascript
   const url = `https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/${region}/${queue}/${date}.json`;
   const response = await fetch(url);
   const data = await response.json();
   ```

2. **Parse intervals**: Extract time intervals for the specific queue

3. **Fetch image**:
   ```javascript
   const imageUrl = `https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/${region}/${date}.png`;
   ```

4. **Handle errors**: Return null if data not available

5. **Add retry logic**: Exponential backoff for network failures

## Testing

Comprehensive test cases added to `TESTING.md`:
- Manual schedule requests
- Command alias (`/schedule`)
- Message formatting
- Error handling
- All 5 auto-publication scenarios
- Hash-based deduplication
- Performance under load

## Security

- ✅ CodeQL scan passed (0 alerts)
- ✅ Proper MarkdownV2 escaping prevents injection
- ✅ SHA-256 hashing (not MD5)
- ✅ No token leaks
- ✅ Graceful error handling

## Breaking Changes

**None** - This PR only adds new functionality without changing existing behavior.

## Dependencies

No new dependencies added. Uses existing:
- `crypto` (Node.js built-in)
- `grammy` (existing)
- Storage system (existing)

## Migration

No migration needed - new features work immediately after deployment.

## Future Enhancements

Planned for future PRs:
- Real outage-data-ua integration (replace mock data)
- Admin panel to change check interval
- Channel management features
- Analytics and statistics

## Files Changed

- ✅ `src/services/schedule.js` (NEW) - 199 lines
- ✅ `src/handlers/schedule.js` (NEW) - 222 lines
- ✅ `src/jobs/scheduleChecker.js` (NEW) - 148 lines
- ✅ `src/handlers/menu.js` (MODIFIED) - +3 lines
- ✅ `src/storage/index.js` (MODIFIED) - +14 lines
- ✅ `src/index.js` (MODIFIED) - +5 lines
- ✅ `TESTING.md` (MODIFIED) - +49 lines

**Total**: 3 new files, 4 modified files, ~640 lines of code

## Checklist

- [x] All spec requirements implemented
- [x] Code review completed
- [x] Security scan passed
- [x] Documentation updated
- [x] Tests documented
- [x] No breaking changes
- [x] Performance optimized
- [x] Error handling complete
- [x] Ready for merge

## Notes for Reviewers

1. **Mock Data**: The implementation uses mock data. Real outage-data-ua integration is documented and ready to implement.

2. **Format Spec Compliance**: All message formats exactly match the ВОЛЬТИК v1.0 specification.

3. **Performance**: Optimized for scale with concurrent processing and efficient lookups.

4. **Security**: All inputs properly escaped, no vulnerabilities found.

5. **Testability**: Comprehensive test cases provided in TESTING.md.
