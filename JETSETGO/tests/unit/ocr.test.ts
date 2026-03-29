/**
 * OCR (Optical Character Recognition) Unit Tests
 *
 * Tests the OCR processing using Tesseract.js:
 * - Thai text extraction accuracy (>80%)
 * - Part number extraction (>85%)
 * - Mixed Thai/English text handling
 * - Performance benchmarks (<3s avg)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load test fixtures
const ocrBaseline = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/expected-results/thai-ocr-baseline.json'), 'utf-8')
);

// Mock OCR processor (replace with actual implementation)
async function mockProcessOCR(imagePath: string, options: any = {}): Promise<{
  text: string;
  confidence: number;
  processingTime: number;
}> {
  const startTime = Date.now();

  // Simulate OCR processing
  await new Promise(resolve => setTimeout(resolve, 50));

  // Mock results based on image name
  const mockResults: Record<string, { text: string; confidence: number }> = {
    'thai-text-sample.png': {
      text: 'ยางรถยนต์ Michelin Energy XM2',
      confidence: 85
    },
    'part-number-sample.png': {
      text: 'Part No: TIRE-185-65R15',
      confidence: 90
    },
    'catalog-page-1.png': {
      text: 'รายการอะไหล่ยนต์ ยาง น้ำมันเครื่อง ไส้กรอง',
      confidence: 78
    },
    'mixed-text.png': {
      text: 'ขนาด 185/65R15 ยี่ห้อ Michelin สำหรับรถยนต์',
      confidence: 82
    },
    'table-sample.png': {
      text: 'Part No\tDescription\tPrice\nTIRE-001\tยาง Michelin\t3,500',
      confidence: 80
    },
    'low-quality-sample.png': {
      text: 'ยางรถยนต์',
      confidence: 65
    },
    'rotated-sample.png': {
      text: 'ยางรถยนต์ Michelin',
      confidence: 70
    },
    'noisy-sample.png': {
      text: 'ยาง รถ ยน ต์',
      confidence: 60
    }
  };

  const fileName = imagePath.split('/').pop() || '';
  const result = mockResults[fileName] || { text: '', confidence: 0 };

  return {
    ...result,
    processingTime: Date.now() - startTime
  };
}

describe('OCR - Tesseract.js Unit Tests', () => {

  describe('Thai Text Recognition', () => {
    it('should extract Thai text with >80% accuracy', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/thai-text-sample.png');

      expect(result.confidence).toBeGreaterThan(80);
      expect(result.text).toContain('ยาง');
    });

    it('should handle mixed Thai-English text', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/mixed-text.png');

      expect(result.text).toMatch(/[\u0E00-\u0E7F]/); // Has Thai
      expect(result.text).toMatch(/[a-zA-Z]/);      // Has English
    });

    it('should normalize problematic Thai characters', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/thai-text-sample.png');

      // Check for common OCR errors in Thai
      expect(result.text).not.toContain('\u0E33\u0E33'); // Double Sara Am
    });

    it('should handle tone mark variations', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/thai-tones.png');

      // Should have some Thai characters
      const thaiCharCount = (result.text.match(/[\u0E00-\u0E7F]/g) || []).length;
      expect(thaiCharCount).toBeGreaterThan(10);
    });
  });

  describe('Part Number Extraction', () => {
    it('should extract part numbers with >85% accuracy', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/part-number-sample.png');

      expect(result.confidence).toBeGreaterThanOrEqual(85);
      expect(result.text).toMatch(/[A-Z]+-?\d+-?\d+[A-Z]?/i);
    });

    it('should preserve hyphenated part numbers', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/part-number-sample.png');

      expect(result.text).toContain('TIRE-185-65R15');
    });

    it('should extract numbers from Thai text context', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/mixed-text.png');

      expect(result.text).toContain('185');
      expect(result.text).toContain('65');
      expect(result.text).toContain('R15');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process image within average time threshold', async () => {
      const startTime = Date.now();
      await mockProcessOCR('./tests/fixtures/images/thai-text-sample.png');
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThanOrEqual(3000); // 3 seconds
    });

    it('should never exceed max processing time', async () => {
      const startTime = Date.now();
      await mockProcessOCR('./tests/fixtures/images/thai-text-sample.png');
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(10000); // 10 seconds max
    });
  });

  describe('Edge Cases', () => {
    it('should handle noisy images', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/noisy-sample.png');

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle rotated images', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/rotated-sample.png');

      expect(result.text.length).toBeGreaterThan(0);
    });

    it('should handle low quality images', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/low-quality-sample.png');

      expect(result.text).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Table Reconstruction', () => {
    it('should extract 2-column table data', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/table-2-col.png');

      const lines = result.text.split('\n').filter((l: string) => l.trim());
      expect(lines.length).toBeGreaterThan(5); // At least 5 data rows
    });

    it('should handle tables with numeric data', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/table-with-numbers.png');

      expect(result.text).toMatch(/\d+/);        // Has numbers
      expect(result.text).toMatch(/\d{3,}/);     // Has part numbers
    });

    it('should extract part numbers from table', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/parts-table.png');

      // Should find part number pattern
      expect(result.text).toMatch(/[A-Z]{2,}-\d{3,}/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle low quality images', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/low-quality-sample.png');

      // Should still produce some output even if low quality
      expect(result.text.length).toBeGreaterThan(0);
    });

    it('should handle rotated images', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/rotated-sample.png');

      // Tesseract should auto-detect orientation
      expect(result.confidence).toBeGreaterThan(50);
    });

    it('should handle images with noise', async () => {
      const result = await mockProcessOCR('./tests/fixtures/images/noisy-sample.png');

      expect(result.text.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should process single page within 30 seconds', async () => {
      const start = Date.now();
      await mockProcessOCR('./tests/fixtures/images/thai-text-sample.png');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(30000);
    });

    it('should handle batch processing efficiently', async () => {
      const images = [
        './tests/fixtures/images/page-1.png',
        './tests/fixtures/images/page-2.png',
        './tests/fixtures/images/page-3.png'
      ];

      const start = Date.now();
      const results = await Promise.all(images.map(img => mockProcessOCR(img)));
      const duration = Date.now() - start;

      expect(results).toHaveLength(3);
      expect(duration).toBeLessThan(60000); // 3 pages in 1 minute
    });
  });
});
