#!/usr/bin/env node

/**
 * Google Drive Quota Fix - Configuration Validator
 * 
 * Run this to verify your OAuth delegation setup is correct
 * Usage: node validate-drive-quota.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🔍 Google Drive OAuth Delegation Validator\n');
console.log('='.repeat(60));

// Check 1: GOOGLE_SHEETS_CREDENTIALS_JSON
console.log('\n✓ Check 1: Service Account Credentials');
let credentials = null;
try {
    let credsSource = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_SHEETS_KEY_FILE;

    if (!credsSource) {
        console.log('   ❌ GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEETS_KEY_FILE not set');
    } else {
        if (credsSource.startsWith('{')) {
            credentials = JSON.parse(credsSource);
            console.log('   ✅ Credentials loaded from GOOGLE_SHEETS_CREDENTIALS_JSON');
        } else if (fs.existsSync(credsSource)) {
            credentials = JSON.parse(fs.readFileSync(credsSource, 'utf-8'));
            console.log(`   ✅ Credentials loaded from ${credsSource}`);
        } else {
            console.log(`   ❌ Credentials file not found: ${credsSource}`);
        }

        if (credentials && credentials.type === 'service_account') {
            console.log(`   ✅ Valid service account: ${credentials.client_email}`);
        }
    }
} catch (err) {
    console.log(`   ❌ Error parsing credentials: ${err.message}`);
}

// Check 2: GOOGLE_IMPERSONATE_EMAIL
console.log('\n✓ Check 2: OAuth Delegation User');
const impersonateEmail = process.env.GOOGLE_IMPERSONATE_EMAIL;

if (!impersonateEmail) {
    console.log('   ❌ GOOGLE_IMPERSONATE_EMAIL not set');
    console.log('   ℹ️  This is REQUIRED for Google Drive uploads in Workspace');
} else if (impersonateEmail.includes('iam.gserviceaccount.com')) {
    console.log(`   ❌ GOOGLE_IMPERSONATE_EMAIL appears to be a service account: ${impersonateEmail}`);
    console.log('   ℹ️  Must be a REAL Workspace user (user@yourdomain.com), not service account');
} else {
    console.log(`   ✅ Workspace user set: ${impersonateEmail}`);
    console.log('   ℹ️  Verify this user:');
    console.log('       - Has active Drive quota');
    console.log('       - Is a real user (not service account)');
    console.log('       - Has permission to the parent folder (if using personal Drive)');
}

// Check 3: Service account vs impersonate
console.log('\n✓ Check 3: Service Account vs Impersonate');
if (credentials && impersonateEmail) {
    if (credentials.client_email === impersonateEmail) {
        console.log(`   ⚠️  Service account and impersonate email are the SAME`);
        console.log(`       This won't work - they must be DIFFERENT`);
        console.log(`       Service Account: ${credentials.client_email}`);
        console.log(`       Impersonate User: ${impersonateEmail}`);
    } else {
        console.log(`   ✅ Service Account and Impersonate User are different`);
        console.log(`       Service Account: ${credentials.client_email}`);
        console.log(`       Impersonate User: ${impersonateEmail}`);
    }
}

// Check 4: Parent folder
console.log('\n✓ Check 4: Upload Folder Configuration');
const parentFolderId = process.env.ALC_PARENT_FOLDER_ID;
if (!parentFolderId) {
    console.log('   ⚠️  ALC_PARENT_FOLDER_ID not set');
    console.log('   ℹ️  This is optional - files will be uploaded to root of user\'s Drive if not set');
} else {
    console.log(`   ✅ Parent folder set: ${parentFolderId}`);
    console.log('   ℹ️  Make sure the impersonate user has access to this folder');
}

// Check 5: Domain-wide delegation check
console.log('\n✓ Check 5: Domain-Wide Delegation Requirements');
if (credentials && impersonateEmail && !impersonateEmail.includes('iam.gserviceaccount.com')) {
    console.log('   📋 To enable domain-wide delegation:');
    console.log('');
    console.log('   1️⃣  Google Cloud Console:');
    console.log('      - APIs & Services → Credentials');
    console.log('      - Click on your service account');
    console.log('      - Go to Credentials tab');
    console.log(`      - Enable "Domain-wide delegation" (Client ID: ${credentials.client_id || 'XXXX...'})`);
    console.log('');
    console.log('   2️⃣  Google Workspace Admin Console:');
    console.log('      - Security → API Controls → Domain-wide Delegation');
    console.log('      - Click "Add new"');
    console.log(`      - Paste Client ID: ${credentials.client_id || 'XXXX...'}`);
    console.log('      - OAuth Scopes:');
    console.log('        https://www.googleapis.com/auth/drive,');
    console.log('        https://www.googleapis.com/auth/drive.file,');
    console.log('        https://www.googleapis.com/auth/spreadsheets');
    console.log('      - Click Authorize');
    console.log('');
    console.log('   3️⃣  Set environment variable:');
    console.log(`      GOOGLE_IMPERSONATE_EMAIL=${impersonateEmail}`);
}

// Check 6: Alternative - Shared Drives
console.log('\n✓ Check 6: Shared Drive Alternative');
console.log('   ℹ️  Instead of OAuth delegation, you can use a Shared Drive:');
console.log('      - Create a Shared Drive in Google Drive');
console.log('      - Grant service account Editor access');
console.log('      - Set ALC_PARENT_FOLDER_ID to Shared Drive folder ID');
console.log('      - Remove GOOGLE_IMPERSONATE_EMAIL');
console.log('      - Shared Drives have unlimited storage (no quota issues)');

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📝 Summary:');

const checks = {
    'Service Account Configured': credentials !== null,
    'Impersonate User Set': impersonateEmail !== undefined,
    'Impersonate is Real User': impersonateEmail && !impersonateEmail.includes('iam.gserviceaccount.com'),
    'Different Email Addresses': credentials && impersonateEmail && credentials.client_email !== impersonateEmail
};

let allPassed = true;
for (const [check, passed] of Object.entries(checks)) {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    if (!passed) allPassed = false;
}

console.log('\n' + '='.repeat(60));

if (allPassed) {
    console.log('\n✅ Configuration looks good!');
    console.log('\nNext steps:');
    console.log('1. Verify domain-wide delegation is enabled in Google Cloud Console');
    console.log('2. Verify OAuth scopes are authorized in Workspace Admin');
    console.log('3. Test with: npm run dev');
    console.log('4. Try uploading an image');
} else {
    console.log('\n⚠️  Configuration needs attention');
    console.log('\nFix the issues above and run this validator again');
}

console.log('\n📖 See DRIVE_QUOTA_FIX.md for detailed instructions\n');
