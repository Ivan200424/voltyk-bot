function createLogger(prefix) {
  return {
    info: (...args) => console.log(`[${prefix}]`, ...args),
    error: (...args) => console.error(`[${prefix}]`, ...args),
    warn: (...args) => console.warn(`[${prefix}]`, ...args),
    debug: (...args) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${prefix}]`, ...args);
      }
    },
  };
}

module.exports = { createLogger };
