// ✅ =====================================================================
// ✅ Cache Management Functions
// ✅ =====================================================================

// ✅ ตรวจสอบและสร้าง cache ถ้าจำเป็น (Auto-preload)
function ensureCacheExists() {
  const cache = CacheService.getScriptCache();

  // ตรวจสอบ BotData cache
  const botDataKeys = ['stock:BOTDATA', 'stock:INVENTDATA'];
  let hasBotDataCache = false;

  // เช็คเพียงพอว่ามี cache อยู่บ้าง (ไม่ต้อง check ทุก key)
  const testKeys = botDataKeys.slice(0, 1);
  for (const key of testKeys) {
    if (cache.get(key)) {
      hasBotDataCache = true;
      break;
    }
  }

  // ตรวจสอบ InventData cache
  const hasInventDataCache = !!cache.get('inventdata:all');

  Logger.log(`🔍 Cache check - BotData: ${hasBotDataCache ? '✅' : '❌'}, InventData: ${hasInventDataCache ? '✅' : '❌'}`);

  // Preload ถ้ายังไม่มี
  if (!hasBotDataCache) {
    Logger.log("⚠️ BotData cache missing - preloading...");
    preloadStockCache();
  }

  if (!hasInventDataCache) {
    Logger.log("⚠️ InventData cache missing - preloading...");
    preloadInventDataCache();
  }
}

// ✅ Manual Refresh Cache (User สามารถสั่งเองได้)
function manualRefreshCache() {
  Logger.log("🔄 Manual cache refresh requested...");

  preloadStockCache();
  preloadInventDataCache();

  return {
    success: true,
    message: "✅ Cache อัพเดทเรียบร้อยแล้ว (TTL: 30 นาที)",
    timestamp: new Date().toISOString()
  };
}

// ✅ Auto-Refresh Cache ทุก 30 นาที (Trigger function)
function autoRefreshCache() {
  Logger.log("🔄 Auto-refreshing cache (every 30 minutes)...");

  preloadStockCache();
  preloadInventDataCache();

  Logger.log("✅ Auto-refresh completed at " + new Date().toLocaleString("th-TH"));
}

// ✅ Setup Trigger สำหรับ Auto-Refresh (รันครั้งแรกเพื่อ setup)
function setupAutoRefreshTrigger() {
  // ลบ trigger เก่า (ถ้ามี)
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'autoRefreshCache') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log("🗑️  Deleted old auto-refresh trigger");
    }
  });

  // สร้าง trigger ใหม่ (ทุก 30 นาที)
  ScriptApp.newTrigger('autoRefreshCache')
    .timeBased()
    .everyMinutes(30)
    .create();

  Logger.log("✅ Auto-refresh trigger created (every 30 minutes)");
}

// ✅ =====================================================================
// ✅ Stock Cache Functions
// ✅ =====================================================================

// ✅ preloadStockCache แบบ CacheService เท่านั้น (30 นาที)
function preloadStockCache() {
  const SHEET_ID = '1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8';
  const SHEET_NAME = 'BotData';
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("❌ Sheet not found: " + SHEET_NAME);
    return;
  }

  const lastRow = sheet.getLastRow();
  Logger.log("📦 Total Rows: " + lastRow);

  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  Logger.log("✅ Data loaded: " + data.length + " rows");

  const cache = CacheService.getScriptCache();
  const groupedMap = {};

  data.forEach((row) => {
    const keys = [row[0], row[5], row[6]];
    keys.forEach(key => {
      const k = key?.toString().trim();
      if (!k) return;
      if (!groupedMap[k]) groupedMap[k] = [];
      groupedMap[k].push(row);
    });
  });

  Logger.log("🔑 Unique keys to cache: " + Object.keys(groupedMap).length);

  // Store in CacheService only (5 min TTL)
  Object.keys(groupedMap).forEach(key => {
    try {
      const payload = JSON.stringify(groupedMap[key]);

      if (payload.length < 95000) {
        cache.put(`stock:${key}`, payload, 1800); // 30 นาที
      } else {
        Logger.log(`⚠️ Skipped ${key} (too large: ${payload.length} bytes)`);
      }
    } catch (e) {
      Logger.log(`❌ Failed to cache ${key}: ` + e);
    }
  });

  Logger.log("✅ CacheService caching complete (TTL: 5 minutes)");
}

// ✅ preloadInventDataCache - Cache ข้อมูล InventData สำหรับ Fuzzy Search
function preloadInventDataCache() {
  const SHEET_ID = '1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8';
  const SHEET_NAME = 'InventData';
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("❌ InventData Sheet not found");
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("⚠️ InventData sheet is empty");
    return;
  }

  // อ่านข้อมูล: Column A (ItemName), Column B (Stock)
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  Logger.log("📦 InventData loaded: " + data.length + " rows");

  const cache = CacheService.getScriptCache();

  // แปลงข้อมูลให้อยู่ในรูปแบบง่ายสำหรับ cache
  const inventDataItems = data.map((row, index) => ({
    name: String(row[0] || '').trim(),
    stock: Number(row[1]) || 0,
    status: (Number(row[1]) || 0) >= 4 ? 'มีสินค้า' : 'ติดต่อแอดมิน',
    row: index + 2
  })).filter(item => item.name.length > 0); // กรองชื่อว่าง

  try {
    const payload = JSON.stringify(inventDataItems);
    Logger.log(`📦 InventData payload size: ${payload.length} bytes`);

    if (payload.length < 95000) {
      cache.put('inventdata:all', payload, 1800); // 30 นาที
      Logger.log("✅ InventData cached successfully (TTL: 30 minutes)");
      Logger.log(`📋 Total items cached: ${inventDataItems.length}`);
    } else {
      Logger.log(`⚠️ InventData too large (${payload.length} bytes), skipping cache`);
    }
  } catch (e) {
    Logger.log("❌ Failed to cache InventData: " + e);
  }
}

// ✅ ค้นหาและตอบกลับผู้ใช้จาก CacheService + Fallback to Sheet
function findItemAndPrepareReply(reqEvent) {
  try {
    // ✅ ตรวจสอบและสร้าง cache ถ้าจำเป็น
    ensureCacheExists();

    const codeToFind = reqEvent.message.text.trim();
    const replyToken = reqEvent.replyToken;
    const quoteToken = reqEvent.message.quoteToken;
    const cacheKey = `stock:${codeToFind}`;

    // --- Helpers สำหรับ LOT (สัปดาห์ + ปี 2 หลัก) ---
    function parseLot(lotVal) {
      const raw = String(lotVal || '').replace(/\D/g, '').trim();
      if (raw.length < 2) return { year: NaN, week: NaN, rank: Number.MAX_SAFE_INTEGER };
      const yy = parseInt(raw.slice(-2), 10);
      const weekStr = raw.slice(0, -2);
      const week = weekStr ? parseInt(weekStr, 10) : 0;
      const year = 2000 + (isNaN(yy) ? 0 : yy);
      const rank = (year * 100) + (isNaN(week) ? 0 : week);
      return { year, week: isNaN(week) ? 0 : week, rank };
    }

    function isLotAEarlier(lotA, lotB) {
      const a = parseLot(lotA);
      const b = parseLot(lotB);
      return a.rank < b.rank;
    }

    function formatLotDisplay(lotVal) {
      const { year, week } = parseLot(lotVal);
      if (isNaN(year) || isNaN(week)) return `LOT: ${lotVal}`;
      const w = String(week).padStart(2, '0');
      return `LOT: ${lotVal} (W${w}/${year})`;
    }
    // ---------------------------------------------------

    Logger.log("🔍 Looking for: " + codeToFind);

    const cache = CacheService.getScriptCache();

    // 1. Try CacheService first
    let raw = cache.get(cacheKey);

    // 2. Fallback: reload from sheet if cache miss
    if (!raw) {
      Logger.log(`⚠️ Cache miss, reloading from BotData sheet...`);
      preloadStockCache();
      raw = cache.get(cacheKey);
    }

    // 3. ถ้าไม่เจอใน BotData → ไปค้นใน InventData (Partial Search)
    if (!raw) {
      Logger.log(`❌ Not found in BotData, trying InventData fuzzy search...`);
      callIfExists_("searchInventDataAndReply", reqEvent);
      return;
    }

    const items = JSON.parse(raw);
    Logger.log("📦 Items matched: " + items.length);
    if (!items || items.length === 0) return;

    // รวมสินค้าชื่อซ้ำโดยเก็บล็อตเก่าที่สุดต่อชื่อ
    const itemMap = new Map();
    items.forEach(row => {
      let itemName = (row[2] || '').trim();
      if (itemName.endsWith(" 0 000")) itemName = itemName.slice(0, -6).trim();
      const lot = row[3];
      if (!itemMap.has(itemName)) {
        itemMap.set(itemName, row);
      } else {
        const currentRow = itemMap.get(itemName);
        const currentLot = currentRow[3];
        if (isLotAEarlier(lot, currentLot)) {
          itemMap.set(itemName, row);
        }
      }
    });

    if (itemMap.size === 0) return;

    Logger.log("📋 Unique item names: " + itemMap.size);

    // ✅ เรียงชื่อสินค้า A → Z
    const sortedEntries = [...itemMap.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], 'th', { sensitivity: 'base' })
    );

    const now = new Date();
    const timestamp = Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yyyy HH:mm");
    let messageBody = `📅 เวลาค้นหา: ${timestamp}\n🔍 พบ ${itemMap.size} รายการสำหรับ "${codeToFind}"\n\n`;

    let index = 1;
    const itemDetails = sortedEntries
      .map(([itemName, row]) => {
        const lot = row[3];
        const onHand = Number(row[4]);
        const stockStatus = onHand >= 4 ? `✅ มีสินค้า` : `☎️ กรุณาโทรสอบถาม`;
        return `${index++}. ${itemName}\n${formatLotDisplay(lot)}\nStock: ${stockStatus}`;
      })
      .join('\n\n');

    const msg = [{
      type: "text",
      text: messageBody + itemDetails,
      quoteToken: quoteToken
    }];

    sendLineReply(replyToken, msg);
    Logger.log("✅ Message sent successfully");

  } catch (error) {
    Logger.log('❌ ERROR @ findItemAndPrepareReply: ' + error);
  }
}

/**
 * Calculate Levenshtein Distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score (0-1, where 1 is exact match)
 */
function similarityScore(str1, str2) {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - (distance / maxLen);
}

// ✅ Pure Partial Search จาก InventData (Cache First → Fallback to Sheet)
function searchInventDataAndReply(reqEvent) {
  try {
    // ✅ ตรวจสอบและสร้าง cache ถ้าจำเป็น
    ensureCacheExists();

    const searchTextRaw = reqEvent.message.text.trim();
    const searchText = searchTextRaw.toLowerCase();
    const replyToken = reqEvent.replyToken;

    // ป้องกันการค้นหาคำสั้นเกินไป
    if (searchText.length < 2) {
      Logger.log(`⚠️ Search text too short: "${searchText}"`);
      return;
    }

    Logger.log(`🔍 InventData partial search for: "${searchText}"`);

    const cache = CacheService.getScriptCache();
    let inventDataItems = null;
    let cached = cache.get('inventdata:all');

    // 1. Try cache first
    if (cached) {
      Logger.log('✅ Using cached InventData');
      try {
        inventDataItems = JSON.parse(cached);
      } catch (e) {
        Logger.log('❌ Failed to parse cached InventData: ' + e);
      }
    }

    // 2. Fallback: reload from sheet if cache miss
    if (!inventDataItems) {
      Logger.log('⚠️ Cache miss, loading InventData from sheet...');
      preloadInventDataCache();
      cached = cache.get('inventdata:all');
      if (cached) {
        try {
          inventDataItems = JSON.parse(cached);
        } catch (e) {
          Logger.log('❌ Failed to parse cached InventData after reload: ' + e);
        }
      }
    }

    // 3. ถ้ายังไม่มีข้อมูล → แจ้ง error
    if (!inventDataItems || inventDataItems.length === 0) {
      Logger.log('❌ No InventData available');
      sendLineReply(replyToken, [{
        type: "text",
        text: "❌ ไม่สามารถโหลดข้อมูลสินค้าได้ (InventData)"
      }]);
      return;
    }

    Logger.log(`📦 Searching through ${inventDataItems.length} items`);

    // ✅ STEP 1: Check for EXACT MATCH (100%) ก่อน
    const exactMatches = inventDataItems.filter(item =>
      item.name.toLowerCase() === searchText
    );

    Logger.log(`🎯 Exact matches found: ${exactMatches.length}`);

    // ✅ CASE 1: พบ exact match 1 รายการ → ตอบ text message เลย
    if (exactMatches.length === 1) {
      const item = exactMatches[0];
      const stockIcon = item.stock >= 4 ? '✅' : '☎️';
      const stockStatus = item.stock >= 4 ? 'มีสินค้า' : 'กรุณาโทรสอบถาม';

      sendLineReply(replyToken, [{
        type: "text",
        text: `${stockIcon} ${item.name}\n\n📋 สถานะ: ${stockStatus}`,
        quoteToken: reqEvent.message.quoteToken
      }]);
      Logger.log(`✅ Exact match 1 item: "${item.name}" → replied with text`);
      return;
    }

    // ✅ CASE 2: พบ exact match หลายรายการ → รวม stock + ตอบ flex
    // ✅ CASE 3: ไม่พบ exact match → ไป partial search + ตอบ flex
    // (ทั้ง 2 cases ใช้ logic เดียวกัน = group รายการซ้ำ + flex)

    const matches = [];

    // เพิ่ม exact matches เข้าไปใน matches (ถ้ามี)
    if (exactMatches.length > 1) {
      exactMatches.forEach(item => matches.push(item));
    }

    // Partial search
    inventDataItems.forEach(item => {
      const itemNameLower = item.name.toLowerCase();

      // ✅ Partial Match (case-insensitive)
      // เช่น "civic" จะ match กับ "001-01-NH112-P-SIL : CIVIC FD (06-11)"
      // เช่น "civic" จะ match กับ "001-01-NH132-P-SIL : HD CIVIC FB"
      if (itemNameLower.includes(searchText)) {
        matches.push(item);
      }
    });

    if (matches.length === 0) {
      Logger.log(`🔍 No matches found for: "${searchText}"`);
      sendLineReply(replyToken, [{
        type: "text",
        text: `❌ ไม่พบสินค้า "${reqEvent.message.text}"`
      }]);
      return;
    }

    Logger.log(`🔍 Search "${searchText}" → ${matches.length} matches (exact: ${exactMatches.length}, partial: ${matches.length - exactMatches.length})`);

    // ✅ Group รายการซ้ำโดยรวม stock (เช่น {name: "001-01-NH132-P-SIL : HD CIVIC FB", stock: 2})
    const groupedMap = new Map();
    matches.forEach(item => {
      const key = item.name;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          name: item.name,
          stock: item.stock,
          status: item.status,
          row: item.row
        });
      } else {
        // รวม stock ของรายการซ้ำ
        const existing = groupedMap.get(key);
        existing.stock += item.stock;
        // ใช้ status ที่ดีที่สุด (ถ้ามี > 4 items รวมกันแล้ว = มีสินค้า)
        existing.status = existing.stock >= 4 ? 'มีสินค้า' : 'ติดต่อแอดมิน';
      }
    });

    const grouped = Array.from(groupedMap.values());

    Logger.log(`🔍 Search result: ${grouped.length} unique items (from ${grouped.size} grouped, ${matches.length} total matches)`);

    // ส่งทุกรายการไปจัดเป็น carousel (12 ปุ่ม/bubble)
    const r = callIfExists_("createSearchResultCarousel", grouped);
    if (r.ok) {
      sendLineReply(replyToken, [r.result]);
    } else {
      // Fallback ถ้าไม่มี flex function
      const maxDisplay = 50; // จำกัด 50 รายการสำหรับ text message
      const displayItems = grouped.slice(0, maxDisplay);
      const moreText = grouped.length > maxDisplay ? `\n...และอีก ${grouped.length - maxDisplay} รายการ` : '';

      sendLineReply(replyToken, [{
        type: "text",
        text: `พบ ${grouped.length} รายการ:\n${displayItems.map(m => `- ${m.name} (${m.status})`).join('\n')}${moreText}`,
        quoteToken: reqEvent.message.quoteToken
      }]);
    }

  } catch (error) {
    Logger.log('❌ ERROR @ searchInventDataAndReply: ' + error);
  }
}
