/**
 * JETSETGO - Automated Deployment Helper
 * Generates SQL commands and deployment scripts for manual execution
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://icgtllieipahixesllux.supabase.co';
const PROJECT_REF = 'icgtllieipahixesllux';

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
 * Read migration file content
 */
async function readMigrationContent(filename) {
  const filePath = path.join(__dirname, 'supabase/migrations', filename);
  return await fs.promises.readFile(filePath, 'utf-8');
}

/**
 * Generate combined SQL for all migrations
 */
async function generateCombinedSQL() {
  console.log('\n📝 Generating Combined Migration SQL...\n');

  let combinedSQL = '-- JETSETGO - Combined Database Migrations\n';
  combinedSQL += `-- Generated: ${new Date().toISOString()}\n`;
  combinedSQL += `-- Project: ${SUPABASE_URL}\n\n`;
  combinedSQL += '-- ========================================\n';
  combinedSQL += '-- IMPORTANT: Run each migration separately!\n';
  combinedSQL += '-- ========================================\n\n';

  for (const migration of MIGRATIONS) {
    const content = await readMigrationContent(migration);
    const lines = content.split('\n').length;

    combinedSQL += `-- ${migration} (${lines} lines)\n`;
    combinedSQL += '-- '.repeat(40) + '\n';
    combinedSQL += content.trim();
    combinedSQL += '\n\n';

    // Add separator between migrations
    combinedSQL += '\n-- ========================================\n';
    combinedSQL += `-- END OF ${migration}\n`;
    combinedSQL += '-- ========================================\n\n\n';
  }

  // Write to file
  const outputPath = path.join(__dirname, 'deploy-combined-migrations.sql');
  await fs.promises.writeFile(outputPath, combinedSQL);
  console.log(`   ✅ Combined SQL written to: deploy-combined-migrations.sql`);
  console.log(`   📊 Total size: ${(combinedSQL.length / 1024).toFixed(1)} KB`);

  return outputPath;
}

/**
 * Generate deployment bash script
 */
async function generateDeploymentScript() {
  console.log('\n📜 Generating Deployment Scripts...\n');

  // Bash script for Linux/Mac
  const bashScript = `#!/bin/bash
# JETSETGO - Automated Deployment Script
# Generated: ${new Date().toISOString()}

set -e  # Exit on error

SUPABASE_URL="${SUPABASE_URL}"
PROJECT_REF="${PROJECT_REF}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           JETSETGO - Automated Deployment                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Project: $SUPABASE_URL"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "   Install: npm install -g supabase"
    exit 1
fi

# Check if logged in
echo "🔍 Checking Supabase login status..."
if ! supabase projects list &> /dev/null; then
    echo "   Please login to Supabase:"
    supabase login
fi

echo "   ✅ Logged in"
echo ""

# Link project
echo "🔗 Linking to project..."
supabase link --project-ref $PROJECT_REF
echo "   ✅ Linked"
echo ""

# Deploy functions
echo "🚀 Deploying Edge Functions..."
echo ""

${FUNCTIONS.map(f => `
echo "   Deploying: ${f}"
supabase functions deploy ${f}
echo "   ✅ ${f} deployed"
echo ""`).join('')}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Deployment Complete!                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Next Steps:"
echo "  1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo "  2. Run migrations from: deploy-combined-migrations.sql"
echo "  3. Configure environment variables in Dashboard → Edge Functions"
echo "  4. Set LINE webhook to: $SUPABASE_URL/functions/v1/jetsetgo-line-webhook"
echo ""
`;

  const bashPath = path.join(__dirname, 'deploy.sh');
  await fs.promises.writeFile(bashPath, bashScript, { mode: 0o755 });
  console.log(`   ✅ Bash script: deploy.sh`);

  // Windows batch script
  const batchScript = `@echo off
REM JETSETGO - Automated Deployment Script for Windows
REM Generated: ${new Date().toISOString()}

set SUPABASE_URL=${SUPABASE_URL}
set PROJECT_REF=${PROJECT_REF}

echo ╔══════════════════════════════════════════════════════════════╗
echo ║           JETSETGO - Automated Deployment                    ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Project: %SUPABASE_URL%
echo.

REM Check if supabase CLI is installed
where supabase >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Supabase CLI not found!
    echo    Install: npm install -g supabase
    exit /b 1
)

echo 🔍 Checking Supabase login status...
supabase projects list >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo    Please login to Supabase:
    supabase login
)

echo    ✅ Logged in
echo.

echo 🔗 Linking to project...
supabase link --project-ref %PROJECT_REF%
echo    ✅ Linked
echo.

echo 🚀 Deploying Edge Functions...
echo.
${FUNCTIONS.map(f => `
echo    Deploying: ${f}
supabase functions deploy ${f}
echo    ✅ ${f} deployed
echo.`).join('\r\n\r\n')}
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    Deployment Complete!                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Next Steps:
echo   1. Go to: https://supabase.com/dashboard/project/%PROJECT_REF%/sql/new
echo   2. Run migrations from: deploy-combined-migrations.sql
echo   3. Configure environment variables in Dashboard -^> Edge Functions
echo   4. Set LINE webhook to: %SUPABASE_URL%/functions/v1/jetsetgo-line-webhook
echo.
pause
`;

  const batchPath = path.join(__dirname, 'deploy.bat');
  await fs.promises.writeFile(batchPath, batchScript);
  console.log(`   ✅ Windows batch script: deploy.bat`);

  return { bashPath, batchPath };
}

/**
 * Generate PowerShell script for Windows
 */
async function generatePowerShellScript() {
  console.log('\n⚡ Generating PowerShell Deployment Script...\n');

  // Use string concatenation to avoid backtick issues
  let script = '# JETSETGO - PowerShell Deployment Script\r\n';
  script += '# Generated: ' + new Date().toISOString() + '\r\n\r\n';
  script += '$ErrorActionPreference = "Stop"\r\n\r\n';
  script += '$SUPABASE_URL = "' + SUPABASE_URL + '"\r\n';
  script += '$PROJECT_REF = "' + PROJECT_REF + '"\r\n\r\n';
  script += 'Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan\r\n';
  script += 'Write-Host "║           JETSETGO - Automated Deployment                    ║" -ForegroundColor Cyan\r\n';
  script += 'Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan\r\n';
  script += 'Write-Host ""\r\n';
  script += 'Write-Host "Project: $SUPABASE_URL"\r\n';
  script += 'Write-Host ""\r\n\r\n';

  // Check CLI
  script += '# Check if supabase CLI is installed\r\n';
  script += 'Write-Host "🔍 Checking Supabase CLI..." -ForegroundColor Yellow\r\n';
  script += 'try {\r\n';
  script += '    $null = supabase --version\r\n';
  script += '} catch {\r\n';
  script += '    Write-Host "   ❌ Supabase CLI not found!" -ForegroundColor Red\r\n';
  script += '    Write-Host "   Install: npm install -g supabase" -ForegroundColor Yellow\r\n';
  script += '    exit 1\r\n';
  script += '}\r\n';
  script += 'Write-Host "   ✅ Supabase CLI found" -ForegroundColor Green\r\n';
  script += 'Write-Host ""\r\n\r\n';

  // Check login
  script += '# Check login status\r\n';
  script += 'Write-Host "🔍 Checking login status..." -ForegroundColor Yellow\r\n';
  script += '$loginCheck = supabase projects list 2>&1\r\n';
  script += 'if ($LASTEXITCODE -ne 0) {\r\n';
  script += '    Write-Host "   Please login:" -ForegroundColor Yellow\r\n';
  script += '    supabase login\r\n';
  script += '}\r\n';
  script += 'Write-Host "   ✅ Logged in" -ForegroundColor Green\r\n';
  script += 'Write-Host ""\r\n\r\n';

  // Link project
  script += '# Link project\r\n';
  script += 'Write-Host "🔗 Linking to project..." -ForegroundColor Yellow\r\n';
  script += 'supabase link --project-ref $PROJECT_REF\r\n';
  script += 'Write-Host "   ✅ Linked" -ForegroundColor Green\r\n';
  script += 'Write-Host ""\r\n\r\n';

  // Deploy functions
  script += '# Deploy functions\r\n';
  script += 'Write-Host "🚀 Deploying Edge Functions..." -ForegroundColor Yellow\r\n';
  script += 'Write-Host ""\r\n\r\n';

  script += '$functions = @(\r\n';
  FUNCTIONS.forEach((f, i) => {
    script += '    "' + f + '"' + (i < FUNCTIONS.length - 1 ? ',\n' : '\n');
  });
  script += ')\r\n\r\n';

  script += 'foreach ($func in $functions) {\r\n';
  script += '    Write-Host "   Deploying: $func" -ForegroundColor Cyan\r\n';
  script += '    supabase functions deploy $func\r\n';
  script += '    if ($LASTEXITCODE -eq 0) {\r\n';
  script += '        Write-Host "   ✅ $func deployed" -ForegroundColor Green\r\n';
  script += '    } else {\r\n';
  script += '        Write-Host "   ❌ Failed to deploy $func" -ForegroundColor Red\r\n';
  script += '    }\r\n';
  script += '    Write-Host ""\r\n';
  script += '}\r\n\r\n';

  // Complete message
  script += 'Write-Host ""\r\n';
  script += 'Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan\r\n';
  script += 'Write-Host "║                    Deployment Complete!                      ║" -ForegroundColor Green\r\n';
  script += 'Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan\r\n';
  script += 'Write-Host ""\r\n';
  script += 'Write-Host "Next Steps:" -ForegroundColor Yellow\r\n';
  script += 'Write-Host "  1. SQL Editor: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"\r\n';
  script += 'Write-Host "  2. Run: deploy-combined-migrations.sql"\r\n';
  script += 'Write-Host "  3. Configure env vars in Dashboard → Edge Functions"\r\n';
  script += 'Write-Host "  4. LINE Webhook: $SUPABASE_URL/functions/v1/jetsetgo-line-webhook"\r\n';
  script += 'Write-Host ""\r\n';

  // Test deployment
  script += '$test = Read-Host "Test deployment now? (y/n)"\r\n';
  script += 'if ($test -eq "y") {\r\n';
  script += '    Write-Host ""\r\n';
  script += '    Write-Host "Testing agent endpoint..." -ForegroundColor Yellow\r\n';
  script += '    $body = @{\r\n';
  script += '        query = "ยาง Michelin"\r\n';
  script += '        sessionId = "test-deploy"\r\n';
  script += '    } | ConvertTo-Json\r\n\r\n';
  script += '    $params = @{\r\n';
  script += '        Uri = "$SUPABASE_URL/functions/v1/jetsetgo-agent"\r\n';
  script += '        Method = "POST"\r\n';
  script += '        ContentType = "application/json"\r\n';
  script += '        Body = $body\r\n';
  script += '    }\r\n\r\n';
  script += '    $response = Invoke-RestMethod @params\r\n\r\n';
  script += '    Write-Host "Response:" -ForegroundColor Green\r\n';
  script += '    Write-Host ($response | ConvertTo-Json -Depth 3)\r\n';
  script += '}\r\n\r\n';
  script += 'Write-Host ""\r\n';
  script += 'Write-Host "Press any key to exit..."\r\n';
  script += '$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")\r\n';

  const psPath = path.join(__dirname, 'deploy.ps1');
  await fs.promises.writeFile(psPath, script);
  console.log(`   ✅ PowerShell script: deploy.ps1`);

  return psPath;
}

/**
 * Generate curl test scripts
 */
async function generateTestScripts() {
  console.log('\n🧪 Generating Test Scripts...\n');

  // Bash test script
  const bashTests = `#!/bin/bash
# JETSETGO - Deployment Test Scripts
# Run these to verify deployment

SUPABASE_URL="${SUPABASE_URL}"

echo "Testing JETSETGO Deployment..."
echo ""

echo "1. Testing Agent Orchestrator..."
curl -X POST \\
  "$SUPABASE_URL/functions/v1/jetsetgo-agent" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"ยาง Michelin","sessionId":"test-001"}' \\
  | jq .

echo ""
echo "2. Testing RAG Query..."
curl -X POST \\
  "$SUPABASE_URL/functions/v1/jetsetgo-rag-query" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"น้ำมันเครื่อง","sessionId":"test-002"}' \\
  | jq .

echo ""
echo "3. Testing Embedding..."
curl -X POST \\
  "$SUPABASE_URL/functions/v1/jetsetgo-embed" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"ยางรถยนต์ขนาด 205/55R16"}' \\
  | jq .

echo ""
echo "✅ Tests complete!"
`;

  const testBashPath = path.join(__dirname, 'test-deployment.sh');
  await fs.promises.writeFile(testBashPath, bashTests, { mode: 0o755 });
  console.log(`   ✅ Bash test script: test-deployment.sh`);

  // Windows test script
  const testBatch = `@echo off
REM JETSETGO - Deployment Test Scripts (Windows)

set SUPABASE_URL=${SUPABASE_URL}

echo Testing JETSETGO Deployment...
echo.

echo 1. Testing Agent Orchestrator...
curl -X POST "%SUPABASE_URL%/functions/v1/jetsetgo-agent" -H "Content-Type: application/json" -d "{\\"query\\":\\"ยาง Michelin\\",\\"sessionId\\":\\"test-001\\"}"
echo.

echo 2. Testing RAG Query...
curl -X POST "%SUPABASE_URL%/functions/v1/jetsetgo-rag-query" -H "Content-Type: application/json" -d "{\\"query\\":\\"น้ำมันเครื่อง\\",\\"sessionId\\":\\"test-002\\"}"
echo.

echo 3. Testing Embedding...
curl -X POST "%SUPABASE_URL%/functions/v1/jetsetgo-embed" -H "Content-Type: application/json" -d "{\\"text\\":\\"ยางรถยนต์ขนาด 205/55R16\\"}"
echo.

echo.
echo ✅ Tests complete!
pause
`;

  const testBatchPath = path.join(__dirname, 'test-deployment.bat');
  await fs.promises.writeFile(testBatchPath, testBatch);
  console.log(`   ✅ Windows test script: test-deployment.bat`);
}

/**
 * Generate environment variables template
 */
async function generateEnvTemplate() {
  console.log('\n🔐 Generating Environment Variables Template...\n');

  const template = `# JETSETGO Environment Variables
# Configure these in Supabase Dashboard -> Edge Functions -> Settings

# ===========================================
# COMMON (All Functions)
# ===========================================
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZ3RsbGllaXBhaGl4ZXNsbHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MTczNjEsImV4cCI6MjA4NjI5MzM2MX0._9U_u91RaJ3B6k5iPxI0AKUL8DZ8m5zmpi9hJQAyX1U

# ===========================================
# FUNCTION-SPECIFIC
# ===========================================

# jetsetgo-embed
HUGGINGFACE_API_KEY=your_huggingface_key_here

# jetsetgo-rag-query, jetsetgo-agent
GROQ_API_KEY=your_groq_api_key_here

# jetsetgo-line-webhook
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# ===========================================
# OPTIONAL
# ===========================================

# AI Model Selection (default: llama3-70b-8192)
GROQ_MODEL=llama3-70b-8192

# Embedding Model (default: multilingual-e5-large)
EMBEDDING_MODEL=multilingual-e5-large

# OCR Provider (default: tesseract)
OCR_PROVIDER=tesseract
# or set to: google-vision, aws-textract

# Debug Mode (default: false)
DEBUG=false
`;

  const envPath = path.join(__dirname, '.env.production');
  await fs.promises.writeFile(envPath, template);
  console.log(`   ✅ Environment template: .env.production`);

  return envPath;
}

/**
 * Main execution
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     JETSETGO - Deployment Automation Generator             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nProject: ${SUPABASE_URL}`);
  console.log(`Generated: ${new Date().toISOString()}`);

  try {
    // 1. Generate combined SQL
    await generateCombinedSQL();

    // 2. Generate deployment scripts
    await generateDeploymentScript();

    // 3. Generate PowerShell script
    await generatePowerShellScript();

    // 4. Generate test scripts
    await generateTestScripts();

    // 5. Generate env template
    await generateEnvTemplate();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              Deployment Files Generated!                   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    console.log(`
📁 Files Created:

   SQL:
   └─ deploy-combined-migrations.sql    (All migrations combined)

   Deployment Scripts:
   ├─ deploy.sh                         (Linux/Mac - Bash)
   ├─ deploy.bat                        (Windows - Batch)
   └─ deploy.ps1                        (Windows - PowerShell)

   Test Scripts:
   ├─ test-deployment.sh                (Linux/Mac)
   └─ test-deployment.bat               (Windows)

   Configuration:
   └─ .env.production                   (Environment variables template)

🚀 Quick Start:

   Windows (PowerShell - Recommended):
   └─ .\\deploy.ps1

   Windows (Command Prompt):
   └─ deploy.bat

   Linux/Mac:
   └─ chmod +x deploy.sh && ./deploy.sh

📋 Manual Steps (After Running Script):

   1. SQL Editor: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new
      → Copy paste from deploy-combined-migrations.sql (run each section separately)

   2. Environment Variables: https://supabase.com/dashboard/project/${PROJECT_REF}/functions
      → Add variables from .env.production

   3. Storage: https://supabase.com/dashboard/project/${PROJECT_REF}/storage
      → Create buckets: catalog-uploads, ocr-images, product-images

   4. LINE Webhook: https://developers.line.biz/
      → Set URL to: ${SUPABASE_URL}/functions/v1/jetsetgo-line-webhook

`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
