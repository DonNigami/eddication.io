/**
 * Thai Normalizer Unit Tests
 *
 * Tests the thai-normalizer utility which handles:
 * - Thai text normalization (tone marks, spelling variants)
 * - Colloquial term mapping
 * - Vehicle model extraction
 * - Part number format validation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load test fixtures
const testQueries = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/queries/test-queries-th.json'), 'utf-8')
);

// Mock the thai-normalizer module (replace with actual import after implementation)
const ThaiNormalizer = {
  // Normalize Thai text for consistent search
  normalize: (text: string): string => {
    // Mock implementation - replace with actual
    return text
      .toLowerCase()
      .trim()
      .replace(/[็์ๆฺํ]/g, '') // Remove tone marks
      .replace(/ั\u0E48/g, 'ั'); // Simplify tone marks
  },

  // Map colloquial terms to standard categories
  mapColloquial: (text: string): string => {
    const mappings: Record<string, string> = {
      'ยางแม็ก': 'ยางรถยนต์ michelin',
      'น้ำมันสังเครื่อง': 'น้ำมันเครื่อง',
      'น้ำมันหล่อลื่น': 'น้ำมันเครื่อง',
      'ใบหน้า': 'ไส้กรองอากาศ',
      'หัวเทียน': 'หัวเทียนรถยนต์',
    };

    for (const [colloquial, standard] of Object.entries(mappings)) {
      if (text.includes(colloquial)) {
        return text.replace(colloquial, standard);
      }
    }
    return text;
  },

  // Extract vehicle model from text
  extractVehicle: (text: string): { brand?: string; model?: string } | null => {
    const brands = ['Honda', 'Toyota', 'Mitsubishi', 'Nissan', 'Mazda', 'Isuzu', 'Ford', 'Chevrolet'];
    const models = ['City', 'Vios', 'Altis', 'Yaris', 'Civic', 'Accord', 'Hilux', 'D-Max'];

    const foundBrand = brands.find(b => text.toLowerCase().includes(b.toLowerCase()));
    const foundModel = models.find(m => text.toLowerCase().includes(m.toLowerCase()));

    if (foundBrand || foundModel) {
      return { brand: foundBrand, model: foundModel };
    }
    return null;
  },

  // Extract tire size from text (e.g., 185/65R15)
  extractTireSize: (text: string): string | null => {
    const tireSizeRegex = /(\d{2,3})\/(\d{2,3})[Rr]?(\d{2})/;
    const match = text.match(tireSizeRegex);
    if (match) {
      return `${match[1]}/${match[2]}R${match[3]}`;
    }
    return null;
  },

  // Validate and format part number
  formatPartNumber: (partNumber: string): string | null => {
    // Expected format: XXX-NNN-NNNXX or similar
    const cleaned = partNumber.toUpperCase().replace(/\s/g, '');
    const partNumberRegex = /^[A-Z]{2,6}-?\d{3,6}-?\d{2,}[A-Z]?$/;
    if (partNumberRegex.test(cleaned)) {
      return cleaned.replace(/-+/g, '-');
    }
    return null;
  }
};

describe('Thai Normalizer - Unit Tests', () => {

  describe('Text Normalization', () => {
    it('should normalize Thai text by removing tone marks', () => {
      const input = 'ยางรถยนต์';
      const result = ThaiNormalizer.normalize(input);
      expect(result).toBe('ยางรถยนต์');
    });

    it('should handle text with repeated characters (ๆ)', () => {
      const input = 'ยางรถยนต์ๆ';
      const result = ThaiNormalizer.normalize(input);
      expect(result).not.toContain('ๆ');
    });

    it('should trim whitespace', () => {
      const input = '  ยางรถยนต์  ';
      const result = ThaiNormalizer.normalize(input);
      expect(result).toBe('ยางรถยนต์');
      expect(result).not.toMatch(/^\s+/);
      expect(result).not.toMatch(/\s+$/);
    });

    it('should convert to lowercase for mixed content', () => {
      const input = 'Honda City ยางรถยนต์';
      const result = ThaiNormalizer.normalize(input);
      expect(result.toLowerCase()).toBe(result);
    });

    it('should handle empty strings', () => {
      const result = ThaiNormalizer.normalize('');
      expect(result).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      const result1 = ThaiNormalizer.normalize(null as any);
      const result2 = ThaiNormalizer.normalize(undefined as any);
      expect(result1).toBe('');
      expect(result2).toBe('');
    });
  });

  describe('Colloquial Term Mapping', () => {
    it('should map "ยางแม็ก" to "ยางรถยนต์ michelin"', () => {
      const input = 'ยางแม็ก';
      const result = ThaiNormalizer.mapColloquial(input);
      expect(result).toContain('michelin');
      expect(result).toContain('ยาง');
    });

    it('should map "น้ำมันสังเครื่อง" to "น้ำมันเครื่อง"', () => {
      const input = 'น้ำมันสังเครื่อง';
      const result = ThaiNormalizer.mapColloquial(input);
      expect(result).toContain('น้ำมันเครื่อง');
    });

    it('should map "น้ำมันหล่อลื่น" to "น้ำมันเครื่อง"', () => {
      const input = 'น้ำมันหล่อลื่น';
      const result = ThaiNormalizer.mapColloquial(input);
      expect(result).toContain('น้ำมันเครื่อง');
    });

    it('should not modify standard terms', () => {
      const input = 'ยางรถยนต์';
      const result = ThaiNormalizer.mapColloquial(input);
      expect(result).toBe(input);
    });

    it('should handle mixed colloquial and standard terms', () => {
      const input = 'ยางแม็กสำหรับ Honda City';
      const result = ThaiNormalizer.mapColloquial(input);
      expect(result).toContain('michelin');
      expect(result.toLowerCase()).toContain('honda');
    });
  });

  describe('Vehicle Model Extraction', () => {
    it('should extract Honda City', () => {
      const input = 'ยาง Honda City 185/65R15';
      const result = ThaiNormalizer.extractVehicle(input);
      expect(result).toEqual({ brand: 'Honda', model: 'City' });
    });

    it('should extract Toyota Vios', () => {
      const input = 'น้ำมันเครื่อง Toyota Vios 5W-30';
      const result = ThaiNormalizer.extractVehicle(input);
      expect(result).toEqual({ brand: 'Toyota', model: 'Vios' });
    });

    it('should extract brand only', () => {
      const input = 'ยาง Honda';
      const result = ThaiNormalizer.extractVehicle(input);
      expect(result?.brand).toBe('Honda');
    });

    it('should return null for no vehicle', () => {
      const input = 'ยางรถยนต์ 185/65R15';
      const result = ThaiNormalizer.extractVehicle(input);
      expect(result).toBeNull();
    });

    it('should handle case insensitive matching', () => {
      const input = 'HONDA city';
      const result = ThaiNormalizer.extractVehicle(input);
      expect(result?.brand).toBe('Honda');
      expect(result?.model).toBe('City');
    });
  });

  describe('Tire Size Extraction', () => {
    it('should extract 185/65R15', () => {
      const input = 'ยาง 185/65R15';
      const result = ThaiNormalizer.extractTireSize(input);
      expect(result).toBe('185/65R15');
    });

    it('should extract 205/55R16', () => {
      const input = '205/55R16';
      const result = ThaiNormalizer.extractTireSize(input);
      expect(result).toBe('205/55R16');
    });

    it('should extract from mixed text', () => {
      const input = 'ยาง Michelin Energy 185/65R15 สำหรับ Honda City';
      const result = ThaiNormalizer.extractTireSize(input);
      expect(result).toBe('185/65R15');
    });

    it('should handle lowercase r', () => {
      const input = '185/65r15';
      const result = ThaiNormalizer.extractTireSize(input);
      expect(result).toBe('185/65R15');
    });

    it('should return null for invalid sizes', () => {
      const result1 = ThaiNormalizer.extractTireSize('ยางขนาดใหญ่');
      const result2 = ThaiNormalizer.extractTireSize('185-65-15');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('Part Number Formatting', () => {
    it('should format ABC-1234-56', () => {
      const input = 'abc-1234-56';
      const result = ThaiNormalizer.formatPartNumber(input);
      expect(result).toBe('ABC-1234-56');
    });

    it('should format TIRE-185-65R15', () => {
      const input = 'tire-185-65r15';
      const result = ThaiNormalizer.formatPartNumber(input);
      expect(result).toBe('TIRE-185-65R15');
    });

    it('should handle spaces', () => {
      const input = 'OIL 1234 56';
      const result = ThaiNormalizer.formatPartNumber(input);
      expect(result).toContain('OIL');
    });

    it('should return null for invalid format', () => {
      const result = ThaiNormalizer.formatPartNumber('invalid-part-number');
      expect(result).toBeNull();
    });

    it('should standardize multiple dashes', () => {
      const input = 'ABC---1234----56';
      const result = ThaiNormalizer.formatPartNumber(input);
      expect(result?.split('-').length).toBeLessThan(input.split('-').length);
    });
  });

  describe('Integration with Test Queries', () => {
    it('should normalize all test queries', () => {
      const queries = testQueries.queries;
      expect(queries.length).toBeGreaterThan(0);

      for (const query of queries) {
        const normalized = ThaiNormalizer.normalize(query.text);
        expect(normalized).toBeDefined();
        expect(normalized.length).toBeGreaterThan(0);
      }
    });

    it('should handle colloquial queries from fixture', () => {
      const colloquialQueries = testQueries.queries.filter(q => q.colloquial);
      expect(colloquialQueries.length).toBeGreaterThan(0);

      for (const query of colloquialQueries) {
        const mapped = ThaiNormalizer.mapColloquial(query.text);
        expect(mapped).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long text', () => {
      const longText = 'ยาง '.repeat(1000);
      const result = ThaiNormalizer.normalize(longText);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const input = 'ยาง!@#$%^&*()รถยนต์';
      const result = ThaiNormalizer.normalize(input);
      expect(result).toContain('ยาง');
      expect(result).toContain('รถยนต์');
    });

    it('should handle mixed Thai-English numbers', () => {
      const input = 'ยาง ๑๘๕/๖๕R๑๕'; // Thai numbers
      const result = ThaiNormalizer.normalize(input);
      expect(result).toBeDefined();
    });

    it('should handle zero-width characters', () => {
      const input = 'ยาง\u200Bรถยนต์'; // zero-width space
      const result = ThaiNormalizer.normalize(input);
      expect(result).toContain('ยาง');
    });
  });
});
