// File-based persistent storage fallback
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage file path
const STORAGE_DIR = path.resolve(__dirname, '../../data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'storage.json');
const WRITE_DEBOUNCE_MS = 300; // Debounce writes to reduce I/O

// In-memory Map for fast reads
const storage = new Map();

// Debounce variables
let writeTimeout = null;
let isDirty = false;

/**
 * Load data from disk on initialization
 */
function loadFromDisk() {
  try {
    // Use synchronous read for initial load at module startup
    // This ensures data is loaded before any operations occur
    const fileContent = fs.readFileSync(STORAGE_FILE, 'utf8');
    const data = JSON.parse(fileContent);

    // Load data into Map, filtering out expired items
    const now = Date.now();
    let loadedCount = 0;
    let expiredCount = 0;

    for (const [key, item] of Object.entries(data)) {
      // Check if item has expired
      if (item.expiresAt && now >= item.expiresAt) {
        expiredCount++;
        continue;
      }
      storage.set(key, item);
      loadedCount++;
    }

    console.log(`📁 Storage: Loaded ${loadedCount} items from disk${expiredCount > 0 ? ` (${expiredCount} expired items discarded)` : ''}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📁 Storage: No existing file found, starting fresh');
    } else if (error instanceof SyntaxError) {
      console.error('📁 Storage: Corrupted JSON file, starting fresh:', error.message);
    } else {
      console.error('📁 Storage: Error loading from disk:', error.message);
    }
    // Start fresh if there's an error
    storage.clear();
  }
}

/**
 * Save data to disk (debounced)
 * Uses atomic write to prevent corruption on crash
 */
function saveToDisk() {
  isDirty = true;

  // Clear existing timeout
  if (writeTimeout) {
    clearTimeout(writeTimeout);
  }

  // Schedule write
  writeTimeout = setTimeout(async () => {
    if (!isDirty) return;

    try {
      // Ensure directory exists (recursive option won't throw if it exists)
      await fs.promises.mkdir(STORAGE_DIR, { recursive: true });

      // Convert Map to plain object
      const data = Object.fromEntries(storage);

      // Atomic write: write to temp file, then rename
      const tempFile = STORAGE_FILE + '.tmp';
      await fs.promises.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
      await fs.promises.rename(tempFile, STORAGE_FILE);
      
      isDirty = false;
    } catch (error) {
      console.error('📁 Storage: Error writing to disk:', error.message);
      // Don't crash on write failure - data is still in memory
    }
  }, WRITE_DEBOUNCE_MS);
}

// Load data on module initialization
loadFromDisk();

export function getMemory(key) {
  const item = storage.get(key);
  if (!item) return null;
  
  // Check TTL
  if (item.expiresAt && Date.now() >= item.expiresAt) {
    storage.delete(key);
    // Note: No saveToDisk() here - expired items won't be restored on next load anyway
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
  saveToDisk(); // Persist to disk
  return true;
}

export function delMemory(key) {
  const result = storage.delete(key);
  if (result) {
    saveToDisk(); // Persist deletion
  }
  return result;
}

export function clearMemory() {
  storage.clear();
  saveToDisk(); // Persist clear operation
}
