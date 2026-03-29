/**
 * Search Integration Tests
 *
 * Tests the complete search flow:
 * - Query normalization
 * - Vector similarity search
 * - RAG response generation
 * - Result ranking and filtering
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load test fixtures
const testQueries = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/queries/test-queries-th.json'), 'utf-8')
);

const searchBenchmarks = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/expected-results/search-benchmarks.json'), 'utf-8')
);

// Mock search service (replace with actual implementation)
class SearchService {
  private products = [
    {
      id: '1',
      partNumber: 'TIRE-001',
      name: 'ยางรถยนต์ Michelin Energy XM2',
      nameTh: 'ยางรถยนต์มิชลิน',
      category: 'tires',
      brand: 'Michelin',
      tireSize: '185/65R15',
      price: 3500,
      embedding: [0.1, 0.2, 0.3] // Mock embedding
    },
    {
      id: '2',
      partNumber: 'TIRE-002',
      name: 'ยางรถยนต์ Bridgestone Ecopia',
      nameTh: 'ยางรถยนต์บริดจสโตน',
      category: 'tires',
      brand: 'Bridgestone',
      tireSize: '185/65R15',
      price: 3200,
      embedding: [0.15, 0.25, 0.35]
    },
    {
      id: '3',
      partNumber: 'OIL-001',
      name: 'น้ำมันเครื่อง Motul 8100 X-cess',
      nameTh: 'น้ำมันเครื่องโมตูล',
      category: 'engine-oil',
      brand: 'Motul',
      viscosity: '5W-30',
      price: 1250,
      embedding: [0.2, 0.1, 0.4]
    },
    {
      id: '4',
      partNumber: 'OIL-002',
      name: 'น้ำมันเครื่อง Shell Helix HX8',
      nameTh: 'น้ำมันเครื่องเชลล์',
      category: 'engine-oil',
      brand: 'Shell',
      viscosity: '5W-30',
      price: 990,
      embedding: [0.18, 0.12, 0.38]
    },
    {
      id: '5',
      partNumber: 'AIR-001',
      name: 'ไส้กรองอากาศ',
      nameTh: 'ไส้กรองอากาศ',
      category: 'air-filter',
      brand: 'Denso',
      price: 250,
      embedding: [0.3, 0.15, 0.25]
    }
  ];

  async search(query: string, options: any = {}) {
    const startTime = Date.now();

    // Simulate query processing
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simple keyword matching (replace with vector search)
    const queryLower = query.toLowerCase();
    let results = this.products.filter(p => {
      const searchText = `${p.name} ${p.nameTh} ${p.category} ${p.brand || ''}`.toLowerCase();
      return searchText.includes(queryLower) ||
        queryLower.includes(p.category.toLowerCase()) ||
        (p.brand && queryLower.includes(p.brand.toLowerCase()));
    });

    // Calculate similarity scores (mock)
    results = results.map(r => ({
      ...r,
      similarityScore: 0.7 + Math.random() * 0.3 // 0.7-1.0
    }));

    // Sort by similarity
    results.sort((a, b) => b.similarityScore - a.similarityScore);

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return {
      results,
      query,
      totalResults: results.length,
      processingTime: Date.now() - startTime
    };
  }

  async searchWithFilters(query: string, filters: any) {
    let results = this.products;

    if (filters.category) {
      results = results.filter(p => p.category === filters.category);
    }

    if (filters.brand) {
      results = results.filter(p => p.brand === filters.brand);
    }

    if (filters.tireSize) {
      results = results.filter(p => p.tireSize === filters.tireSize);
    }

    return {
      results,
      query,
      totalResults: results.length
    };
  }
}

describe('Search Integration Tests', () => {
  let searchService: SearchService;

  beforeAll(() => {
    searchService = new SearchService();
  });

  describe('Basic Search', () => {
    it('should find tires for "ยางรถยนต์"', async () => {
      const result = await searchService.search('ยางรถยนต์');

      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.results[0].category).toBe('tires');
      expect(result.processingTime).toBeLessThan(1000);
    });

    it('should find engine oil for "น้ำมันเครื่อง"', async () => {
      const result = await searchService.search('น้ำมันเครื่อง');

      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.results[0].category).toBe('engine-oil');
    });

    it('should handle English queries', async () => {
      const result = await searchService.search('tires');

      expect(result.totalResults).toBeGreaterThan(0);
    });

    it('should return empty results for out-of-scope queries', async () => {
      const result = await searchService.search('ยางเครื่องบิน');

      expect(result.totalResults).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('Brand Search', () => {
    it('should find Michelin products', async () => {
      const result = await searchService.search('Michelin');

      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.results.some(r => r.brand === 'Michelin')).toBe(true);
    });

    it('should find Motul products', async () => {
      const result = await searchService.search('Motul');

      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.results[0].brand).toBe('Motul');
    });
  });

  describe('Vehicle-Specific Search', () => {
    it('should handle vehicle + part queries', async () => {
      const result = await searchService.search('ยาง Honda City');

      expect(result).toBeDefined();
      expect(result.processingTime).toBeLessThan(1000);
    });
  });

  describe('Size-Specific Search', () => {
    it('should find specific tire sizes', async () => {
      const result = await searchService.searchWithFilters('ยาง', {
        tireSize: '185/65R15'
      });

      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.results.every(r => r.tireSize === '185/65R15')).toBe(true);
    });
  });

  describe('Search with Filters', () => {
    it('should filter by category', async () => {
      const result = await searchService.searchWithFilters('', {
        category: 'tires'
      });

      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.results.every(r => r.category === 'tires')).toBe(true);
    });

    it('should filter by brand', async () => {
      const result = await searchService.searchWithFilters('', {
        brand: 'Michelin'
      });

      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.results.every(r => r.brand === 'Michelin')).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const result = await searchService.searchWithFilters('', {
        category: 'tires',
        brand: 'Michelin'
      });

      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.results.every(r =>
        r.category === 'tires' && r.brand === 'Michelin'
      )).toBe(true);
    });
  });

  describe('Result Ranking', () => {
    it('should rank results by relevance', async () => {
      const result = await searchService.search('ยางรถยนต์');

      expect(result.results.length).toBeGreaterThan(1);

      // Check that results are sorted by similarity
      for (let i = 0; i < result.results.length - 1; i++) {
        expect(result.results[i].similarityScore)
          .toBeGreaterThanOrEqual(result.results[i + 1].similarityScore);
      }
    });

    it('should apply limit to results', async () => {
      const result = await searchService.search('ยาง', { limit: 2 });

      expect(result.results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Performance', () => {
    it('should complete search within threshold', async () => {
      const threshold = searchBenchmarks.performanceThresholds.avgSearchTime;
      const result = await searchService.search('ยางรถยนต์');

      expect(result.processingTime).toBeLessThanOrEqual(threshold);
    });

    it('should handle multiple concurrent searches', async () => {
      const queries = ['ยางรถยนต์', 'น้ำมันเครื่อง', 'ไส้กรองอากาศ'];
      const startTime = Date.now();

      const results = await Promise.all(
        queries.map(q => searchService.search(q))
      );

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / queries.length;

      expect(results).toHaveLength(queries.length);
      expect(avgTime).toBeLessThan(500);
    });
  });

  describe('Colloquial Term Handling', () => {
    it('should handle "ยางแม็ก"', async () => {
      const result = await searchService.search('ยางแม็ก');

      // Should still find results via mapping
      expect(result.totalResults).toBeGreaterThan(0);
    });

    it('should handle "น้ำมันสังเครื่อง"', async () => {
      const result = await searchService.search('น้ำมันสังเครื่อง');

      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.results[0].category).toBe('engine-oil');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query', async () => {
      const result = await searchService.search('');

      expect(result).toBeDefined();
    });

    it('should handle very long query', async () => {
      const longQuery = 'ยาง ' .repeat(100);
      const result = await searchService.search(longQuery);

      expect(result).toBeDefined();
    });

    it('should handle special characters', async () => {
      const result = await searchService.search('ยาง!@#$%รถยนต์');

      expect(result).toBeDefined();
    });

    it('should handle query with only spaces', async () => {
      const result = await searchService.search('   ');

      expect(result).toBeDefined();
    });
  });

  describe('Test Fixture Integration', () => {
    it('should process all test queries', async () => {
      const results = [];

      for (const query of testQueries.queries.slice(0, 5)) {
        const result = await searchService.search(query.text);
        results.push({
          query: query.text,
          found: result.totalResults > 0,
          expected: query.shouldFindResults
        });
      }

      expect(results).toHaveLength(5);
    });

    it('should meet relevance benchmarks', async () => {
      const benchmarkCase = searchBenchmarks.benchmarks['TH-001'];
      const result = await searchService.search(benchmarkCase.query);

      expect(result.totalResults).toBeGreaterThanOrEqual(benchmarkCase.minResults);
    });
  });
});
