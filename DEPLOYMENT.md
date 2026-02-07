# 🚀 Deployment Guide for Railway

This guide will help you deploy the Voltyk bot to Railway.

## Prerequisites

1. A Telegram bot token from [@BotFather](https://t.me/BotFather)
2. A [Railway](https://railway.app/) account
3. Your Telegram user ID (get it from [@userinfobot](https://t.me/userinfobot))

## Step 1: Create a New Project on Railway

1. Log in to [Railway](https://railway.app/)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select this repository

## Step 2: Configure Environment Variables

In Railway project settings, add the following environment variables:

### Required Variables:

- `BOT_TOKEN`: Your bot token from @BotFather
  ```
  Example: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
  ```

- `WEBHOOK_DOMAIN`: Your Railway app domain (provided after deployment)
  ```
  Example: https://your-app.up.railway.app
  ```

### Optional Variables:

- `REDIS_URL`: Redis connection URL (optional, bot will work with in-memory storage)
  ```
  Example: redis://default:password@redis.railway.internal:6379
  ```

- `ADMIN_CHAT_ID`: Your Telegram user ID for admin notifications
  ```
  Example: 123456789
  ```

- `PORT`: Server port (Railway sets this automatically, default: 3000)

## Step 3: Add Redis (Optional but Recommended)

For production use, it's recommended to add Redis for persistent storage:

1. In your Railway project, click "New"
2. Select "Database" → "Add Redis"
3. Copy the Redis URL from the Redis service
4. Add it as the `REDIS_URL` environment variable in your bot service

## Step 4: Set Webhook Domain

After deployment:

1. Railway will provide you with a domain like `https://your-app.up.railway.app`
2. Copy this domain
3. Update the `WEBHOOK_DOMAIN` environment variable with this domain
4. The bot will automatically set the webhook on startup

## Step 5: Configure BotFather Commands (Optional)

Set these commands in @BotFather for better UX:

```
start - Запустити Вольтика
schedule - Подивитись графік
monitoring - Моніторинг світла
settings - Налаштування
help - Допомога
feedback - Залишити відгук
```

To set commands:
1. Open @BotFather
2. Send `/setcommands`
3. Select your bot
4. Send the commands list above

## Step 6: Test Your Bot

1. Open your bot in Telegram
2. Send `/start`
3. Complete the wizard setup
4. Try different menu options

## Monitoring

Check your bot logs in Railway dashboard:
- Look for "✅ Bot @your_bot is ready"
- Check for "✅ Webhook set to: ..."
- Monitor for any errors

## Troubleshooting

### Bot doesn't respond

**Check:**
- `BOT_TOKEN` is correct
- `WEBHOOK_DOMAIN` is set and matches your Railway domain
- Bot is running (check Railway logs)

**Solution:** Restart the service in Railway

### Webhook errors

**Check:**
- Your Railway domain is HTTPS (it should be by default)
- No trailing slash in `WEBHOOK_DOMAIN`

**Solution:** Update `WEBHOOK_DOMAIN` and restart

### Storage issues

**If Redis connection fails:**
- The bot will automatically fall back to in-memory storage
- Check logs for "⚠️ Storage: Using in-memory fallback"
- This is OK for testing, but use Redis for production

### Port binding errors

**Railway automatically sets PORT:**
- Don't manually set PORT unless needed
- Railway will inject it automatically

## Scaling Considerations

For high traffic (>100k users):

1. **Enable Redis**: Essential for data persistence across restarts
2. **Monitor memory**: Railway will auto-scale if needed
3. **Check logs**: Monitor for rate limiting or errors
4. **Database backups**: Railway Redis includes automatic backups

## Security Best Practices

✅ **Never commit .env file** - It's in .gitignore by default
✅ **Use Railway secrets** - All env vars are encrypted
✅ **Rotate tokens** - If bot token is compromised, revoke in @BotFather
✅ **Monitor logs** - Check for suspicious activity

## Support

If you encounter issues:
- Check Railway logs first
- Review this deployment guide
- Ask in the support chat: https://t.me/voltyk_chat

## Cost

Railway free tier includes:
- $5 credit per month
- Enough for ~100k bot users/month
- Upgrade if you need more resources

---

**Need help?** Join our community: https://t.me/voltyk_chat
