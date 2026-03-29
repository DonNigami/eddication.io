/**
 * JETSETGO - Deployment Check Script (Node.js)
 * Validates deployment readiness and generates deployment instructions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://icgtllieipahixesllux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZ3RsbGllaXBhaGl4ZXNsbHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MTczNjEsImV4cCI6MjA4NjI5MzM2MX0._9U_u91RaJ3B6k5iPxI0AKUL8DZ8m5zmpi9hJQAyX1U';

const MIGRATIONS_DIR = './supabase/migrations';
const FUNCTIONS_DIR = './supabase/functions';

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

async function checkMigrations() {
  console.log('\n📁 Checking Migration Files...\n');

  let allExist = true;

  for (const migration of MIGRATIONS) {
    const filePath = path.join(__dirname, MIGRATIONS_DIR, migration);

    try {
      const stats = await fs.promises.stat(filePath);
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   ✅ ${migration} (${size} KB)`);
    } catch {
      console.log(`   ❌ ${migration} - NOT FOUND`);
      allExist = false;
    }
  }

  return allExist;
}

async function checkFunctions() {
  console.log('\n🔧 Checking Edge Function Files...\n');

  let allExist = true;

  for (const funcName of FUNCTIONS) {
    const filePath = path.join(__dirname, FUNCTIONS_DIR, funcName, 'index.ts');

    try {
      const stats = await fs.promises.stat(filePath);
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   ✅ ${funcName}/index.ts (${size} KB)`);
    } catch {
      console.log(`   ❌ ${funcName}/index.ts - NOT FOUND`);
      allExist = false;
    }
  }

  return allExist;
}

async function checkSharedFiles() {
  console.log('\n📦 Checking Shared Utils...\n');

  const sharedFiles = [
    'shared/config.ts',
    'shared/supabase-client.ts',
    'shared/utils/thai-normalizer.ts',
    'shared/utils/ocr-tesseract.ts',
    'shared/utils/embedding-local.ts',
    'shared/utils/llm-groq.ts'
  ];

  let allExist = true;

  for (const file of sharedFiles) {
    const filePath = path.join(__dirname, file);

    try {
      await fs.promises.access(filePath);
      console.log(`   ✅ ${file}`);
    } catch {
      console.log(`   ❌ ${file} - NOT FOUND`);
      allExist = false;
    }
  }

  return allExist;
}

async function checkAgentFiles() {
  console.log('\n🤖 Checking Agent Files...\n');

  const agentFiles = [
    'shared/agents/agent-types.ts',
    'shared/agents/orchestrator-agent.ts',
    'shared/agents/search-agent.ts',
    'shared/agents/compatibility-agent.ts',
    'shared/agents/recommendation-agent.ts',
    'shared/agents/price-advisor-agent.ts',
    'shared/agents/conversation-agent.ts'
  ];

  let allExist = true;

  for (const file of agentFiles) {
    const filePath = path.join(__dirname, file);

    try {
      await fs.promises.access(filePath);
      console.log(`   ✅ ${file}`);
    } catch {
      console.log(`   ❌ ${file} - NOT FOUND`);
      allExist = false;
    }
  }

  return allExist;
}

async function testSupabaseConnection() {
  console.log('\n🔍 Testing Supabase Connection...\n');

  const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZ3RsbGllaXBhaGl4ZXNsbHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxNzM2MSwiZXhwIjoyMDg2MjkzMzYxfQ.LL5kqv1WNQTLQewvFfZHYmRR8AmueKBG0NqMFliLwE';

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log('   ✅ Connection successful');
      return true;
    } else {
      console.log(`   ❌ Connection failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Connection error: ${error.message}`);
    return false;
  }
}

async function countLines() {
  console.log('\n📊 Code Statistics...\n');

  let totalLines = 0;
  let totalCount = 0;

  // Count migration lines
  for (const migration of MIGRATIONS) {
    const filePath = path.join(__dirname, MIGRATIONS_DIR, migration);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n').length;
      totalLines += lines;
      totalCount++;
    } catch {}
  }

  // Count function lines
  for (const funcName of FUNCTIONS) {
    const filePath = path.join(__dirname, FUNCTIONS_DIR, funcName, 'index.ts');
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n').length;
      totalLines += lines;
      totalCount++;
    } catch {}
  }

  console.log(`   Total lines: ${totalLines} across ${totalCount} files`);
}

async function generateDeploymentScript() {
  console.log('\n📝 Generating Deployment Instructions...\n');

  const instructions = `
╔══════════════════════════════════════════════════════════════════════════╗
║                  JETSETGO - Deployment Instructions                                 ║
╚══════════════════════════════════════════════════════════════════════════╝

📋 STEP 1: Apply Database Migrations
─────────────────────────────────────────────────────────────────────────

Go to: https://supabase.com/dashboard/project/icgtllieipahixesllux/sql/new

Copy and paste each migration file in order:
`;

  for (const migration of MIGRATIONS) {
    instructions += `\n  ${migration}`;
  }

  instructions += `

─────────────────────────────────────────────────────────────────────────

📋 STEP 2: Deploy Edge Functions
─────────────────────────────────────────────────────────────────────────

Open terminal in JETSETGO directory and run:

`;

  for (const funcName of FUNCTIONS) {
    instructions += `\n  supabase functions deploy ${funcName}`;
  }

  instructions += `

Or deploy all at once:
  supabase functions deploy --project-ref icgtllieipahixesllux

─────────────────────────────────────────────────────────────────────────

📋 STEP 3: Configure Environment Variables
─────────────────────────────────────────────────────────────────────────

Go to: https://supabase.com/dashboard/project/icgtllieipahiesllux/functions

For each function, add environment variables:

Common (all functions):
  - SUPABASE_URL
  - SUPABASE_ANON_KEY

jetsetgo-embed:
  - HUGGINGFACE_API_KEY (optional)

jetsetgo-rag-query, jetsetgo-agent:
  - GROQ_API_KEY

jetsetgo-line-webhook:
  - LINE_CHANNEL_ACCESS_TOKEN
  - LINE_CHANNEL_SECRET

─────────────────────────────────────────────────────────────────────────

📋 STEP 4: Set Up LINE Webhook
─────────────────────────────────────────────────────────────────────────

1. Go to: https://developers.line.biz/
2. Select your Channel → Messaging API → Webhook
3. Set Webhook URL to:
   https://icgtllieipahixesllux.supabase.co/functions/v1/jetsetgo-line-webhook
4. Verify with your LINE Channel Secret

─────────────────────────────────────────────────────────────────────────

📋 STEP 5: Create Storage Buckets
─────────────────────────────────────────────────────────────────────────

Go to: https://supabase.com/dashboard/project/icgtllieipahixesllux/storage

Create these buckets:

  1. catalog-uploads (Public: No)
  2. ocr-images (Public: No)
  3. product-images (Public: Yes)

─────────────────────────────────────────────────────────────────────────

✅ VERIFICATION
─────────────────────────────────────────────────────────────────────────

Test the deployment:

curl -X POST \\
  https://icgtllieipahixesllux.supabase.co/functions/v1/jetsetgo-agent \\
  -H "Content-Type: application/json" \\
  -d '{"query":"ยาง Michelin","sessionId":"test-001"}'

Expected response:
{
  "success": true,
  "message": "🔍 พบ...",
  "intent": "search"
}

╔══════════════════════════════════════════════════════════════════════════╝
`;

  console.log(instructions);
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║             JETSETGO - Deployment Check                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log(`Project: ${SUPABASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');

  const checks = await Promise.all([
    checkMigrations(),
    checkFunctions(),
    checkSharedFiles(),
    checkAgentFiles(),
    testSupabaseConnection()
  ]);

  await countLines();

  const allPassed = checks.every(Boolean);

  console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                        Deployment Readiness                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');

  if (allPassed) {
    console.log('\n   ✅ ALL CHECKS PASSED - Ready for deployment!\n');
  } else {
    console.log('\n   ⚠️  Some checks failed - Please review above\n');
  }

  await generateDeploymentScript();
}

main().catch(console.error);
