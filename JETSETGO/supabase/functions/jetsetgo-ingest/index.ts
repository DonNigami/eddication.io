/**
 * JETSETGO - Document Ingestion Pipeline Edge Function
 * Processes PDF/Excel catalogs and imports to database
 *
 * Flow:
 * 1. Download file from Supabase Storage
 * 2. Extract text/data (PDF or Excel)
 * 3. Parse and structure data
 * 4. Validate and import to database
 * 5. Generate embeddings
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==================== CONFIGURATION ====================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ==================== TYPES ====================
interface IngestRequest {
  sourceId: string;
  autoEmbed?: boolean;
  batchSize?: number;
}

interface IngestResponse {
  success: boolean;
  jobId?: string;
  status?: string;
  recordsProcessed?: number;
  recordsSuccessful?: number;
  recordsFailed?: number;
  error?: string;
}

// ==================== INGESTION STATE ====================
interface IngestionState {
  jobId: string;
  sourceId: string;
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

// ==================== UPDATE JOB PROGRESS ====================
async function updateJobProgress(
  jobId: string,
  stage: string,
  progress: number,
  message: string,
  error?: string
): Promise<void> {
  const updateData: any = {
    stage,
    progress,
    current_message: message,
  };

  if (error) {
    updateData.error_message = error;
  }

  await supabase.from('ingestion_jobs').update(updateData).eq('id', jobId);
}

// ==================== LOG INGESTION MESSAGE ====================
async function logIngestionMessage(
  jobId: string,
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  details?: any
): Promise<void> {
  await supabase.from('ingestion_logs').insert({
    job_id: jobId,
    level,
    message,
    details,
  });
}

// ==================== DOWNLOAD FILE FROM STORAGE ====================
async function downloadFile(sourceId: string): Promise<{ data: ArrayBuffer; type: string; name: string }> {
  const { data: source, error: sourceError } = await supabase
    .from('catalog_sources')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (sourceError || !source) {
    throw new Error(`Source not found: ${sourceError?.message}`);
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('jetsetgo-catalogs')
    .download(source.file_path);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download file: ${downloadError?.message}`);
  }

  const arrayBuffer = await fileData.arrayBuffer();

  return {
    data: arrayBuffer,
    type: source.type,
    name: source.name,
  };
}

// ==================== EXCEL PARSING ====================
async function parseExcel(data: ArrayBuffer): Promise<any[]> {
  // For Deno, we need to use a library that works with Deno
  // Excel parsing libraries like 'xlsx' don't work directly in Deno
  // We'll use a CSV approach or external service

  // Try to parse as CSV first
  const text = new TextDecoder().decode(data);
  const lines = text.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('File appears to be empty or invalid');
  }

  // Parse CSV (simple approach)
  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const record: any = {};
      headers.forEach((header, index) => {
        record[header.trim()] = values[index]?.trim() || '';
      });
      records.push(record);
    }
  }

  return records;
}

// ==================== CSV LINE PARSER ====================
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// ==================== PDF TEXT EXTRACTION (SIMPLIFIED) ====================
async function extractPDFText(data: ArrayBuffer): Promise<string> {
  // PDF parsing in Deno is challenging
  // For production, you would:
  // 1. Use pdf-parse with Node.js compatibility layer
  // 2. Use an external PDF parsing service
  // 3. Process PDF on client side before upload

  // For now, return placeholder
  throw new Error(
    'PDF extraction should be done client-side or with external service. ' +
    'Please convert PDF to Excel/CSV for ingestion.'
  );
}

// ==================== MAP RECORD TO CATALOG ====================
function mapToCatalogRecord(record: any, sourceId: string): {
  table: string;
  data: any;
} {
  // Detect if this is a tire or part record
  const partNumber = record['Part Number'] || record['part_number'] || record['PartNumber'] || record['รหัส'];
  const brand = record['Brand'] || record['brand'] || record['ยี่ห้อ'] || record['ผู้ผลิต'];
  const model = record['Model'] || record['model'] || record['รุ่น'];
  const size = record['Size'] || record['size'] || record['ขนาด'];

  // Check for tire-specific fields
  if (size && (size.includes('/') || size.includes('R') || size.includes('-'))) {
    // Likely a tire
    return {
      table: 'tires_catalog',
      data: {
        part_number: partNumber || `${brand}-${model}-${size}`,
        brand: brand || 'Unknown',
        model: model || 'Unknown',
        size: size,
        width: parseInt(size.split('/')[0]) || null,
        aspect_ratio: parseInt(size.split('/')[1]?.split('R')[0]) || null,
        rim_diameter: parseInt(size.split('R')[1]) || null,
        tire_type: record['Type'] || record['type'] || 'all-season',
        vehicle_type: record['Vehicle'] || record['vehicle'] || 'sedan',
        price: parseFloat(record['Price'] || record['price'] || record['ราคา']?.replace(/[^\d.]/g, '')) || null,
        stock_quantity: parseInt(record['Stock'] || record['stock'] || record['สต็อก'] || '0'),
        source_id: sourceId,
      },
    };
  }

  // Regular part
  const nameTh = record['Name TH'] || record['name_th'] || record['ชื่อไทย'];
  const nameEn = record['Name EN'] || record['name_en'] || record['ชื่ออังกฤษ'] || record['Name'];
  const category = record['Category'] || record['category'] || record['หมวดหมู่'];

  return {
    table: 'parts_catalog',
    data: {
      part_number: partNumber || `PART-${Date.now()}`,
      oem_number: record['OEM'] || record['oem'] || record['OEM Number'],
      part_name_th: nameTh || nameEn,
      part_name_en: nameEn || nameTh,
      brand: brand,
      category: category,
      subcategory: record['Subcategory'] || record['subcategory'],
      description: record['Description'] || record['description'] || record['รายละเอียด'],
      price: parseFloat(record['Price'] || record['price'] || record['ราคา']?.replace(/[^\d.]/g, '')) || null,
      stock_quantity: parseInt(record['Stock'] || record['stock'] || record['สต็อก'] || '0'),
      specifications: record['Specs'] || record['specs'] ? { raw: record['Specs'] } : {},
      source_id: sourceId,
    },
  };
}

// ==================== VALIDATE RECORD ====================
function validateRecord(record: any, table: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (table === 'parts_catalog') {
    if (!record.part_number || record.part_number.trim() === '') {
      errors.push('Part number is required');
    }
    if (!record.part_name_th && !record.part_name_en) {
      errors.push('Part name (TH or EN) is required');
    }
  } else if (table === 'tires_catalog') {
    if (!record.part_number || record.part_number.trim() === '') {
      errors.push('Part number is required');
    }
    if (!record.brand || record.brand.trim() === '') {
      errors.push('Brand is required');
    }
    if (!record.size || record.size.trim() === '') {
      errors.push('Size is required');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ==================== IMPORT RECORDS TO DATABASE ====================
async function importRecords(
  jobId: string,
  records: any[],
  sourceId: string,
  batchSize: number = 50
): Promise<{ successful: number; failed: number }> {
  let successful = 0;
  let failed = 0;
  const total = records.length;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    for (const rawRecord of batch) {
      try {
        // Map to catalog structure
        const { table, data } = mapToCatalogRecord(rawRecord, sourceId);

        // Validate
        const validation = validateRecord(data, table);

        if (!validation.valid) {
          // Add to validation queue
          await supabase.from('validation_queue').insert({
            table_name: table,
            proposed_data: data,
            severity: 'medium',
            status: 'pending',
            validation_errors: { errors: validation.errors },
          });

          failed++;
          await logIngestionMessage(jobId, 'warn', `Record validation failed: ${validation.errors.join(', ')}`);
          continue;
        }

        // Check for duplicates
        const { data: existing } = await supabase
          .from(table)
          .select('id')
          .eq('part_number', data.part_number)
          .single();

        if (existing) {
          // Update existing
          await supabase
            .from(table)
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          // Insert new
          await supabase.from(table).insert(data);
        }

        successful++;

      } catch (error) {
        failed++;
        await logIngestionMessage(jobId, 'error', `Failed to import record: ${error.message}`, { record: rawRecord });
      }
    }

    // Update progress
    const progress = Math.round(((i + batch.length) / total) * 100);
    await updateJobProgress(
      jobId,
      'importing',
      Math.min(progress, 90),
      `Imported ${successful}/${total} records`
    );
  }

  return { successful, failed };
}

// ==================== TRIGGER EMBEDDING ====================
async function triggerEmbedding(sourceId: string): Promise<void> {
  try {
    await supabase.functions.invoke('jetsetgo-embed', {
      body: {
        batch: true,
        recordId: sourceId,
      },
    });
  } catch (error) {
    console.error('Failed to trigger embedding:', error);
  }
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
    const { sourceId, autoEmbed = true, batchSize = 50 }: IngestRequest = await req.json();

    if (!sourceId) {
      throw new Error('sourceId is required');
    }

    // Create ingestion job
    const { data: job, error: jobError } = await supabase
      .from('ingestion_jobs')
      .insert({
        source_id: sourceId,
        status: 'running',
        stage: 'uploaded',
        progress: 0,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    const jobId = job.id;

    // Start ingestion asynchronously
    (async () => {
      try {
        await logIngestionMessage(jobId, 'info', 'Ingestion started', { sourceId });

        // Update stage
        await updateJobProgress(jobId, 'downloading', 5, 'Downloading file...');

        // Download file
        const { data, type, name } = await downloadFile(sourceId);
        await logIngestionMessage(jobId, 'info', `File downloaded: ${name} (${type})`);

        // Update stage
        await updateJobProgress(jobId, 'extracting', 10, 'Extracting data...');

        let records: any[] = [];

        // Extract data based on type
        if (type === 'excel' || type === 'csv') {
          records = await parseExcel(data);
          await logIngestionMessage(jobId, 'info', `Extracted ${records.length} records`);
        } else if (type === 'pdf') {
          const text = await extractPDFText(data);
          await logIngestionMessage(jobId, 'warn', 'PDF extraction requires additional processing');
          await updateJobProgress(jobId, 'completed', 100, 'PDF processing not yet supported');
          return;
        } else {
          throw new Error(`Unsupported file type: ${type}`);
        }

        if (records.length === 0) {
          throw new Error('No records found in file');
        }

        // Update stage
        await updateJobProgress(jobId, 'validating', 20, `Validating ${records.length} records...`);

        // Import records
        const { successful, failed } = await importRecords(jobId, records, sourceId, batchSize);

        // Update stage
        await updateJobProgress(jobId, 'completed', 100, `Completed: ${successful} imported, ${failed} failed`);

        // Update job as completed
        await supabase
          .from('ingestion_jobs')
          .update({
            status: 'completed',
            stage: 'completed',
            progress: 100,
            completed_at: new Date().toISOString(),
            records_processed: records.length,
            records_successful: successful,
            records_failed: failed,
          })
          .eq('id', jobId);

        await logIngestionMessage(jobId, 'info', `Ingestion completed: ${successful} successful, ${failed} failed`);

        // Update source
        await supabase
          .from('catalog_sources')
          .update({
            status: 'completed',
            total_records: records.length,
            processed_records: successful,
            failed_records: failed,
          })
          .eq('id', sourceId);

        // Trigger embedding generation
        if (autoEmbed && successful > 0) {
          await logIngestionMessage(jobId, 'info', 'Triggering embedding generation...');
          await triggerEmbedding(sourceId);
        }

      } catch (error) {
        console.error('Ingestion error:', error);

        await updateJobProgress(jobId, 'failed', 0, `Failed: ${error.message}`, error.message);

        await supabase
          .from('ingestion_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);

        await logIngestionMessage(jobId, 'error', `Ingestion failed: ${error.message}`);

        await supabase
          .from('catalog_sources')
          .update({ status: 'failed' })
          .eq('id', sourceId);
      }
    })();

    // Return job ID immediately
    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        status: 'started',
      } as IngestResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Ingestion error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      } as IngestResponse),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
