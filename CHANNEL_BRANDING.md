# Channel Branding System - Implementation Documentation

## Overview

This document describes the complete channel branding system implementation for Voltyk Bot. The system ensures that all connected Telegram channels maintain standardized branding (name, description, photo) and automatically blocks channels where users manually change the branding.

## Architecture

### Core Components

1. **Channel Service** (`src/services/channel.js`)
   - Applies branding to channels (title, description, photo)
   - Verifies channel permissions and branding compliance
   - Handles channel migration for existing users

2. **Channel Handler** (`src/handlers/channel.js`)
   - Multi-step wizard for channel setup
   - Conversation state management with 30-minute timeout
   - Input validation and error handling

3. **Channel Guard Job** (`src/jobs/channelGuard.js`)
   - Daily automated branding verification
   - Runs at 03:00 Kyiv time (01:00 UTC)
   - 24-hour grace period before blocking
   - User notification system

4. **Storage Updates** (`src/storage/index.js`)
   - New channel-related fields in user data
   - Channel setup state management with TTL

## Database Schema

### New User Data Fields

```javascript
{
  // Existing fields...
  
  // Channel branding fields
  channel_id: null,                    // Telegram channel ID
  channel_title: null,                 // Full channel title with prefix
  channel_description: null,           // Full channel description
  channel_photo_file_id: null,         // Telegram file_id of set photo
  channel_user_title: null,            // User's part of title only
  channel_user_description: null,      // Optional user description
  channel_status: null,                // 'active' or 'blocked'
  channel_branding_updated_at: null,   // Timestamp of last branding change
  migration_notified: false,           // Whether user was notified about migration
}
```

## Branding Format

### Channel Title
**Format:** `Вольтик ⚡️ {user's part}`

- Prefix `Вольтик ⚡️ ` (with space after emoji) is added automatically
- User enters only their part
- Example: User enters `Київ Черга 3.1` → channel title becomes `Вольтик ⚡️ Київ Черга 3.1`

### Channel Description

**Mandatory footer (always present):**
```
⚡️ Вольтик — слідкує, щоб ти не слідкував
🤖 @VoltykBot
```

**Optional user part (if provided):**
```
{user's text}

⚡️ Вольтик — слідкує, щоб ти не слідкував
🤖 @VoltykBot
```

### Channel Photo
- Standard file `photo_for_channels.PNG.jpg` from repository root
- Set for all channels automatically
- File ID saved to storage after setting

## User Flow

### Channel Connection Wizard

1. **Start Setup**
   - User clicks "📺 Канал" from main menu or settings
   - Bot checks prerequisites (wizard completed, region/queue set)
   - Shows warning if channel was previously blocked

2. **Channel Input**
   - User sends channel @username or forwards a message from the channel
   - Bot validates:
     - Bot is admin with required permissions (`can_post_messages`, `can_change_info`)
     - Channel is not occupied by another user
     - Channel is accessible

3. **Enter Title**
   - User enters their part of the title
   - Bot validates length (1-200 characters)
   - Full title is formed: `Вольтик ⚡️ {user input}`

4. **Optional Description**
   - Bot offers two buttons: `✍️ Додати опис` or `⏭️ Пропустити`
   - If user adds description: validates length (1-200 characters)
   - Full description is formed with mandatory footer

5. **Apply Branding**
   - Bot applies title (critical)
   - Bot applies description (critical)
   - Bot applies photo (non-critical, shows warning if fails)
   - Bot retrieves photo file_id and saves to storage

6. **Welcome Message**
   - Bot posts welcome message to channel
   - Shows queue information
   - Mentions IP monitoring if configured

7. **Confirmation**
   - User receives success confirmation
   - Warning not to change branding manually
   - Automatic return to main menu

### Cancel Flow
- User can send `/cancel` at any step
- Clears conversation state
- Returns to main menu

## Channel Guard System

### Schedule
- Runs daily at **03:00 Kyiv time** (01:00 UTC)
- First run scheduled on bot startup
- Subsequent runs every 24 hours

### Check Algorithm

For each user:
1. Skip if `channel_status === 'blocked'`
2. Skip if notifications disabled
3. Skip if no channel connected
4. Get current channel data via Telegram API
5. Compare title, description, and photo file_id
6. If violations found:
   - Check grace period (24 hours from last update)
   - If grace period expired:
     - Set `channel_status` to `'blocked'`
     - Send notification to user
   - If within grace period: log and skip

### Grace Period
- **Duration:** 24 hours
- **Purpose:** Handle temporary Telegram API inconsistencies (file_id changes)
- **Start:** From `channel_branding_updated_at` timestamp

### Blocking Consequences

When `channel_status = 'blocked'`:
- Schedule publisher skips the channel
- Channel guard skips the channel
- User must reconnect through bot to restore
- User receives detailed notification with instructions

## Migration System

### On Bot Startup

1. Find all users with connected channels but no branding fields
2. For each channel:
   - Check if title already has `Вольтик ⚡️ ` prefix
   - If YES: Auto-migrate (update DB with current values)
   - If NO: Block channel and notify user

### Auto-Migration
- Updates all branding fields in database
- Extracts user title by removing prefix
- Sets status to `'active'`
- No user notification needed

### Manual Migration Required
- Sets status to `'blocked'`
- Sets `migration_notified` to `true`
- Sends detailed notification to user
- User must reconnect channel through bot

## API Functions

### Channel Service (`src/services/channel.js`)

#### `applyChannelBranding(bot, channelId, userTitle, userDescription)`
Applies complete branding to a channel.

**Returns:**
```javascript
{
  title: { success: boolean, error: string|null },
  description: { success: boolean, error: string|null },
  photo: { success: boolean, error: string|null, fileId: string|null }
}
```

#### `verifyChannelPermissions(bot, channelId)`
Checks if bot has required admin permissions.

**Returns:**
```javascript
{
  valid: boolean,
  error: string|null
}
```

#### `isChannelOccupied(channelId, currentUserId, allUserIds, getUserData)`
Checks if channel is already connected to another user.

**Returns:**
```javascript
{
  occupied: boolean,
  occupiedBy: number|null
}
```

#### `verifyChannelBranding(bot, channelId, expectedTitle, expectedDescription, expectedPhotoFileId)`
Verifies channel branding matches expected values.

**Returns:**
```javascript
{
  valid: boolean,
  violations: string[],
  currentData: {
    title: string,
    description: string,
    photoFileId: string
  },
  error: string|null
}
```

#### `sendChannelWelcomeMessage(bot, channelId, queue, hasIpMonitoring)`
Sends welcome message to newly connected channel.

#### `migrateExistingChannel(bot, userData)`
Checks if existing channel needs migration.

**Returns:**
```javascript
{
  needsMigration: boolean,
  alreadyCorrect: boolean,
  currentTitle: string,
  currentDescription: string,
  currentPhotoFileId: string,
  error: string|null
}
```

### Storage Functions (`src/storage/index.js`)

#### `getChannelSetupState(userId)`
Gets channel setup conversation state.

#### `setChannelSetupState(userId, state)`
Sets channel setup state with 30-minute TTL.

#### `delChannelSetupState(userId)`
Deletes channel setup state.

## Error Handling

### Critical Errors (Setup Stops)
- Bot lacks admin permissions
- Channel occupied by another user
- Title setting fails
- Description setting fails

### Non-Critical Errors (Setup Continues)
- Photo setting fails (shows warning)
- Welcome message fails (logged only)

### Guard Errors (Logged)
- Channel inaccessible (deleted/bot removed)
- API errors during verification
- Notification sending failures

## Security Considerations

1. **Permission Verification**
   - Bot verifies admin status before setup
   - Checks both `can_post_messages` and `can_change_info`

2. **Channel Ownership**
   - One channel can only be connected to one user
   - Prevents channel hijacking

3. **Grace Period**
   - Prevents false positives from Telegram API inconsistencies
   - Balances security with usability

4. **Input Validation**
   - Title and description length limits
   - Channel username format validation
   - Proper error messages

## Testing

### Manual Testing Checklist

- [ ] Start channel setup from main menu
- [ ] Start channel setup from settings
- [ ] Enter channel via @username
- [ ] Enter channel via forwarded message
- [ ] Test with bot not added to channel
- [ ] Test with bot without permissions
- [ ] Enter channel title
- [ ] Add optional description
- [ ] Skip optional description
- [ ] Cancel setup at each step
- [ ] Complete full setup
- [ ] Verify branding applied correctly
- [ ] Verify welcome message sent
- [ ] Check channel info from settings
- [ ] Disconnect channel
- [ ] Test reconnecting after disconnect
- [ ] Manually change channel title (should block after 24h)
- [ ] Manually change channel description (should block after 24h)
- [ ] Manually change channel photo (should block after 24h)
- [ ] Verify blocked channel notification
- [ ] Reconnect blocked channel
- [ ] Test migration with correct branding
- [ ] Test migration requiring manual setup

### Integration Points

1. **Schedule Publisher**
   - Checks `channel_status` before publishing
   - Skips blocked channels

2. **Main Menu**
   - Channel button opens setup wizard

3. **Settings Menu**
   - Channel settings option
   - Shows current channel info
   - Connect/disconnect options

## Performance Considerations

1. **Channel Guard**
   - Runs once daily to minimize API calls
   - Processes users sequentially to avoid rate limits
   - Uses Promise.allSettled for error isolation

2. **Storage**
   - Channel setup state has 30-minute TTL
   - Automatic cleanup of expired states
   - Minimal storage overhead

3. **API Calls**
   - Efficient branding application (3 calls per setup)
   - Single getChat call for verification
   - Batch processing in guard system

## Future Enhancements

Potential improvements not included in this implementation:

1. **Analytics Dashboard**
   - Track channel connection rates
   - Monitor blocking frequency
   - Identify common setup issues

2. **Bulk Operations**
   - Re-brand all channels at once
   - Batch verification runs

3. **Customization Options**
   - Allow specific emoji variants
   - Regional photo variations

4. **Advanced Notifications**
   - Warning before blocking (12h before grace period ends)
   - Regular reminders not to change branding

5. **Admin Tools**
   - Force unblock channels
   - Override branding requirements
   - View all connected channels

## Troubleshooting

### Common Issues

**Issue:** Channel setup fails with "Bot is not an administrator"
**Solution:** Ensure bot is added to channel as admin before starting setup

**Issue:** Photo setting fails
**Solution:** Check photo file exists and is readable (non-critical, setup continues)

**Issue:** Channel guard not running
**Solution:** Check bot startup logs for initialization message

**Issue:** Legitimate channel blocked
**Solution:** Grace period should prevent this; if it happens, user can reconnect

**Issue:** Migration notification not received
**Solution:** Check user has not blocked bot

### Logging

Key log messages to monitor:

- `✅ Channel guard initialized` - Guard started successfully
- `🔍 Channel guard: Starting daily check...` - Daily check began
- `🔴 Blocking channel {id} due to violations: {list}` - Channel blocked
- `✅ Auto-migrated channel for user {id}` - Successful migration
- `📧 Notified user {id} about migration needed` - Manual migration required

## Conclusion

The channel branding system provides a comprehensive solution for maintaining standardized branding across all connected Telegram channels while preserving user flexibility in naming and describing their channels. The 24-hour grace period balances security with tolerance for temporary API inconsistencies, and the automated guard system ensures continuous compliance without manual intervention.
