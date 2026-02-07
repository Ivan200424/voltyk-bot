// In-memory storage fallback
const storage = new Map();

export function getMemory(key) {
  const item = storage.get(key);
  if (!item) return null;
  
  // Check TTL
  if (item.expiresAt && Date.now() >= item.expiresAt) {
    storage.delete(key);
    return null;
  }
  
  return item.value;
}

export function setMemory(key, value, ttl = null) {
  const item = {
    value,
    expiresAt: ttl ? Date.now() + (ttl * 1000) : null,
  };
  storage.set(key, item);
  return true;
}

export function delMemory(key) {
  return storage.delete(key);
}

export function clearMemory() {
  storage.clear();
}
