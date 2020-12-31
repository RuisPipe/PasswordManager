class Cache {
  constructor(ttl) {
    this.ttl = ttl;

    this.cache = new Map();
  }

  set(key, value) {
    this.cache.set(key, value);
    this.startTtlTimeout(key);
  }

  has(key) {
    this.restartTTlTimeout(key);
    return this.cache.has(key);
  }

  get(key) {
    this.restartTTlTimeout(key);
    return this.cache.get(key);
  }

  delete(key) {
    this.cache.delete(key);
  }

  startTtlTimeout(key) {
    const timeoutId = setTimeout(() => {
      this.delete(key);
      this.delete(`timeout-${key}`);
    }, this.ttl * 1000);
    
    this.cache.set(`timeout-${key}`, timeoutId);
  }

  restartTTlTimeout(key) {
    if (this.cache.get(`timeout-${key}`)) {
      clearTimeout(this.cache.get(`timeout-${key}`));
      this.startTtlTimeout(key);
    }
  }
}

module.exports = Cache;