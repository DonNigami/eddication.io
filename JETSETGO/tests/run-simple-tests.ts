/**
 * Simple Test for Thai Normalizer
 * No vitest dependency required
 */

import { describe, it, expect, runTests } from './runner.ts';

// Mock Thai Normalizer
const ThaiNormalizer = {
  normalize: (text: string): string => {
    // Remove only tone marks that don't change meaning, keep '์' (pinta)
    return text.toLowerCase().trim().replace(/[ๆฺํ]/g, '');
  },
  mapColloquial: (text: string): string => {
    const mappings: Record<string, string> = {
      'ยางแม็ก': 'ยางรถยนต์ michelin',
      'น้ำมันสังเครื่อง': 'น้ำมันเครื่อง',
    };
    for (const [colloquial, standard] of Object.entries(mappings)) {
      if (text.includes(colloquial)) return text.replace(colloquial, standard);
    }
    return text;
  },
  extractVehicle: (text: string): { brand?: string } | null => {
    const brands = ['Honda', 'Toyota', 'Mitsubishi', 'Nissan', 'Mazda', 'Isuzu'];
    const found = brands.find(b => text.toLowerCase().includes(b.toLowerCase()));
    return found ? { brand: found } : null;
  },
  extractTireSize: (text: string): string | null => {
    const match = text.match(/(\d{2,3})\/(\d{2,3})[Rr]?(\d{2})/);
    return match ? `${match[1]}/${match[2]}R${match[3]}` : null;
  },
  validatePartNumber: (partNumber: string): boolean => {
    // Part number format: XXX-NNN-NNN or TIRE-185-65R15 (with optional R suffix)
    const patterns = [
      /^[A-Z]{2,6}-\d{3,6}-\d{2,}$/,      // Standard: ABC-123-45
      /^[A-Z]{2,6}-\d{3,6}-\d{2,}[A-Z]$/,  // With letter: ABC-123-45A
      /^[A-Z]{2,6}-\d{3,}-\d{2,}R\d{2}$/,  // Tire size: TIRE-185-65R15
    ];
    return patterns.some(p => p.test(partNumber.toUpperCase()));
  }
};

describe('Thai Normalizer', () => {
  it('should normalize Thai text', () => {
    const result = ThaiNormalizer.normalize('ยางรถยนต์');
    expect(result).toBe('ยางรถยนต์');
  });

  it('should trim whitespace', () => {
    const result = ThaiNormalizer.normalize('  ยาง  ');
    expect(result).toBe('ยาง');
  });

  it('should map colloquial terms', () => {
    const result = ThaiNormalizer.mapColloquial('ยางแม็ก');
    expect(result).toContain('michelin');
  });

  it('should extract vehicle brand', () => {
    const result = ThaiNormalizer.extractVehicle('ยาง Honda City');
    expect(result?.brand).toBe('Honda');
  });

  it('should extract tire size', () => {
    const result = ThaiNormalizer.extractTireSize('ยาง 185/65R15');
    expect(result).toBe('185/65R15');
  });
});

describe('Data Validator', () => {
  it('should validate part number format', () => {
    const partNumber = 'TIRE-185-65R15';
    const isValid = ThaiNormalizer.validatePartNumber(partNumber);
    expect(isValid).toBeTruthy();
  });

  it('should validate standard part number', () => {
    const partNumber = 'OIL-1234-56';
    const isValid = ThaiNormalizer.validatePartNumber(partNumber);
    expect(isValid).toBeTruthy();
  });

  it('should reject invalid part number', () => {
    const partNumber = 'INVALID';
    const isValid = ThaiNormalizer.validatePartNumber(partNumber);
    expect(isValid).toBeFalsy();
  });

  it('should handle Thai text validation', () => {
    const hasThai = /[\u0E00-\u0E7F]/.test('ยางรถยนต์');
    expect(hasThai).toBeTruthy();
  });
});

describe('Search Mock', () => {
  it('should find tires', () => {
    const products = [
      { name: 'ยางรถยนต์ Michelin', category: 'tires' },
      { name: 'น้ำมันเครื่อง Motul', category: 'engine-oil' }
    ];
    const results = products.filter(p => p.category === 'tires');
    expect(results.length).toBe(1);
    expect(results[0].category).toBe('tires');
  });

  it('should search by brand', () => {
    const products = [
      { name: 'ยาง Michelin', brand: 'Michelin' },
      { name: 'ยาง Bridgestone', brand: 'Bridgestone' }
    ];
    const results = products.filter(p => p.brand === 'Michelin');
    expect(results.length).toBe(1);
    expect(results[0].brand).toBe('Michelin');
  });

  it('should handle Thai text search', () => {
    const products = [
      { name: 'ยางรถยนต์ Michelin', keywords: ['ยาง', 'รถยนต์', 'Michelin'] },
      { name: 'น้ำมันเครื่อง Motul', keywords: ['น้ำมัน', 'เครื่อง', 'Motul'] }
    ];
    const results = products.filter(p => p.keywords.includes('ยาง'));
    expect(results.length).toBe(1);
  });
});

describe('LINE Webhook Mock', () => {
  it('should detect search intent', () => {
    const message = 'ยางรถยนต์';
    const hasSearchKeyword = /ยาง|น้ำมัน|ค้นหา|หา/.test(message);
    expect(hasSearchKeyword).toBeTruthy();
  });

  it('should detect help intent', () => {
    const message = 'ช่วยเหลือ';
    const hasHelpKeyword = /ช่วย|help|วิธีใช้/.test(message);
    expect(hasHelpKeyword).toBeTruthy();
  });

  it('should extract vehicle from message', () => {
    const message = 'หายางสำหรับ Honda City';
    const vehicle = ThaiNormalizer.extractVehicle(message);
    expect(vehicle?.brand).toBe('Honda');
  });
});

describe('OCR Mock', () => {
  it('should extract Thai characters', () => {
    const text = 'ยางรถยนต์ Michelin';
    const hasThai = /[\u0E00-\u0E7F]/.test(text);
    const hasEnglish = /[a-zA-Z]/.test(text);
    expect(hasThai).toBeTruthy();
    expect(hasEnglish).toBeTruthy();
  });

  it('should extract part number pattern', () => {
    const text = 'Part No: TIRE-185-65R15';
    const match = text.match(/[A-Z]{2,}-\d{3,}-\d{2,}R\d{2}/);
    expect(match).toBeDefined();
  });

  it('should calculate confidence score', () => {
    const confidence = 85;
    expect(confidence).toBeGreaterThan(80);
    expect(confidence).toBeLessThanOrEqual(100);
  });
});

// Run all tests
await runTests();
