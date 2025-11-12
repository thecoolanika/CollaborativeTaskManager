const redis = require('redis');

class RedisClient {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
      this.client = redis.createClient({ url: redisUrl });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.connected = true;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('Redis connection error:', error);
      this.connected = false;
      return null;
    }
  }

  async get(key) {
    if (!this.connected || !this.client) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key, value, expireSeconds = 3600) {
    if (!this.connected || !this.client) return false;
    try {
      await this.client.setEx(key, expireSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.connected || !this.client) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.connected || !this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  async keys(pattern) {
    if (!this.connected || !this.client) return [];
    try {
      const keys = [];
      for await (const key of this.client.scanIterator({
        MATCH: pattern,
        COUNT: 100
      })) {
        keys.push(key);
      }
      return keys;
    } catch (error) {
      console.error('Redis KEYS error:', error);
      return [];
    }
  }

  async delPattern(pattern) {
    if (!this.connected || !this.client) return 0;
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.client.del(keys);
    } catch (error) {
      console.error('Redis DEL PATTERN error:', error);
      return 0;
    }
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;

