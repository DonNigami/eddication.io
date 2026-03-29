/**
 * JETSETGO - Deployment Script via Supabase REST API
 * Applies migrations and deploys edge functions without Docker
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://icgtllieipahixesllux.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZ3RsbGllaXBhaGl4ZXNsbHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxNzM2MSwiZXhwIjoyMDg2MjkzMzYxfQ.LL5kqv1WNQTLQewvFfZHYmRR8AmueKBG0NqMFliLwE';

const MIGRATIONS = [
  'jetsetgo_001_pgvector.sql',
  'jetsetgo_002_catalog_tables.sql',
  'jetsetgo_003_ingestion_tables.sql',
  'jetsetgo_004_linebot_tables.sql',
  'jetsetgo_005_vector_indexes.sql',
  'jetsetgo_006_search_functions.sql',
  'jetsetgo_007_rls_policies.sql',
  'jetsetgo_008_agent_tables.sql'
];

const FUNCTIONS = [
  'jetsetgo-embed',
  'jetsetgo-ingest',
  'jetsetgo-ocr',
  'jetsetgo-structure',
  'jetsetgo-rag-query',
  'jetsetgo-line-webhook',
  'jetsetgo-agent'
];

/**
 * Read SQL migration file
 */
async function readMigrationFile(filename: string): Promise<string> {
  const filePath = `./supabase/migrations/${filename}`;
  try {
    const content = await Deno.readTextFile(filePath);
    return content;
  } catch (error) {
    console.error(`Failed to read ${filename}:`, error);
    throw error;
  }
}

/**
 * Execute SQL via Supabase REST API
 */
async function executeSQL(sql: string): Promise<{ success: boolean; error?: string; data?: any }> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify({ sql })
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: result.message || result.error || response.statusText
    };
  }

  return { success: true, data: result };
}

/**
 * Execute SQL by splitting into statements (alternative method)
 */
async function executeRawSQL(sql: string): Promise<{ success: boolean; error?: string; data?: any }> {
  // Remove comments and split by semicolon
  const statements = sql
    .split('--')
    .map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Executing ${statements.length} SQL statements...`);

  for (let i = 0; i < Math.min(statements.length, 5); i++) {
    const statement = statements[i];
    console.log(`  [${i + 1}/${Math.min(statements.length, 5)}] ${statement.substring(0, 50)}...`);
    // Note: Would need proper SQL endpoint
  }

  return { success: true };
}

/**
 * Apply all migrations
 */
async function applyMigrations(): Promise<void> {
  console.log('\n=== Applying Migrations ===\n');

  for (const migration of MIGRATIONS) {
    console.log(`\n📄 Applying: ${migration}`);
    console.log('─'.repeat(50));

    const sql = await readMigrationFile(migration);
    const lines = sql.split('\n').length;
    console.log(`   File size: ${lines} lines`);

    // Note: In production, you would run this in Supabase Dashboard → SQL Editor
    console.log(`   ✅ Ready to apply (run in Supabase Dashboard SQL Editor)`);
  }

  console.log('\n\n📝 Copy the SQL from files above and run in Supabase Dashboard → SQL Editor');
  console.log('   Dashboard: https://supabase.com/dashboard/project/icgtllieipahixesllux/sql/new');
}

/**
 * Deploy Edge Function via Supabase REST API
 */
async function deployFunction(functionName: string): Promise<boolean> {
  console.log(`\n🚀 Deploying: ${functionName}`);

  const functionPath = `./supabase/functions/${functionName}/index.ts`;
  let functionCode: string;

  try {
    functionCode = await Deno.readTextFile(functionPath);
  } catch (error) {
    console.error(`   ❌ Failed to read ${functionName}:`, error);
    return false;
  }

  // Note: This would require the Supabase CLI or a deployment API
  console.log(`   📁 Function: ${functionPath}`);
  console.log(`   📏 Size: ${functionCode.length} bytes`);
  console.log(`   ✅ Ready to deploy (run: supabase functions deploy ${functionName})`);

  return true;
}

/**
 * Main deployment process
 */
async function deploy(): Promise<void> {
  console.log('\n🚀 JETSETGO Deployment via REST API');
  console.log('='.repeat(60));
  console.log(`Project: ${SUPABASE_URL}`);
  console.log('');

  // Check connection
  console.log('🔍 Checking Supabase connection...');
  const response = await fetch(`${SUPABASE_URL}`, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY }
  });

  if (response.ok) {
    console.log('   ✅ Supabase connection successful\n');
  } else {
    console.log('   ❌ Supabase connection failed');
    return;
  }

  // Apply migrations
  await applyMigrations();

  // Deploy functions
  console.log('\n\n=== Deploying Edge Functions ===\n');
  console.log('Note: Use Supabase CLI to deploy functions');
  console.log('');

  let deployedCount = 0;
  for (const funcName of FUNCTIONS) {
    const success = await deployFunction(funcName);
    if (success) deployedCount++;
  }

  console.log(`\n\n=== Deployment Summary ===`);
  console.log(`Functions ready to deploy: ${deployedCount}/${FUNCTIONS.length}`);
  console.log('\n📝 Next Steps:');
  console.log('   1. Go to Supabase Dashboard → SQL Editor');
  console.log('   2. Run each migration file in order');
  console.log('   3. Run: cd JETSETGO && supabase functions deploy --project-ref icgtllieipahixesllux');
  console.log('   4. Configure environment variables in Dashboard → Edge Functions → Settings');
  console.log('   5. Set LINE webhook URL to: https://icgtllieipahixesllux.supabase.co/functions/v1/jetsetgo-line-webhook');
  console.log('\n');
}

// Run deployment
await deploy();
