/**
 * JETSETGO - Data Structuring Edge Function
 * Converts extracted OCR/text data to structured catalog records
 *
 * Features:
 * - Pattern matching for part/tire catalogs
 * - Table-to-record conversion
 * - Data validation
 * - Deduplication
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==================== CONFIGURATION ====================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ==================== TYPES ====================
interface StructureRequest {
  ocrResultId?: string;
  jobId?: string;
  rawData?: any[];
  sourceType?: 'parts' | 'tires' | 'auto';
}

interface StructureResponse {
  success: boolean;
  records?: StructuredRecord[];
  validationIssues?: ValidationIssue[];
  stats?: {
    total: number;
    valid: number;
    needsReview: number;
    invalid: number;
  };
  error?: string;
}

interface StructuredRecord {
  table: 'parts_catalog' | 'tires_catalog';
  data: any;
  confidence: number;
}

interface ValidationIssue {
  record: any;
  issues: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ==================== PART NUMBER PATTERNS ====================
const PART_NUMBER_PATTERNS = [
  /^[A-Z]{2,4}-?\d{4,6}[A-Z]?$/i,        // AB-12345 or AB12345
  /^\d{4,6}-?[A-Z]{2,4}$/i,              // 12345-AB
  /^[A-Z0-9]{8,15}$/i,                    // Alphanumeric 8-15 chars
  /^TH-[A-Z0-9-]+$/i,                     // Thai prefix
];

// ==================== TIRE SIZE PATTERN ====================
const TIRE_SIZE_PATTERN = /^(\d{2,3})\/(\d{2,5})[Rr]?(\d{2})(\w)?(?:\/?(\d{2}))?$/;

// ==================== THAI BRAND MAPPING ====================
const BRAND_MAPPING: Record<string, string> = {
  // Thai to English brand names
  'ซาบู': 'Subaru',
  'โตโยต้า': 'Toyota',
  'ฮอนด้า': 'Honda',
  'นิสสัน': 'Nissan',
  'มิตซูบิชิ': 'Mitsubishi',
  'มาสด้า': 'Mazda',
  'สุซูกิ': 'Suzuki',
  'ไอซูซุ': 'Isuzu',
  'ฟอร์ด': 'Ford',
  'เชฟโรเลต': 'Chevrolet',
  'บีเอ็มดับเบิลยู': 'BMW',
  'เมอร์เซเดส': 'Mercedes',
  'โฟล์คสวาเกน': 'Volkswagen',
  'ออดี้': 'Audi',
  'โตโยต้า': 'Toyota',
  'ยOKOHAMA': 'Yokohama',
  'บริดจสโตน': 'Bridgestone',
  'มิชลิน': 'Michelin',
  'กูดเยียร์': 'Goodyear',
  'ดันลอป': 'Dunlop',
};

// ==================== NORMALIZE BRAND NAME ====================
function normalizeBrandName(brand: string): string {
  if (!brand) return '';
  const trimmed = brand.trim();
  return BRAND_MAPPING[trimmed] || BRAND_MAPPING[trimmed.toUpperCase()] || trimmed;
}

// ==================== EXTRACT PART NUMBER ====================
function extractPartNumber(text: string): string | null {
  // Try to find a part number pattern
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    for (const pattern of PART_NUMBER_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        return match[0].toUpperCase().replace(/[^A-Z0-9-]/g, '');
      }
    }
  }

  return null;
}

// ==================== PARSE TIRE SIZE ====================
function parseTireSize(size: string): {
  width: number | null;
  aspectRatio: number | null;
  rimDiameter: number | null;
  valid: boolean;
} {
  const match = size.match(TIRE_SIZE_PATTERN);

  if (match) {
    return {
      width: parseInt(match[1]) || null,
      aspectRatio: parseInt(match[2]) || null,
      rimDiameter: parseInt(match[3]) || null,
      valid: true,
    };
  }

  return { width: null, aspectRatio: null, rimDiameter: null, valid: false };
}

// ==================== DETECT CATALOG TYPE ====================
function detectCatalogType(records: any[]): 'parts' | 'tires' | 'mixed' {
  let tireCount = 0;
  let partCount = 0;

  for (const record of records) {
    const size = record.Size || record.size || record['ขนาด'];
    if (size && TIRE_SIZE_PATTERN.test(size)) {
      tireCount++;
    } else {
      partCount++;
    }
  }

  if (tireCount > partCount) return 'tires';
  if (partCount > tireCount) return 'parts';
  return 'mixed';
}

// ==================== STRUCTURE PART RECORD ====================
function structurePartRecord(raw: any, sourceId?: string): StructuredRecord | null {
  const partNumber = raw['Part Number'] || raw['part_number'] || raw['PartNumber'] || raw['รหัส'] || raw['Part No'];
  const brand = normalizeBrandName(raw['Brand'] || raw['brand'] || raw['ยี่ห้อ'] || raw['ผู้ผลิต'] || '');
  const nameTh = raw['Name TH'] || raw['name_th'] || raw['ชื่อไทย'] || '';
  const nameEn = raw['Name EN'] || raw['name_en'] || raw['ชื่ออังกฤษ'] || raw['Name'] || raw['Description'] || '';
  const category = raw['Category'] || raw['category'] || raw['หมวดหมู่'] || '';
  const price = parseFloat(
    String(raw['Price'] || raw['price'] || raw['ราคา'] || '0').replace(/[^\d.]/g, '')
  ) || null;
  const stock = parseInt(
    String(raw['Stock'] || raw['stock'] || raw['สต็อก'] || raw['จำนวน'] || '0')
  ) || 0;

  if (!partNumber && !brand && !nameEn) {
    return null; // Skip empty records
  }

  return {
    table: 'parts_catalog',
    data: {
      part_number: partNumber || `PART-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      oem_number: raw['OEM'] || raw['oem'] || raw['OEM Number'] || null,
      part_name_th: nameTh || nameEn,
      part_name_en: nameEn || nameTh,
      brand: brand,
      category: category,
      subcategory: raw['Subcategory'] || raw['subcategory'] || raw['หมวดหมู่ย่อย'] || null,
      description: raw['Description'] || raw['description'] || raw['รายละเอียด'] || null,
      price: price,
      stock_quantity: stock,
      specifications: raw['Specs'] || raw['specs'] || raw['สเปก'] ? { raw: raw['Specs'] || raw['specs'] } : {},
      source_id: sourceId,
      is_active: true,
    },
    confidence: calculateConfidence(raw),
  };
}

// ==================== STRUCTURE TIRE RECORD ====================
function structureTireRecord(raw: any, sourceId?: string): StructuredRecord | null {
  const partNumber = raw['Part Number'] || raw['part_number'] || raw['PartNumber'] || raw['รหัส'] || '';
  const brand = normalizeBrandName(raw['Brand'] || raw['brand'] || raw['ยี่ห้อ'] || raw['ผู้ผลิต'] || '');
  const model = raw['Model'] || raw['model'] || raw['รุ่น'] || '';
  const size = raw['Size'] || raw['size'] || raw['ขนาด'] || '';
  const tireType = raw['Type'] || raw['type'] || raw['ประเภท'] || 'all-season';
  const price = parseFloat(
    String(raw['Price'] || raw['price'] || raw['ราคา'] || '0').replace(/[^\d.]/g, '')
  ) || null;
  const stock = parseInt(
    String(raw['Stock'] || raw['stock'] || raw['สต็อก'] || raw['จำนวน'] || '0')
  ) || 0;

  if (!brand && !size) {
    return null;
  }

  const parsedSize = parseTireSize(size);

  return {
    table: 'tires_catalog',
    data: {
      part_number: partNumber || `TIRE-${brand}-${model}-${size}`.replace(/\s+/g, '-'),
      brand: brand || 'Unknown',
      model: model || 'Standard',
      size: size,
      width: parsedSize.width,
      aspect_ratio: parsedSize.aspectRatio,
      rim_diameter: parsedSize.rimDiameter,
      load_index: raw['Load Index'] || raw['load_index'] || null,
      speed_rating: raw['Speed Rating'] || raw['speed_rating'] || null,
      tire_type: ['summer', 'winter', 'all-season', 'performance', 'off-road'].includes(tireType)
        ? tireType
        : 'all-season',
      vehicle_type: raw['Vehicle'] || raw['vehicle'] || raw['รถ'] || 'sedan',
      price: price,
      stock_quantity: stock,
      source_id: sourceId,
      is_active: true,
    },
    confidence: calculateConfidence(raw),
  };
}

// ==================== CALCULATE CONFIDENCE SCORE ====================
function calculateConfidence(raw: any): number {
  let score = 0.5; // Base score

  // Check for required fields
  if (raw['Part Number'] || raw['part_number']) score += 0.2;
  if (raw['Brand'] || raw['brand']) score += 0.15;
  if (raw['Name'] || raw['name'] || raw['Description']) score += 0.1;
  if (raw['Price'] || raw['price']) score += 0.05;

  return Math.min(score, 1.0);
}

// ==================== VALIDATE STRUCTURED RECORD ====================
function validateStructuredRecord(record: StructuredRecord): ValidationIssue | null {
  const issues: string[] = [];
  const data = record.data;

  if (record.table === 'parts_catalog') {
    if (!data.part_number || data.part_number.startsWith('PART-')) {
      issues.push('Missing or generated part number');
    }
    if (!data.brand) {
      issues.push('Missing brand');
    }
    if (!data.part_name_th && !data.part_name_en) {
      issues.push('Missing part name');
    }
  } else if (record.table === 'tires_catalog') {
    if (!data.brand || data.brand === 'Unknown') {
      issues.push('Missing brand');
    }
    if (!data.size) {
      issues.push('Missing tire size');
    }
    if (!data.width || !data.aspect_ratio || !data.rim_diameter) {
      issues.push('Invalid tire size format');
    }
  }

  if (issues.length > 0) {
    return {
      record: data,
      issues,
      severity: issues.length > 2 ? 'high' : 'medium',
    };
  }

  return null;
}

// ==================== DEDUPLICATE RECORDS ====================
async function deduplicateRecords(
  records: StructuredRecord[]
): Promise<{ unique: StructuredRecord[]; duplicates: StructuredRecord[] }> {
  const unique: StructuredRecord[] = [];
  const duplicates: StructuredRecord[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    const key = `${record.table}:${record.data.part_number}`;

    if (seen.has(key)) {
      duplicates.push(record);
    } else {
      // Check database
      const { data: existing } = await supabase
        .from(record.table)
        .select('id')
        .eq('part_number', record.data.part_number)
        .single();

      if (existing) {
        duplicates.push(record);
      } else {
        unique.push(record);
        seen.add(key);
      }
    }
  }

  return { unique, duplicates };
}

// ==================== PROCESS EXTRACTION RESULTS ====================
async function processExtractionResults(extractionId: string): Promise<StructuredRecord[]> {
  const { data: results, error } = await supabase
    .from('extraction_results')
    .select('*')
    .eq('id', extractionId);

  if (error || !results || results.length === 0) {
    throw new Error('Extraction result not found');
  }

  const rawData = results[0].raw_data;
  const records: any[] = Array.isArray(rawData) ? rawData : [rawData];
  const sourceType = results[0].mapped_to_table || 'auto';

  return await structureRecords(records, sourceType);
}

// ==================== STRUCTURE RECORDS ====================
async function structureRecords(
  records: any[],
  sourceType: 'parts' | 'tires' | 'auto'
): Promise<StructuredRecord[]> {
  const structured: StructuredRecord[] = [];

  // Detect type if auto
  const detectedType = sourceType === 'auto' ? detectCatalogType(records) : sourceType;

  for (const raw of records) {
    let record: StructuredRecord | null = null;

    if (detectedType === 'tires') {
      record = structureTireRecord(raw);
    } else if (detectedType === 'parts') {
      record = structurePartRecord(raw);
    } else {
      // Mixed - try both
      record = structureTireRecord(raw) || structurePartRecord(raw);
    }

    if (record) {
      structured.push(record);
    }
  }

  return structured;
}

// ==================== HTTP HANDLER ====================
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      ocrResultId,
      jobId,
      rawData,
      sourceType = 'auto',
    }: StructureRequest = await req.json();

    let records: StructuredRecord[] = [];

    // Process from OCR result
    if (ocrResultId) {
      records = await processExtractionResults(ocrResultId);
    }
    // Process from raw data
    else if (rawData) {
      const data = Array.isArray(rawData) ? rawData : [rawData];
      records = await structureRecords(data, sourceType);
    }
    // Process from job
    else if (jobId) {
      const { data: ocrResults } = await supabase
        .from('ocr_results')
        .select('id')
        .eq('job_id', jobId);

      if (ocrResults && ocrResults.length > 0) {
        for (const result of ocrResults) {
          const processed = await processExtractionResults(result.id);
          records.push(...processed);
        }
      }
    } else {
      throw new Error('Must provide ocrResultId, jobId, or rawData');
    }

    // Deduplicate
    const { unique, duplicates } = await deduplicateRecords(records);

    // Validate
    const validationIssues: ValidationIssue[] = [];
    let validCount = 0;
    let needsReviewCount = 0;

    for (const record of unique) {
      const issue = validateStructuredRecord(record);
      if (issue) {
        validationIssues.push(issue);
        if (issue.severity === 'high' || issue.severity === 'critical') {
          needsReviewCount++;
        } else {
          validCount++;
        }
      } else {
        validCount++;
      }
    }

    // Add high-severity issues to validation queue
    for (const issue of validationIssues.filter((i) => i.severity === 'high' || i.severity === 'critical')) {
      await supabase.from('validation_queue').insert({
        table_name: unique.find((r) => r.data.part_number === issue.record.part_number)?.table || 'parts_catalog',
        proposed_data: issue.record,
        severity: issue.severity,
        status: 'pending',
        validation_errors: { errors: issue.issues },
      });
    }

    // Insert valid records
    for (const record of unique) {
      const issue = validateStructuredRecord(record);
      if (!issue || (issue.severity !== 'high' && issue.severity !== 'critical')) {
        try {
          await supabase.from(record.table).insert(record.data);
        } catch (error) {
          // Might be duplicate, try update
          await supabase
            .from(record.table)
            .update(record.data)
            .eq('part_number', record.data.part_number);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        records: unique,
        validationIssues,
        stats: {
          total: records.length,
          valid: validCount,
          needsReview: needsReviewCount,
          invalid: validationIssues.filter((i) => i.severity === 'critical').length,
        },
      } as StructureResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Structure error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      } as StructureResponse),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
