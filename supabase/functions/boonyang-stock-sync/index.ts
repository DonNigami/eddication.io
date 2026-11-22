/**
 * Boonyang stock sync — Google Sheet → Supabase (botdata, inventdata)
 *
 * Replaces the Apps Script import that deleted and re-inserted every row on each run
 * (~17,500 row writes/day, which exhausted the project's disk IO budget). This function
 * diffs the sheet against the table and writes ONLY the rows that changed.
 *
 * The data has no unique key (3,131 botdata rows, 212 item codes, 1,664 code+lot pairs),
 * so the diff treats each table as a multiset of rows rather than upserting by key.
 *
 * Sheet access (both supported, no code change to switch):
 *   - GOOGLE_SA_JSON set  → private sheet via a Google service account (Sheets API v4)
 *   - otherwise           → public "anyone with the link" sheet via the /export?format=csv endpoint
 *
 * Triggers (both supported):
 *   - pg_cron schedule (see migration 20261122130000_boonyang_stock_sync_cron.sql)
 *   - the "Import" menu in the Apps Script, which now calls this URL instead of rewriting tables
 *
 * Request: POST, header `x-sync-secret: <SYNC_SECRET>`
 *   ?dry=1    → compute and return the diff without writing
 *   ?force=1  → bypass the "sheet shrank too much" safety guard
 *   ?table=botdata|inventdata → sync one table only
 *
 * Deploy: supabase functions deploy boonyang-stock-sync --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { parse as parseCsv } from 'https://deno.land/std@0.168.0/encoding/csv.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYNC_SECRET = Deno.env.get('SYNC_SECRET');
const STOCK_SHEET_ID = Deno.env.get('STOCK_SHEET_ID') || '1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8';
const GOOGLE_SA_JSON = Deno.env.get('GOOGLE_SA_JSON');

// Refuse to apply a sync that would leave fewer than this share of the current rows.
// Protects against a sheet that was emptied, renamed, or made private by mistake.
const MIN_KEEP_RATIO = 0.5;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type Row = Record<string, string | number | null>;

interface TableSpec {
  table: 'botdata' | 'inventdata';
  tab: string;
  gid: string; // tab id for the public export URL; a re-created tab gets a new gid → header check fails loudly
  headers: string[];
  columns: string[];
  toRow: (cells: string[]) => Row;
}

const blank = (v: string | undefined) => (v === undefined || v === '' ? null : v);
// Formatted values carry thousands separators ("1,250"); parseInt alone would read that as 1.
const toInt = (v: string | undefined) => {
  const n = parseInt((v ?? '').replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

// Same mapping as the old Apps Script importBotData() / importInventData().
const SPECS: TableSpec[] = [
  {
    table: 'botdata',
    tab: 'BotData',
    gid: '1297761163',
    headers: ['Code', 'รหัสสินค้า', 'ชื่อสินค้า', 'เลขที่สัปดาห์ยาง', 'ยอดสต็อก(รวมชิ้น)', 'Code2', 'Code3'],
    columns: ['item_code', 'field_unknown', 'item_name', 'lot_number', 'on_hand_quantity', 'alternative_key_1', 'alternative_key_2'],
    toRow: (c) => ({
      item_code: blank(c[0]),
      field_unknown: blank(c[1]),
      item_name: blank(c[2]),
      lot_number: blank(c[3]),
      on_hand_quantity: toInt(c[4]),
      alternative_key_1: blank(c[5]),
      alternative_key_2: blank(c[6]),
    }),
  },
  {
    table: 'inventdata',
    tab: 'InventData',
    gid: '573566949',
    headers: ['ItemName', 'Standard', 'ItemName2', 'ItemName3', 'OnhandQtyByTotalPiece'],
    columns: ['ItemName', 'Standard', 'ItemName2', 'ItemName3', 'OnhandQtyByTotalPiece'],
    toRow: (c) => ({
      ItemName: blank(c[0]),
      Standard: blank(c[1]),
      ItemName2: blank(c[2]),
      ItemName3: blank(c[3]),
      OnhandQtyByTotalPiece: toInt(c[4]),
    }),
  },
];

// ============================================
// Sheet readers
// ============================================

// The /export endpoint returns cells exactly as displayed. The gviz endpoint is NOT used on
// purpose: it infers one type per column and silently blanks minority-type cells (e.g. a lot
// "2524A" in a mostly-numeric column would arrive as "").
async function readPublicCsv(tab: string, gid: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${STOCK_SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  const type = res.headers.get('content-type') || '';
  const body = await res.text();
  // A sheet that is no longer public answers with an HTML sign-in page, not an error code.
  if (!res.ok || !type.includes('text/csv')) {
    throw new Error(`${tab}: public sheet not readable (HTTP ${res.status}, ${type}) — is it still shared "anyone with the link"?`);
  }
  return parseCsv(body) as string[][];
}

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let saTokenCache: { token: string; exp: number } | null = null;

async function getServiceAccountToken(): Promise<string> {
  if (saTokenCache && saTokenCache.exp > Date.now() + 60_000) return saTokenCache.token;

  const sa = JSON.parse(GOOGLE_SA_JSON!);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`)),
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${b64url(signature)}`,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`service account token failed: ${JSON.stringify(data)}`);
  }
  saTokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function readPrivateSheet(tab: string, width: number): Promise<string[][]> {
  const token = await getServiceAccountToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${STOCK_SHEET_ID}/values/${encodeURIComponent(tab)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`${tab}: Sheets API ${res.status} ${JSON.stringify(data.error ?? data)}`);
  // The Sheets API drops trailing empty cells; pad so column positions stay aligned.
  return ((data.values ?? []) as string[][]).map((r) => {
    const row = r.map((v) => String(v ?? ''));
    while (row.length < width) row.push('');
    return row;
  });
}

// ============================================
// Diff + apply
// ============================================

async function fetchAllRows(spec: TableSpec): Promise<Array<Row & { id: number }>> {
  const select = ['id', ...spec.columns.map((c) => (/[A-Z]/.test(c) ? `"${c}"` : c))].join(',');
  const all: Array<Row & { id: number }> = [];
  // PostgREST caps each response (max-rows). Stop only on an EMPTY page: stopping on a short page
  // would silently truncate if max-rows were ever set below the page size, and every unseen row
  // would then be re-inserted on each run.
  const page = 1000;
  for (let from = 0; ; ) {
    const { data, error } = await supabase
      .from(spec.table)
      .select(select)
      .order('id', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(`${spec.table}: read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as Array<Row & { id: number }>));
    from += data.length;
  }
  return all;
}

const keyOf = (row: Row, columns: string[]) => JSON.stringify(columns.map((c) => row[c] ?? null));

async function syncTable(spec: TableSpec, opts: { dry: boolean; force: boolean }) {
  const raw = GOOGLE_SA_JSON
    ? await readPrivateSheet(spec.tab, spec.headers.length)
    : await readPublicCsv(spec.tab, spec.gid);

  const [header = [], ...body] = raw;
  const got = header.slice(0, spec.headers.length).map((h) => h.trim());
  if (got.join('|') !== spec.headers.join('|')) {
    throw new Error(`${spec.tab}: unexpected header [${got.join(', ')}] — expected [${spec.headers.join(', ')}]`);
  }

  // Skip fully empty rows: the old import pulled formatted-but-blank rows past the data
  // and stored them as all-null records (765 of them in botdata).
  const sheetRows = body
    .filter((cells) => cells.some((v) => (v ?? '').trim() !== ''))
    .map(spec.toRow);

  const dbRows = await fetchAllRows(spec);

  // Multiset diff: each sheet row consumes one matching DB row; leftovers on either side change.
  const pool = new Map<string, number[]>();
  for (const r of dbRows) {
    const k = keyOf(r, spec.columns);
    const ids = pool.get(k);
    if (ids) ids.push(r.id); else pool.set(k, [r.id]);
  }
  const toInsert: Row[] = [];
  for (const r of sheetRows) {
    const ids = pool.get(keyOf(r, spec.columns));
    if (ids && ids.length) ids.pop(); else toInsert.push(r);
  }
  const toDelete = [...pool.values()].flat();

  const realDbRows = dbRows.filter((r) => spec.columns.some((c) => r[c] !== null && r[c] !== 0)).length;
  const summary = {
    table: spec.table,
    source: GOOGLE_SA_JSON ? 'service_account' : 'public_csv',
    sheet_rows: sheetRows.length,
    db_rows_before: dbRows.length,
    to_delete: toDelete.length,
    to_insert: toInsert.length,
    unchanged: sheetRows.length - toInsert.length,
    applied: false,
  };

  if (sheetRows.length === 0) {
    throw new Error(`${spec.tab}: sheet returned 0 data rows — refusing to empty the table`);
  }
  if (!opts.force && realDbRows > 0 && sheetRows.length < realDbRows * MIN_KEEP_RATIO) {
    throw new Error(
      `${spec.tab}: sheet has ${sheetRows.length} rows vs ${realDbRows} in the table (< ${MIN_KEEP_RATIO * 100}%) — ` +
      'looks like the sheet was emptied or truncated; re-run with ?force=1 if this is intended',
    );
  }

  if (opts.dry || (toDelete.length === 0 && toInsert.length === 0)) return summary;

  // p_expected_count lets the RPC detect that another sync (cron vs. the manual menu) changed the
  // table after this diff was computed; it then aborts instead of inserting the same rows twice.
  const { data, error } = await supabase.rpc('sync_stock_apply', {
    p_table: spec.table,
    p_delete_ids: toDelete,
    p_insert: toInsert,
    p_expected_count: dbRows.length,
  });
  if (error) throw new Error(`${spec.table}: apply failed: ${error.message}`);
  return { ...summary, applied: true, result: data };
}

// ============================================
// HTTP entry
// ============================================

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Fail closed: without a configured secret nobody can trigger a sync.
  const provided = req.headers.get('x-sync-secret') || '';
  if (!SYNC_SECRET || !timingSafeEqual(provided, SYNC_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const opts = { dry: url.searchParams.get('dry') === '1', force: url.searchParams.get('force') === '1' };
  const only = url.searchParams.get('table');
  const specs = only ? SPECS.filter((s) => s.table === only) : SPECS;

  const results: unknown[] = [];
  let failed = false;
  // Tables are independent: one failing (e.g. a renamed tab) must not block the other.
  for (const spec of specs) {
    try {
      results.push(await syncTable(spec, opts));
    } catch (e) {
      failed = true;
      console.error('❌ sync failed:', e);
      results.push({ table: spec.table, error: String((e as Error).message ?? e) });
    }
  }

  return new Response(JSON.stringify({ ok: !failed, dry: opts.dry, results }), {
    status: failed ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
