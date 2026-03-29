/**
 * JETSETGO - OCR Processing with Tesseract.js
 * FREE OCR solution - no API costs!
 */

// Tesseract.js worker configuration
const TESSERACT_VERSION = '5'; // Use version 5 for better Thai support
const WORKER_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;

export interface OCROptions {
  language?: string;
  oem?: number;
  psm?: number;
  whitelist?: string;
  preprocessImage?: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words?: OCRWord[];
  lines?: OCRLine[];
  error?: string;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OCRLine {
  text: string;
  confidence: number;
  words: OCRWord[];
  bbox: BoundingBox;
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Thai + English character whitelist for better OCR accuracy
 */
const THAI_ENG_WHITELIST =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮ' +
  'ะาัิีึืุูเแโใไๅๆ็่้๊๋์ำฺ' +
  ' +-.,%:;=[]/\\()$@#&';

/**
 * Perform OCR on an image file or URL using Tesseract.js
 * Runs completely client-side - FREE!
 */
export async function performOCR(
  imageSource: string | File | ArrayBuffer,
  options: OCROptions = {}
): Promise<OCRResult> {
  const {
    language = 'tha+eng', // Thai + English
    oem = 3,              // Default OCR engine mode
    psm = 6,              // Assume uniform block of text
    whitelist = THAI_ENG_WHITELIST,
    preprocessImage = true
  } = options;

  try {
    // Dynamically import Tesseract.js
    const Tesseract = await importTesseract();

    // Create worker
    const worker = await Tesseract.createWorker({
      logger: (m: any) => {
        // Optional: Log progress for debugging
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    // Load language
    await worker.loadLanguage(language);
    await worker.initialize(language);

    // Set parameters for better accuracy
    await worker.setParameters({
      tessedit_char_whitelist: whitelist,
      tessedit_pageseg_mode: psm.toString(),
      tessedit_ocr_engine_mode: oem.toString(),
      preserve_interword_spaces: '1',
    });

    // Recognize
    const { data } = await worker.recognize(imageSource);

    // Terminate worker to free resources
    await worker.terminate();

    // Process results
    return {
      text: data.text,
      confidence: data.confidence,
      words: data.words?.map((w: any) => ({
        text: w.text,
        confidence: w.confidence,
        bbox: {
          x0: w.bbox.x0,
          y0: w.bbox.y0,
          x1: w.bbox.x1,
          y1: w.bbox.y1
        }
      })),
      lines: data.lines?.map((l: any) => ({
        text: l.text,
        confidence: l.confidence,
        words: l.words?.map((w: any) => ({
          text: w.text,
          confidence: w.confidence,
          bbox: {
            x0: w.bbox.x0,
            y0: w.bbox.y0,
            x1: w.bbox.x1,
            y1: w.bbox.y1
          }
        })),
        bbox: {
          x0: l.bbox.x0,
          y0: l.bbox.y0,
          x1: l.bbox.x1,
          y1: l.bbox.y1
        }
      }))
    };

  } catch (error) {
    console.error('OCR Error:', error);
    return {
      text: '',
      confidence: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Import Tesseract.js dynamically
 */
async function importTesseract() {
  // For browser/deno environment
  if (typeof window !== 'undefined') {
    const module = await import(WORKER_PATH);
    return module.default || module;
  }

  // For Node.js/Deno environment
  const Tesseract = await import('https://esm.sh/tesseract.js@5');
  return Tesseract.default || Tesseract;
}

/**
 * Extract table data from OCR results
 * Attempts to reconstruct table structure from text positions
 */
export function extractTableFromOCR(ocrResult: OCRResult): string[][] {
  if (!ocrResult.words || ocrResult.words.length === 0) {
    return [];
  }

  const words = ocrResult.words;
  const rows: string[][] = [];

  // Group words by Y position (rows)
  const rowGroups = new Map<number, OCRWord[]>();
  const yTolerance = 5; // Pixels tolerance for same row

  for (const word of words) {
    const y = Math.round(word.bbox.y0 / yTolerance) * yTolerance;

    if (!rowGroups.has(y)) {
      rowGroups.set(y, []);
    }
    rowGroups.get(y)!.push(word);
  }

  // Sort rows by Y position
  const sortedRows = Array.from(rowGroups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([_, words]) => words);

  // Sort words within each row by X position
  for (const row of sortedRows) {
    row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    rows.push(row.map(w => w.text.trim()));
  }

  return rows;
}

/**
 * Detect table structure from extracted rows
 */
export interface TableStructure {
  headers: string[];
  rows: string[][];
  columns: number;
}

export function detectTableStructure(tableData: string[][]): TableStructure {
  if (tableData.length === 0) {
    return { headers: [], rows: [], columns: 0 };
  }

  // Assume first row is header
  const headers = tableData[0];
  const rows = tableData.slice(1);

  return {
    headers,
    rows,
    columns: headers.length
  };
}

/**
 * Extract catalog data from OCR results
 * Attempts to identify part numbers, names, prices, etc.
 */
export interface CatalogData {
  partNumber?: string;
  oemNumber?: string;
  name?: string;
  brand?: string;
  price?: number;
  stock?: number;
  raw?: string;
}

export function extractCatalogData(ocrResult: OCRResult): CatalogData[] {
  const results: CatalogData[] = [];
  const tableData = extractTableFromOCR(ocrResult);

  if (tableData.length === 0) {
    // No table found, try to extract from text
    return [extractFromText(ocrResult.text)];
  }

  const structure = detectTableStructure(tableData);

  // Map columns to data types based on headers
  const columnMapping = identifyColumnTypes(structure.headers);

  // Extract data from each row
  for (const row of structure.rows) {
    const data: CatalogData = {};

    for (let i = 0; i < row.length && i < structure.headers.length; i++) {
      const header = structure.headers[i].toLowerCase();
      const value = row[i];

      switch (columnMapping[i]) {
        case 'partNumber':
          data.partNumber = value;
          break;
        case 'oemNumber':
          data.oemNumber = value;
          break;
        case 'name':
          data.name = value;
          break;
        case 'brand':
          data.brand = value;
          break;
        case 'price':
          data.price = parsePrice(value);
          break;
        case 'stock':
          data.stock = parseInt(value) || undefined;
          break;
      }
    }

    if (data.partNumber || data.name) {
      results.push(data);
    }
  }

  return results;
}

/**
 * Identify column types from table headers
 */
function identifyColumnTypes(headers: string[]): string[] {
  const mapping: string[] = [];

  for (const header of headers) {
    const h = header.toLowerCase();

    if (h.includes('part') || h.includes('number') || h.includes('รหัส') || h.includes('บาร์โค้ด')) {
      mapping.push('partNumber');
    } else if (h.includes('oem') || h.includes('original')) {
      mapping.push('oemNumber');
    } else if (h.includes('name') || h.includes('ชื่อ') || h.includes('รายการ')) {
      mapping.push('name');
    } else if (h.includes('brand') || h.includes('ยี่ห้อ') || h.includes('แบรนด์')) {
      mapping.push('brand');
    } else if (h.includes('price') || h.includes('ราคา')) {
      mapping.push('price');
    } else if (h.includes('stock') || h.includes('คลัง') || h.includes('จำนวน')) {
      mapping.push('stock');
    } else {
      mapping.push('unknown');
    }
  }

  return mapping;
}

/**
 * Extract catalog data from plain text
 */
function extractFromText(text: string): CatalogData {
  const data: CatalogData = { raw: text };

  // Try to find part number (alphanumeric pattern)
  const partMatch = text.match(/[A-Z0-9]{3,}/i);
  if (partMatch) {
    data.partNumber = partMatch[0];
  }

  // Try to find price (Thai Baht or just number)
  const priceMatch = text.match(/(\d+[.,]?\d*)\s*(บาท|THB|฿)?/);
  if (priceMatch) {
    data.price = parsePrice(priceMatch[0]);
  }

  return data;
}

/**
 * Parse price from string
 */
function parsePrice(str: string): number | undefined {
  const cleaned = str.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Preprocess image for better OCR accuracy
 */
export async function preprocessImage(
  imageSource: string | File
): Promise<string> {
  // In a browser environment, we could use Canvas API
  // For now, return the source as-is
  // This could be extended to:
  // - Convert to grayscale
  // - Increase contrast
  // - Remove noise
  // - Deskew the image
  return typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
}

/**
 * Batch OCR for multiple images
 */
export async function batchOCR(
  images: (string | File)[],
  options: OCROptions = {}
): Promise<OCRResult[]> {
  const results: OCRResult[] = [];

  for (let i = 0; i < images.length; i++) {
    console.log(`Processing image ${i + 1}/${images.length}`);
    const result = await performOCR(images[i], options);
    results.push(result);
  }

  return results;
}

/**
 * Merge OCR results from multiple pages
 */
export function mergeOCRResults(results: OCRResult[]): OCRResult {
  const merged: OCRResult = {
    text: '',
    confidence: 0,
    words: [],
    lines: []
  };

  let totalConfidence = 0;
  let wordIndex = 0;

  for (const result of results) {
    merged.text += (merged.text ? '\n\n' : '') + result.text;
    totalConfidence += result.confidence;

    if (result.words) {
      for (const word of result.words) {
        merged.words!.push({
          ...word,
          bbox: {
            ...word.bbox,
            // Adjust Y position for page offset if needed
          }
        });
      }
    }

    if (result.lines) {
      merged.lines!.push(...result.lines);
    }
  }

  merged.confidence = totalConfidence / results.length;

  return merged;
}
