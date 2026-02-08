const Redis = require('ioredis');

let client = null;
let redisAvailable = false;
let reconnectInterval = null;
let lastStatsCleanup = 0; // Track last cleanup timestamp

// In-memory fallback storage
const inMemoryStorage = {
  users: new Map(),        // user:chatId -> userData
  usersSet: new Set(),     // users:all
  regionSets: new Map(),   // users:region:X -> Set of chatIds
  queueSets: new Map(),    // users:region:X:queue:Y -> Set of chatIds
  states: new Map(),       // state:type:chatId -> stateData
  settings: new Map(),     // settings:key -> value
  channels: new Map(),     // channel:channelId -> channelData
  channelsSet: new Set(),  // channels:all
  userChannels: new Map(), // user:chatId:channels -> Set of channelIds
  cache: new Map(),        // cache:key -> { value, expiresAt }
  rateLimit: new Map(),    // capacity:key -> { count, expiresAt }
  stats: new Map(),        // stats:daily:date -> { field: count }
  totalStats: new Map(),   // stats:total -> { field: count }
  ipMonitoring: new Set(), // ip:monitoring:active
};

function getRedisClient() {
  if (!client) {
    client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    client.on('connect', () => console.log('✅ Redis підключено'));
    client.on('ready', () => {
      console.log('✅ Redis готовий до роботи');
      redisAvailable = true;
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    });
    client.on('error', (err) => {
      console.error('❌ Redis помилка:', err.message);
      redisAvailable = false;
      startReconnectLoop();
    });
    client.on('close', () => {
      console.warn('⚠️  Redis з\'єднання закрито');
      redisAvailable = false;
      startReconnectLoop();
    });
    client.on('reconnecting', () => console.log('🔄 Redis перепідключення...'));
  }
  return client;
}

function startReconnectLoop() {
  // Don't start if already running OR if Redis is already available
  if (reconnectInterval || redisAvailable) return;
  
  reconnectInterval = setInterval(() => {
    // Stop trying if Redis is available
    if (redisAvailable) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
      console.log('✅ Redis reconnection loop stopped (Redis available)');
      return;
    }
    
    if (client && client.status !== 'connecting' && client.status !== 'ready') {
      console.log('🔄 Спроба перепідключення до Redis...');
      client.connect().catch(err => {
        console.error('❌ Не вдалося перепідключитись до Redis:', err.message);
      });
    }
  }, 30000); // Try every 30 seconds
}

function isRedisAvailable() {
  return redisAvailable;
}

// === USER OPERATIONS ===

async function getUser(chatId) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const userData = inMemoryStorage.users.get(String(chatId));
    return userData || null;
  }
  
  try {
    const data = await client.hgetall(`user:${chatId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    // Convert string values back to appropriate types
    return {
      ...data,
      chatId: parseInt(data.chatId, 10),
      isActive: data.isActive === 'true',
      createdAt: data.createdAt ? parseInt(data.createdAt, 10) : Date.now(),
      updatedAt: data.updatedAt ? parseInt(data.updatedAt, 10) : Date.now(),
    };
  } catch (error) {
    console.error(`Error getting user ${chatId}:`, error);
    return null;
  }
}

async function saveUser(chatId, userData) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const dataToStore = {
      ...userData,
      chatId: parseInt(chatId, 10),
      isActive: userData.isActive !== false,
      updatedAt: Date.now(),
      createdAt: userData.createdAt || Date.now(),
    };
    
    inMemoryStorage.users.set(String(chatId), dataToStore);
    inMemoryStorage.usersSet.add(String(chatId));
    
    if (userData.region) {
      const regionKey = `users:region:${userData.region}`;
      if (!inMemoryStorage.regionSets.has(regionKey)) {
        inMemoryStorage.regionSets.set(regionKey, new Set());
      }
      inMemoryStorage.regionSets.get(regionKey).add(String(chatId));
      
      if (userData.queue) {
        const queueKey = `users:region:${userData.region}:queue:${userData.queue}`;
        if (!inMemoryStorage.queueSets.has(queueKey)) {
          inMemoryStorage.queueSets.set(queueKey, new Set());
        }
        inMemoryStorage.queueSets.get(queueKey).add(String(chatId));
      }
    }
    
    return true;
  }
  
  try {
    const pipeline = client.pipeline();
    
    // Prepare data for storage
    const dataToStore = {
      ...userData,
      chatId: String(chatId),
      isActive: String(userData.isActive !== false),
      updatedAt: String(Date.now()),
      createdAt: userData.createdAt ? String(userData.createdAt) : String(Date.now()),
    };
    
    // Store user hash
    pipeline.hset(`user:${chatId}`, dataToStore);
    
    // Add to global users set
    pipeline.sadd('users:all', String(chatId));
    
    // Add to region-specific sets if region is specified
    if (userData.region) {
      pipeline.sadd(`users:region:${userData.region}`, String(chatId));
      
      if (userData.queue) {
        pipeline.sadd(`users:region:${userData.region}:queue:${userData.queue}`, String(chatId));
      }
    }
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error saving user ${chatId}:`, error);
    return false;
  }
}

async function updateUser(chatId, fields) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const user = inMemoryStorage.users.get(String(chatId));
    if (user) {
      const updatedUser = {
        ...user,
        ...fields,
        updatedAt: Date.now(),
      };
      inMemoryStorage.users.set(String(chatId), updatedUser);
      
      // Update region sets if region or queue changed
      if (fields.region) {
        const regionKey = `users:region:${fields.region}`;
        if (!inMemoryStorage.regionSets.has(regionKey)) {
          inMemoryStorage.regionSets.set(regionKey, new Set());
        }
        inMemoryStorage.regionSets.get(regionKey).add(String(chatId));
      }
      
      if (fields.queue && updatedUser.region) {
        const queueKey = `users:region:${updatedUser.region}:queue:${fields.queue}`;
        if (!inMemoryStorage.queueSets.has(queueKey)) {
          inMemoryStorage.queueSets.set(queueKey, new Set());
        }
        inMemoryStorage.queueSets.get(queueKey).add(String(chatId));
      }
      
      return true;
    }
    return false;
  }
  
  try {
    const fieldsToStore = {
      ...fields,
      updatedAt: String(Date.now()),
    };
    
    // Convert boolean to string if present
    if ('isActive' in fieldsToStore) {
      fieldsToStore.isActive = String(fieldsToStore.isActive);
    }
    
    await client.hset(`user:${chatId}`, fieldsToStore);
    
    // Update region sets if region or queue changed
    if (fields.region || fields.queue) {
      const user = await getUser(chatId);
      if (user) {
        const pipeline = client.pipeline();
        
        if (fields.region) {
          pipeline.sadd(`users:region:${fields.region}`, String(chatId));
        }
        
        if (fields.queue && user.region) {
          pipeline.sadd(`users:region:${user.region}:queue:${fields.queue}`, String(chatId));
        }
        
        await pipeline.exec();
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating user ${chatId}:`, error);
    return false;
  }
}

async function deleteUser(chatId) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const user = inMemoryStorage.users.get(String(chatId));
    
    inMemoryStorage.users.delete(String(chatId));
    inMemoryStorage.usersSet.delete(String(chatId));
    
    if (user && user.region) {
      const regionKey = `users:region:${user.region}`;
      if (inMemoryStorage.regionSets.has(regionKey)) {
        inMemoryStorage.regionSets.get(regionKey).delete(String(chatId));
      }
      
      if (user.queue) {
        const queueKey = `users:region:${user.region}:queue:${user.queue}`;
        if (inMemoryStorage.queueSets.has(queueKey)) {
          inMemoryStorage.queueSets.get(queueKey).delete(String(chatId));
        }
      }
    }
    
    inMemoryStorage.ipMonitoring.delete(String(chatId));
    
    return true;
  }
  
  try {
    const user = await getUser(chatId);
    const pipeline = client.pipeline();
    
    // Delete user data
    pipeline.del(`user:${chatId}`);
    pipeline.del(`user:${chatId}:settings`);
    pipeline.del(`user:${chatId}:ip`);
    pipeline.del(`user:${chatId}:channels`);
    
    // Remove from sets
    pipeline.srem('users:all', String(chatId));
    
    if (user && user.region) {
      pipeline.srem(`users:region:${user.region}`, String(chatId));
      
      if (user.queue) {
        pipeline.srem(`users:region:${user.region}:queue:${user.queue}`, String(chatId));
      }
    }
    
    // Remove from IP monitoring
    pipeline.srem('ip:monitoring:active', String(chatId));
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error deleting user ${chatId}:`, error);
    return false;
  }
}

async function getUserCount() {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    return inMemoryStorage.usersSet.size;
  }
  
  try {
    return await client.scard('users:all');
  } catch (error) {
    console.error('Error getting user count:', error);
    return 0;
  }
}

async function getAllUserIds() {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    return Array.from(inMemoryStorage.usersSet).map(id => parseInt(id, 10));
  }
  
  try {
    const members = await client.smembers('users:all');
    return members.map(id => parseInt(id, 10));
  } catch (error) {
    console.error('Error getting all user IDs:', error);
    return [];
  }
}

async function getUsersByRegion(region) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const regionKey = `users:region:${region}`;
    const regionSet = inMemoryStorage.regionSets.get(regionKey);
    return regionSet ? Array.from(regionSet).map(id => parseInt(id, 10)) : [];
  }
  
  try {
    const members = await client.smembers(`users:region:${region}`);
    return members.map(id => parseInt(id, 10));
  } catch (error) {
    console.error(`Error getting users by region ${region}:`, error);
    return [];
  }
}

async function getUsersByRegionAndQueue(region, queue) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const queueKey = `users:region:${region}:queue:${queue}`;
    const queueSet = inMemoryStorage.queueSets.get(queueKey);
    return queueSet ? Array.from(queueSet).map(id => parseInt(id, 10)) : [];
  }
  
  try {
    const members = await client.smembers(`users:region:${region}:queue:${queue}`);
    return members.map(id => parseInt(id, 10));
  } catch (error) {
    console.error(`Error getting users by region ${region} and queue ${queue}:`, error);
    return [];
  }
}

async function getUserByChannelId(channelId) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const channelData = inMemoryStorage.channels.get(String(channelId));
    if (!channelData || !channelData.chatId) {
      return null;
    }
    return inMemoryStorage.users.get(String(channelData.chatId)) || null;
  }
  
  try {
    const channelData = await client.hgetall(`channel:${channelId}`);
    if (!channelData || !channelData.chatId) {
      return null;
    }
    return await getUser(parseInt(channelData.chatId, 10));
  } catch (error) {
    console.error(`Error getting user by channel ${channelId}:`, error);
    return null;
  }
}

// === STATE OPERATIONS (with TTL!) ===

async function saveState(type, chatId, data, ttlSeconds = 86400) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const key = `state:${type}:${chatId}`;
    inMemoryStorage.states.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000),
    });
    return true;
  }
  
  try {
    const key = `state:${type}:${chatId}`;
    const pipeline = client.pipeline();
    
    // Convert data to string format for hash
    const dataToStore = {};
    for (const [k, v] of Object.entries(data)) {
      dataToStore[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    
    pipeline.hset(key, dataToStore);
    pipeline.expire(key, ttlSeconds);
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error saving state ${type} for ${chatId}:`, error);
    return false;
  }
}

async function getState(type, chatId) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const key = `state:${type}:${chatId}`;
    const entry = inMemoryStorage.states.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      inMemoryStorage.states.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  try {
    const key = `state:${type}:${chatId}`;
    const data = await client.hgetall(key);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    // Parse JSON strings back to objects
    const parsedData = {};
    for (const [k, v] of Object.entries(data)) {
      try {
        parsedData[k] = JSON.parse(v);
      } catch {
        parsedData[k] = v;
      }
    }
    
    return parsedData;
  } catch (error) {
    console.error(`Error getting state ${type} for ${chatId}:`, error);
    return null;
  }
}

async function deleteState(type, chatId) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const key = `state:${type}:${chatId}`;
    inMemoryStorage.states.delete(key);
    return true;
  }
  
  try {
    const key = `state:${type}:${chatId}`;
    await client.del(key);
    return true;
  } catch (error) {
    console.error(`Error deleting state ${type} for ${chatId}:`, error);
    return false;
  }
}

async function hasState(type, chatId) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const key = `state:${type}:${chatId}`;
    const entry = inMemoryStorage.states.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      inMemoryStorage.states.delete(key);
      return false;
    }
    
    return true;
  }
  
  try {
    const key = `state:${type}:${chatId}`;
    const exists = await client.exists(key);
    return exists === 1;
  } catch (error) {
    console.error(`Error checking state ${type} for ${chatId}:`, error);
    return false;
  }
}

// === SETTINGS ===

async function getSetting(key, defaultValue = null) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const value = inMemoryStorage.settings.get(key);
    return value !== undefined ? value : defaultValue;
  }
  
  try {
    const value = await client.get(`settings:${key}`);
    return value !== null ? value : defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
}

async function setSetting(key, value) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    inMemoryStorage.settings.set(key, String(value));
    return true;
  }
  
  try {
    await client.set(`settings:${key}`, String(value));
    return true;
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    return false;
  }
}

// === CHANNEL OPERATIONS ===

async function saveChannel(channelId, data) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const dataToStore = {
      ...data,
      channelId: parseInt(channelId, 10),
      chatId: parseInt(data.chatId, 10),
      status: data.status || 'active',
      updatedAt: Date.now(),
      createdAt: data.createdAt || Date.now(),
    };
    
    inMemoryStorage.channels.set(String(channelId), dataToStore);
    inMemoryStorage.channelsSet.add(String(channelId));
    
    if (data.chatId) {
      const userChannelsKey = String(data.chatId);
      if (!inMemoryStorage.userChannels.has(userChannelsKey)) {
        inMemoryStorage.userChannels.set(userChannelsKey, new Set());
      }
      inMemoryStorage.userChannels.get(userChannelsKey).add(String(channelId));
    }
    
    return true;
  }
  
  try {
    const pipeline = client.pipeline();
    
    const dataToStore = {
      ...data,
      channelId: String(channelId),
      chatId: String(data.chatId),
      status: data.status || 'active',
      updatedAt: String(Date.now()),
      createdAt: data.createdAt ? String(data.createdAt) : String(Date.now()),
    };
    
    pipeline.hset(`channel:${channelId}`, dataToStore);
    pipeline.sadd('channels:all', String(channelId));
    
    if (data.chatId) {
      pipeline.sadd(`user:${data.chatId}:channels`, String(channelId));
    }
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error saving channel ${channelId}:`, error);
    return false;
  }
}

async function getChannel(channelId) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const channelData = inMemoryStorage.channels.get(String(channelId));
    return channelData || null;
  }
  
  try {
    const data = await client.hgetall(`channel:${channelId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    return {
      ...data,
      channelId: parseInt(data.channelId, 10),
      chatId: parseInt(data.chatId, 10),
      createdAt: data.createdAt ? parseInt(data.createdAt, 10) : Date.now(),
      updatedAt: data.updatedAt ? parseInt(data.updatedAt, 10) : Date.now(),
    };
  } catch (error) {
    console.error(`Error getting channel ${channelId}:`, error);
    return null;
  }
}

async function deleteChannel(channelId) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const channel = inMemoryStorage.channels.get(String(channelId));
    
    inMemoryStorage.channels.delete(String(channelId));
    inMemoryStorage.channelsSet.delete(String(channelId));
    
    if (channel && channel.chatId) {
      const userChannelsKey = String(channel.chatId);
      if (inMemoryStorage.userChannels.has(userChannelsKey)) {
        inMemoryStorage.userChannels.get(userChannelsKey).delete(String(channelId));
      }
    }
    
    return true;
  }
  
  try {
    const channel = await getChannel(channelId);
    const pipeline = client.pipeline();
    
    pipeline.del(`channel:${channelId}`);
    pipeline.srem('channels:all', String(channelId));
    
    if (channel && channel.chatId) {
      pipeline.srem(`user:${channel.chatId}:channels`, String(channelId));
    }
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error deleting channel ${channelId}:`, error);
    return false;
  }
}

async function getAllChannelIds() {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    return Array.from(inMemoryStorage.channelsSet).map(id => parseInt(id, 10));
  }
  
  try {
    const members = await client.smembers('channels:all');
    return members.map(id => parseInt(id, 10));
  } catch (error) {
    console.error('Error getting all channel IDs:', error);
    return [];
  }
}

// === CACHE ===

async function setCache(key, value, ttlSeconds = 300) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    inMemoryStorage.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000),
    });
    return true;
  }
  
  try {
    const fullKey = `cache:${key}`;
    await client.setex(fullKey, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error setting cache ${key}:`, error);
    return false;
  }
}

async function getCache(key) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const entry = inMemoryStorage.cache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      inMemoryStorage.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  try {
    const fullKey = `cache:${key}`;
    const value = await client.get(fullKey);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Error getting cache ${key}:`, error);
    return null;
  }
}

// === RATE LIMITING ===

async function incrementRateLimit(key, ttlSeconds = 60) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const entry = inMemoryStorage.rateLimit.get(key);
    const now = Date.now();
    
    if (!entry || now > entry.expiresAt) {
      inMemoryStorage.rateLimit.set(key, {
        count: 1,
        expiresAt: now + (ttlSeconds * 1000),
      });
      return 1;
    }
    
    entry.count++;
    return entry.count;
  }
  
  try {
    const fullKey = `capacity:${key}`;
    const pipeline = client.pipeline();
    
    pipeline.incr(fullKey);
    pipeline.expire(fullKey, ttlSeconds);
    
    const results = await pipeline.exec();
    return results[0][1]; // Return the incremented value
  } catch (error) {
    console.error(`Error incrementing rate limit ${key}:`, error);
    return 0;
  }
}

async function getRateLimit(key) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const entry = inMemoryStorage.rateLimit.get(key);
    if (!entry) return 0;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      inMemoryStorage.rateLimit.delete(key);
      return 0;
    }
    
    return entry.count;
  }
  
  try {
    const fullKey = `capacity:${key}`;
    const value = await client.get(fullKey);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error(`Error getting rate limit ${key}:`, error);
    return 0;
  }
}

// === STATISTICS ===

async function incrementStat(field, count = 1) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const today = new Date().toISOString().split('T')[0];
    
    // Update daily stats
    const dailyStats = inMemoryStorage.stats.get(today) || {};
    dailyStats[field] = (dailyStats[field] || 0) + count;
    inMemoryStorage.stats.set(today, dailyStats);
    
    // Also update total stats for consistency
    const currentTotal = inMemoryStorage.totalStats.get(field) || 0;
    inMemoryStorage.totalStats.set(field, currentTotal + count);
    
    // Clean up old daily stats (keep only last 7 days to prevent memory leak)
    // Only run cleanup once per day to avoid unnecessary processing
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (inMemoryStorage.stats.size > 7 && (now - lastStatsCleanup) > oneDayMs) {
      const dates = Array.from(inMemoryStorage.stats.keys()).sort();
      const oldestToKeep = dates[dates.length - 7];
      for (const date of dates) {
        if (date < oldestToKeep) {
          inMemoryStorage.stats.delete(date);
        }
      }
      lastStatsCleanup = now;
    }
    
    return true;
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    await client.hincrby(`stats:daily:${today}`, field, count);
    return true;
  } catch (error) {
    console.error(`Error incrementing stat ${field}:`, error);
    return false;
  }
}

async function getStats() {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const stats = {};
    for (const [field, value] of inMemoryStorage.totalStats.entries()) {
      stats[field] = value;
    }
    return stats;
  }
  
  try {
    const data = await client.hgetall('stats:total');
    if (!data || Object.keys(data).length === 0) {
      return {};
    }
    
    // Convert string values to numbers
    const stats = {};
    for (const [key, value] of Object.entries(data)) {
      stats[key] = parseInt(value, 10) || 0;
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting stats:', error);
    return {};
  }
}

async function getDailyStats(date) {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const dailyStats = inMemoryStorage.stats.get(date);
    return dailyStats || {};
  }
  
  try {
    const data = await client.hgetall(`stats:daily:${date}`);
    if (!data || Object.keys(data).length === 0) {
      return {};
    }
    
    // Convert string values to numbers
    const stats = {};
    for (const [key, value] of Object.entries(data)) {
      stats[key] = parseInt(value, 10) || 0;
    }
    
    return stats;
  } catch (error) {
    console.error(`Error getting daily stats for ${date}:`, error);
    return {};
  }
}

// === GET ALL ACTIVE USERS ===

async function getAllActiveUsers() {
  // Use in-memory fallback if Redis is unavailable
  if (!redisAvailable) {
    const users = [];
    for (const [chatId, userData] of inMemoryStorage.users.entries()) {
      if (userData.isActive !== false) {
        users.push(userData);
      }
    }
    return users;
  }
  
  try {
    // Get all user IDs from the set
    const userIds = await getAllUserIds();
    
    // Fetch each user and filter active ones
    const users = [];
    for (const chatId of userIds) {
      const user = await getUser(chatId);
      if (user && user.isActive !== false) {
        users.push(user);
      }
    }
    
    return users;
  } catch (error) {
    console.error('Error getting all active users:', error);
    return [];
  }
}

// === GRACEFUL SHUTDOWN ===

async function closeRedis() {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
  
  if (client) {
    try {
      await client.quit();
      console.log('✅ Redis з\'єднання закрито');
    } catch (error) {
      console.error('Error closing Redis:', error);
    }
    client = null;
    redisAvailable = false;
  }
}

module.exports = {
  getRedisClient,
  isRedisAvailable,
  getUser,
  saveUser,
  updateUser,
  deleteUser,
  getUserCount,
  getAllUserIds,
  getAllActiveUsers,
  getUsersByRegion,
  getUsersByRegionAndQueue,
  getUserByChannelId,
  saveState,
  getState,
  deleteState,
  hasState,
  getSetting,
  setSetting,
  saveChannel,
  getChannel,
  deleteChannel,
  getAllChannelIds,
  setCache,
  getCache,
  incrementRateLimit,
  getRateLimit,
  incrementStat,
  getStats,
  getDailyStats,
  closeRedis,
};
