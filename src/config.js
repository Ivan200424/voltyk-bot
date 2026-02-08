import 'dotenv/config';

export const config = {
  botToken: process.env.BOT_TOKEN,
  redisUrl: process.env.REDIS_URL,
  adminChatId: process.env.ADMIN_CHAT_ID,
  ownerId: process.env.OWNER_ID,
  adminIds: (process.env.ADMIN_IDS || '').split(',').filter(Boolean),
  webhookDomain: process.env.WEBHOOK_DOMAIN,
  port: process.env.PORT || 3000,
  botMode: process.env.BOT_MODE || 'webhook',
  
  // Bot settings
  supportChatUrl: 'https://t.me/voltyk_chat',
  
  // Regions (fixed names)
  regions: [
    'Київ',
    'Київщина',
    'Одещина',
    'Дніпропетровщина'
  ],
  
  // Region slugs mapping for outage-data-ua repository
  regionSlugs: {
    'Київ': 'kyiv',
    'Київщина': 'kyiv-region',
    'Одещина': 'odesa',
    'Дніпропетровщина': 'dnipro',
  },
  
  // Queues
  queues: ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'],
  
  // Rate limiting
  rateLimitWindow: 1000, // 1 second
  rateLimitMax: 3, // 3 actions per window
};
