# 🧪 Testing Guide

This document describes how to test the Voltyk bot locally and verify all features work correctly.

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- A Telegram bot token (from @BotFather)
- ngrok or similar tool for webhook testing (optional)

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your bot token:

```env
BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_telegram_id
WEBHOOK_DOMAIN=  # Leave empty for initial testing
```

### 3. Test Without Webhook (Development Mode)

For local testing without webhook, you can modify the code temporarily to use polling, or test with ngrok:

#### Option A: Use ngrok (Recommended)

1. Install ngrok: https://ngrok.com/download
2. Start ngrok:
   ```bash
   ngrok http 3000
   ```
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Update `.env`:
   ```env
   WEBHOOK_DOMAIN=https://abc123.ngrok.io
   ```
5. Start the bot:
   ```bash
   npm start
   ```

#### Option B: Test Components Individually

Test storage, keyboards, and formatting without running the full bot:

```bash
# Test storage layer
node test_storage.js

# Test keyboards and formatting
node test_keyboards.js

# Test complete flow simulation
node test_bot_flow.js
```

## Feature Testing Checklist

### ✅ Wizard Flow (First Time User)

1. **Start Bot**
   - [ ] Send `/start`
   - [ ] Should show "👋 Вітаємо у Вольтику!"
   - [ ] Should show region selection buttons

2. **Select Region**
   - [ ] Click "Київщина"
   - [ ] Should show queue selection (1.1 to 3.3 in 3x3 grid)
   - [ ] Previous message should be edited (not new message)

3. **Select Queue**
   - [ ] Click "3.1"
   - [ ] Should show notification destination options
   - [ ] Message should be edited (not duplicated)

4. **Select Notification Destination**
   - [ ] Click "📱 У бота"
   - [ ] Should show IP monitoring options

5. **Complete Wizard**
   - [ ] Click "⏭ Пропустити"
   - [ ] Should show main menu
   - [ ] Should display selected region and queue
   - [ ] Should show "не підключено ❌" for channel
   - [ ] Should show "не підключена ❌" for IP address
   - [ ] Should show "увімкнено ✅" for notifications

### ✅ Main Menu

1. **Check Status Display**
   - [ ] Region and queue shown correctly (e.g., "Київщина • 3.1")
   - [ ] All status indicators displayed with emojis
   - [ ] Development notice shown at top

2. **Test Menu Buttons**
   - [ ] Click "📋 Подивитись графік" - should show schedule with photo
   - [ ] Click "📡 Моніторинг" - should show "coming soon" alert
   - [ ] Click "📺 Канал" - should show "coming soon" alert
   - [ ] Click "⚙️ Налаштування" - should open settings
   - [ ] Click "❓ Допомога" - should open help

3. **Return to Menu**
   - [ ] Send `/start` again
   - [ ] Should show main menu (not wizard)
   - [ ] Previous bot message should be deleted

### ✅ Settings

1. **Open Settings**
   - [ ] Click "⚙️ Налаштування"
   - [ ] Should show settings menu
   - [ ] Should have buttons: "📍 Змінити регіон", "🔢 Змінити чергу", "🔔 Сповіщення"
   - [ ] Should have "← Назад" and "⤴ Меню" buttons

2. **Change Region**
   - [ ] Click "📍 Змінити регіон"
   - [ ] Should show region selection
   - [ ] Select new region (e.g., "Одещина")
   - [ ] Should return to main menu
   - [ ] Region should be updated in status

3. **Change Queue**
   - [ ] Open settings again
   - [ ] Click "🔢 Змінити чергу"
   - [ ] Should show queue selection
   - [ ] Select new queue (e.g., "2.2")
   - [ ] Should return to main menu
   - [ ] Queue should be updated in status

4. **Toggle Notifications**
   - [ ] Open settings
   - [ ] Click "🔔 Сповіщення"
   - [ ] Should show alert "Сповіщення вимкнено"
   - [ ] Status should change to "вимкнено ❌"
   - [ ] Click again to re-enable
   - [ ] Status should change to "увімкнено ✅"

### ✅ Help

1. **Open Help**
   - [ ] Click "❓ Допомога"
   - [ ] Should show help text
   - [ ] Should have "💬 Обговорення / Підтримка" URL button
   - [ ] Should have "← Назад" and "⤴ Меню" buttons

2. **Test Support Link**
   - [ ] Click "💬 Обговорення / Підтримка"
   - [ ] Should open https://t.me/voltyk_chat in browser

### ✅ Navigation

1. **Back Button**
   - [ ] From any screen, click "← Назад"
   - [ ] Should return to previous screen or main menu

2. **Menu Button**
   - [ ] From any screen, click "⤴ Меню"
   - [ ] Should return to main menu

3. **Commands**
   - [ ] Send `/schedule` - should show schedule with photo
   - [ ] Send `/monitoring` - should show coming soon
   - [ ] Send `/settings` - should open settings
   - [ ] Send `/help` - should open help
   - [ ] Send `/feedback` - should open help (same as /help)

### ✅ Schedule Feature (PR 2)

1. **Manual Schedule Request**
   - [ ] Click "📋 Подивитись графік" button
   - [ ] Should send photo with schedule graph
   - [ ] Caption should show today's schedule with intervals
   - [ ] Caption should show tomorrow's schedule (if available)
   - [ ] If tomorrow not available: "Графік на завтра ще не опубліковано"
   - [ ] Should have "← Назад" and "⤴ Меню" buttons in one row
   - [ ] Previous bot message should be deleted (clean chat)

2. **Schedule Command Alias**
   - [ ] Send `/schedule` command
   - [ ] Should show same schedule as button click
   - [ ] Format should be identical

3. **Schedule Message Format**
   - [ ] Date format: DD.MM.YYYY (e.g., "08.02.2026")
   - [ ] Day of week in Ukrainian (Понеділок, Вівторок, etc.)
   - [ ] Time intervals in format: "00:00 - 03:00 (~3 год)"
   - [ ] Queue number displayed correctly (e.g., "3.1")
   - [ ] Total hours calculated and displayed
   - [ ] MarkdownV2 formatting applied (italic, bold)

4. **Schedule Error Handling**
   - [ ] If schedule unavailable, show: "⚠️ Графік тимчасово недоступний. Спробуйте пізніше."
   - [ ] Error message should have "← Назад" and "⤴ Меню" buttons
   - [ ] Bot should not crash on network errors

5. **Automatic Schedule Publications**
   - [ ] Schedule checker runs every minute (default interval)
   - [ ] First publication shows basic "Графік відключень на сьогодні"
   - [ ] Updated schedule shows "Оновлено графік відключень"
   - [ ] New tomorrow schedule shows "З'явився графік відключень на завтра"
   - [ ] No duplicate publications for same schedule (hash check)
   - [ ] Publications sent to configured destination (bot or channel)

6. **Publication Scenarios**
   - [ ] Scenario 1: First today schedule appears
   - [ ] Scenario 2: Today schedule updates
   - [ ] Scenario 3: Tomorrow schedule appears (today unchanged)
   - [ ] Scenario 4: Tomorrow appears + today updates
   - [ ] Scenario 5: Tomorrow schedule updates (today unchanged)

7. **Schedule Hash Caching**
   - [ ] Same schedule not published twice
   - [ ] Hash stored per user
   - [ ] Separate hashes for today and tomorrow
   - [ ] Hash changes detected correctly

### ✅ Fallback Handler

1. **Unknown Command**
   - [ ] Send `/unknown`
   - [ ] Should show fallback message
   - [ ] Should have "⤴ Меню" and "❓ Допомога" buttons

2. **Random Text**
   - [ ] Send "hello"
   - [ ] Should show fallback message
   - [ ] User message should NOT be deleted

3. **Old Button**
   - [ ] Click an old button from previous message (if any)
   - [ ] Should show fallback or appropriate message

### ✅ Clean Chat UX

1. **Message Replacement**
   - [ ] Send `/start` → note message ID
   - [ ] Send `/start` again
   - [ ] First bot message should be deleted
   - [ ] Only one bot message should remain

2. **User Messages Preserved**
   - [ ] Send any text message
   - [ ] User message should NOT be deleted
   - [ ] Only bot messages are managed

### ✅ Unicode Symbols

Verify correct symbols are used:
- [ ] "← Назад" (U+2190, not ◀️ or 🔙)
- [ ] "⤴ Меню" (U+2934, not 🏠 or ↩️)
- [ ] All emojis display correctly

### ✅ Language

1. **Ukrainian Language**
   - [ ] All text is in Ukrainian
   - [ ] Formal "Ви" is used throughout
   - [ ] No "ти" or mixed forms

2. **Region Names**
   - [ ] Київ (not Kyiv)
   - [ ] Київщина (not Київська область)
   - [ ] Одещина (not Одеса)
   - [ ] Дніпропетровщина (not Дніпро)

## Storage Testing

### Redis Available

1. **With Redis**
   - [ ] Start with `REDIS_URL` set
   - [ ] Should see "✅ Storage: Using Redis"
   - [ ] Complete wizard
   - [ ] Restart bot
   - [ ] User data should persist

### Redis Unavailable

1. **Without Redis**
   - [ ] Start without `REDIS_URL` or with invalid URL
   - [ ] Should see "⚠️ Storage: Using in-memory fallback"
   - [ ] Bot should still work normally
   - [ ] Data will be lost on restart (expected)

## Rate Limiting

1. **Rapid Actions**
   - [ ] Click buttons very quickly (>3 per second)
   - [ ] Should be silently rate limited
   - [ ] No error messages shown to user

## Security

1. **Duplicate Updates**
   - [ ] Bot should track processed update IDs
   - [ ] Duplicate webhooks should be ignored
   - [ ] Check logs for "⚠️ Duplicate update" messages

2. **No Token Leaks**
   - [ ] Check logs for bot token
   - [ ] Token should NOT appear in any logs

## Performance

1. **Response Time**
   - [ ] Commands should respond instantly (<1s)
   - [ ] Button clicks should update immediately

2. **Memory Usage**
   - [ ] Monitor memory usage
   - [ ] Should remain stable (no memory leaks)

## Final Verification

Before considering the bot complete:

**Block 1 (Wizard & Basic Features):**
- [ ] All wizard steps work correctly
- [ ] Main menu displays accurate status
- [ ] Settings can change region, queue, notifications
- [ ] Help opens with correct link
- [ ] Fallback handles unknown input gracefully
- [ ] Clean Chat UX works (no message spam)
- [ ] Only inline keyboards used (no reply keyboards)
- [ ] Correct Unicode symbols (← ⤴)
- [ ] All text in Ukrainian with formal "Ви"
- [ ] Bot starts with and without Redis
- [ ] No security vulnerabilities
- [ ] No token leaks in logs

**Block 2 (Schedule Feature):**
- [ ] Schedule button shows photo with formatted caption
- [ ] `/schedule` command works as alias
- [ ] Date and time formatting correct
- [ ] MarkdownV2 styling applied properly
- [ ] Error handling for unavailable schedules
- [ ] Automatic publications work (1 minute interval)
- [ ] All 5 publication scenarios handled correctly
- [ ] Hash-based deduplication works
- [ ] No duplicate schedule publications
- [ ] Bot and channel publishing supported
- [ ] Previous bot messages deleted on manual request

## Reporting Issues

If you find bugs during testing:

1. Note the exact steps to reproduce
2. Check bot logs for errors
3. Verify your `.env` configuration
4. Report in support chat: https://t.me/voltyk_chat

---

**Testing completed?** Move on to deployment: see `DEPLOYMENT.md`
