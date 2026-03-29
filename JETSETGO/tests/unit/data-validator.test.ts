/**
 * Data Validator Unit Tests
 *
 * Tests the data validation logic for catalog entries:
 * - Part number format validation
 * - Required field validation
 * - Thai text validation
 * - Price/quantity validation
 * - Category mapping
 */

import { describe, it, expect } from 'vitest';

// Mock data validator (replace with actual import)
const DataValidator = {
  // Validate part number format
  validatePartNumber: (partNumber: string): { valid: boolean; error?: string } => {
    if (!partNumber || partNumber.trim() === '') {
      return { valid: false, error: 'Part number is required' };
    }

    const trimmed = partNumber.trim().toUpperCase();
    const partNumberRegex = /^[A-Z]{2,6}-?\d{3,6}-?\d{2,}[A-Z]?$/;

    if (!partNumberRegex.test(trimmed)) {
      return { valid: false, error: 'Invalid part number format' };
    }

    return { valid: true };
  },

  // Validate catalog entry
  validateCatalogEntry: (entry: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Required fields
    if (!entry.partNumber || entry.partNumber.trim() === '') {
      errors.push('partNumber is required');
    }

    if (!entry.name || entry.name.trim() === '') {
      errors.push('name is required');
    }

    if (!entry.category || entry.category.trim() === '') {
      errors.push('category is required');
    }

    // Part number format
    const pnResult = DataValidator.validatePartNumber(entry.partNumber || '');
    if (!pnResult.valid) {
      errors.push(pnResult.error || 'Invalid part number');
    }

    // Price validation
    if (entry.price !== undefined) {
      if (typeof entry.price !== 'number' || entry.price < 0) {
        errors.push('price must be a positive number');
      }
    }

    // Quantity validation
    if (entry.quantity !== undefined) {
      if (typeof entry.quantity !== 'number' || entry.quantity < 0) {
        errors.push('quantity must be a non-negative number');
      }
    }

    // Thai text validation (if present)
    if (entry.nameTh && entry.nameTh.trim() !== '') {
      if (!/[\u0E00-\u0E7F]/.test(entry.nameTh)) {
        errors.push('nameTh must contain Thai characters');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Validate Thai text
  validateThaiText: (text: string): { valid: boolean; hasThai: boolean } => {
    if (!text || text.trim() === '') {
      return { valid: false, hasThai: false };
    }

    const hasThai = /[\u0E00-\u0E7F]/.test(text);
    return { valid: true, hasThai };
  },

  // Validate tire size
  validateTireSize: (size: string): { valid: boolean; formatted?: string } => {
    if (!size || size.trim() === '') {
      return { valid: false };
    }

    const tireSizeRegex = /(\d{2,3})\/(\d{2,3})[Rr]?(\d{2})/;
    const match = size.match(tireSizeRegex);

    if (!match) {
      return { valid: false };
    }

    return {
      valid: true,
      formatted: `${match[1]}/${match[2]}R${match[3]}`
    };
  },

  // Validate category
  validateCategory: (category: string): { valid: boolean; normalized?: string } => {
    const validCategories = [
      'tires', 'engine-oil', 'air-filter', 'oil-filter',
      'spark-plug', 'brake-pads', 'battery', 'shock-absorber'
    ];

    if (!category || category.trim() === '') {
      return { valid: false };
    }

    const normalized = category.toLowerCase().trim().replace(/\s+/g, '-');

    if (!validCategories.includes(normalized)) {
      return { valid: false };
    }

    return { valid: true, normalized };
  },

  // Sanitize input (XSS prevention)
  sanitize: (text: string): string => {
    if (!text) return '';

    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
};

describe('Data Validator - Unit Tests', () => {

  describe('Part Number Validation', () => {
    it('should accept valid part number format', () => {
      const result = DataValidator.validatePartNumber('TIRE-185-65R15');
      expect(result.valid).toBe(true);
    });

    it('should accept part number without hyphens', () => {
      const result = DataValidator.validatePartNumber('TIRE18565R15');
      expect(result.valid).toBe(true);
    });

    it('should reject empty part number', () => {
      const result = DataValidator.validatePartNumber('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject invalid format', () => {
      const result = DataValidator.validatePartNumber('INVALID-PART-NUMBER');
      expect(result.valid).toBe(false);
    });

    it('should handle lowercase input', () => {
      const result1 = DataValidator.validatePartNumber('tire-185-65r15');
      const result2 = DataValidator.validatePartNumber('TIRE-185-65R15');
      expect(result1.valid).toBe(result2.valid);
    });
  });

  describe('Catalog Entry Validation', () => {
    it('should accept valid catalog entry', () => {
      const entry = {
        partNumber: 'TIRE-001',
        name: 'ยางรถยนต์ Michelin',
        category: 'tires',
        price: 3500,
        quantity: 10
      };

      const result = DataValidator.validateCatalogEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject entry missing part number', () => {
      const entry = {
        name: 'ยางรถยนต์ Michelin',
        category: 'tires'
      };

      const result = DataValidator.validateCatalogEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('partNumber is required');
    });

    it('should reject entry missing name', () => {
      const entry = {
        partNumber: 'TIRE-001',
        category: 'tires'
      };

      const result = DataValidator.validateCatalogEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required');
    });

    it('should reject negative price', () => {
      const entry = {
        partNumber: 'TIRE-001',
        name: 'ยางรถยนต์',
        category: 'tires',
        price: -100
      };

      const result = DataValidator.validateCatalogEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('price'))).toBe(true);
    });

    it('should reject negative quantity', () => {
      const entry = {
        partNumber: 'TIRE-001',
        name: 'ยางรถยนต์',
        category: 'tires',
        quantity: -5
      };

      const result = DataValidator.validateCatalogEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('quantity'))).toBe(true);
    });

    it('should collect multiple errors', () => {
      const entry = {
        // Missing required fields
      };

      const result = DataValidator.validateCatalogEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  describe('Thai Text Validation', () => {
    it('should detect Thai text correctly', () => {
      const result = DataValidator.validateThaiText('ยางรถยนต์');
      expect(result.valid).toBe(true);
      expect(result.hasThai).toBe(true);
    });

    it('should detect non-Thai text', () => {
      const result = DataValidator.validateThaiText('Car Tire');
      expect(result.valid).toBe(true);
      expect(result.hasThai).toBe(false);
    });

    it('should detect mixed Thai-English text', () => {
      const result = DataValidator.validateThaiText('ยาง Michelin');
      expect(result.valid).toBe(true);
      expect(result.hasThai).toBe(true);
    });

    it('should reject empty string', () => {
      const result = DataValidator.validateThaiText('');
      expect(result.valid).toBe(false);
      expect(result.hasThai).toBe(false);
    });

    it('should handle whitespace-only input', () => {
      const result = DataValidator.validateThaiText('   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('Tire Size Validation', () => {
    it('should accept valid tire size 185/65R15', () => {
      const result = DataValidator.validateTireSize('185/65R15');
      expect(result.valid).toBe(true);
      expect(result.formatted).toBe('185/65R15');
    });

    it('should accept valid tire size 205/55R16', () => {
      const result = DataValidator.validateTireSize('205/55R16');
      expect(result.valid).toBe(true);
    });

    it('should accept lowercase r', () => {
      const result = DataValidator.validateTireSize('185/65r15');
      expect(result.valid).toBe(true);
      expect(result.formatted).toBe('185/65R15');
    });

    it('should reject invalid format', () => {
      const result = DataValidator.validateTireSize('invalid-size');
      expect(result.valid).toBe(false);
    });

    it('should reject empty string', () => {
      const result = DataValidator.validateTireSize('');
      expect(result.valid).toBe(false);
    });
  });

  describe('Category Validation', () => {
    it('should accept valid category', () => {
      const result = DataValidator.validateCategory('tires');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('tires');
    });

    it('should normalize category format', () => {
      const result = DataValidator.validateCategory('Engine Oil');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('engine-oil');
    });

    it('should reject invalid category', () => {
      const result = DataValidator.validateCategory('invalid-category');
      expect(result.valid).toBe(false);
    });

    it('should reject empty category', () => {
      const result = DataValidator.validateCategory('');
      expect(result.valid).toBe(false);
    });
  });

  describe('Input Sanitization (XSS Prevention)', () => {
    it('should escape HTML tags', () => {
      const input = '<script>alert("xss")</script>';
      const result = DataValidator.sanitize(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
    });

    it('should escape single quotes', () => {
      const input = "'; DROP TABLE users; --";
      const result = DataValidator.sanitize(input);
      expect(result).toContain('&#x27;');
    });

    it('should escape double quotes', () => {
      const input = '"onmouseover="alert(1)';
      const result = DataValidator.sanitize(input);
      expect(result).toContain('&quot;');
    });

    it('should handle empty string', () => {
      const result = DataValidator.sanitize('');
      expect(result).toBe('');
    });

    it('should preserve safe Thai text', () => {
      const input = 'ยางรถยนต์ Michelin';
      const result = DataValidator.sanitize(input);
      expect(result).toContain('ยาง');
      expect(result).toContain('Michelin');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null input gracefully', () => {
      const result = DataValidator.validateCatalogEntry(null);
      expect(result.valid).toBe(false);
    });

    it('should handle undefined input gracefully', () => {
      const result = DataValidator.validateCatalogEntry(undefined);
      expect(result.valid).toBe(false);
    });

    it('should handle extra whitespace in part number', () => {
      const result = DataValidator.validatePartNumber('  TIRE-001  ');
      expect(result.valid).toBe(true);
    });

    it('should handle zero price/quantity', () => {
      const entry = {
        partNumber: 'TIRE-001',
        name: 'ยางรถยนต์',
        category: 'tires',
        price: 0,
        quantity: 0
      };

      const result = DataValidator.validateCatalogEntry(entry);
      expect(result.valid).toBe(true);
    });

    it('should handle very long text', () => {
      const longText = 'ยางรถยนต์ '.repeat(1000);
      const result = DataValidator.validateThaiText(longText);
      expect(result.valid).toBe(true);
      expect(result.hasThai).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete tire product', () => {
      const product = {
        partNumber: 'TIRE-MIC-18565R15',
        name: 'ยางรถยนต์ Michelin Energy XM2',
        nameTh: 'ยางรถยนต์มิชลิน',
        category: 'tires',
        tireSize: '185/65R15',
        brand: 'Michelin',
        price: 3500,
        quantity: 10
      };

      const result = DataValidator.validateCatalogEntry(product);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate complete oil product', () => {
      const product = {
        partNumber: 'OIL-MOT-5W30-4L',
        name: 'น้ำมันเครื่อง Motul 8100 X-cess',
        nameTh: 'น้ำมันเครื่องโมตูล',
        category: 'engine-oil',
        viscosity: '5W-30',
        brand: 'Motul',
        price: 1250,
        quantity: 25
      };

      const result = DataValidator.validateCatalogEntry(product);
      expect(result.valid).toBe(true);
    });
  });
});
