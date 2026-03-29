/**
 * Cache Service
 * In-memory cache replacement for Google Apps Script CacheService
 */

interface CacheItem {
  value: any;
  expires: number;
}

export class CacheService {
  private cache: Map<string, CacheItem> = new Map();
  private defaultTTL: number = 1800; // 30 minutes

  constructor(ttl?: number) {
    if (ttl) this.defaultTTL = ttl;
  }

  put(key: string, value: any, ttl?: number): void {
    const expires = Date.now() + (ttl || this.defaultTTL) * 1000;
    this.cache.set(key, { value, expires });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  remove(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Stock cache methods
  putStockData(key: string, data: any[]): void {
    this.put(`stock:${key}`, data, 1800); // 30 min
  }

  getStockData(key: string): any[] | null {
    const data = this.get(`stock:${key}`);
    return data || null;
  }

  putInventData(data: any[]): void {
    this.put('inventdata:all', data, 1800);
  }

  getInventData(): any[] | null {
    const data = this.get('inventdata:all');
    return data || null;
  }

  // Get cache statistics
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const cacheService = new CacheService();
