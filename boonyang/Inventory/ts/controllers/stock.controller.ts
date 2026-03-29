/**
 * Stock Controller
 * Handles stock search and inventory queries
 * Replaces checkstock.js from Google Apps Script
 */

import { supabaseService } from '../services/supabase.service';
import { cacheService } from '../services/cache.service';
import { createLineService } from '../services/line.service';
import { isLotAEarlier, formatLotDisplay, cleanItemName } from '../utils/lot-parser';
import { groupDuplicateItems } from '../utils/string-matcher';
import { formatStockMessage, formatInventDataMessage } from '../utils/formatters';
import { createSearchResultCarousel } from '../templates/flex.templates';
import { LineEvent } from '../types';

export class StockController {
  private lineService = createLineService(process.env.LINE_CHANNEL_TOKEN || '');

  // ============================================
  // Cache Management
  // ============================================

  async ensureCacheExists(): Promise<void> {
    const testKeys = ['stock:BOTDATA', 'stock:INVENTDATA'];
    let hasBotDataCache = false;

    for (const key of testKeys) {
      if (cacheService.getStockData(key)) {
        hasBotDataCache = true;
        break;
      }
    }

    const hasInventDataCache = !!cacheService.getInventData();

    if (!hasBotDataCache) {
      console.log('⚠️ BotData cache missing - preloading...');
      await this.preloadStockCache();
    }

    if (!hasInventDataCache) {
      console.log('⚠️ InventData cache missing - preloading...');
      await this.preloadInventDataCache();
    }
  }

  async preloadStockCache(): Promise<void> {
    const data = await supabaseService.getAllBotData();
    console.log(`📦 Loaded ${data.length} rows from BotData`);

    const groupedMap = new Map<string, any[]>();

    data.forEach((row) => {
      const keys = [row.item_code, row.alternative_key_1, row.alternative_key_2];
      keys.forEach((key) => {
        const k = key?.toString().trim();
        if (!k) return;
        if (!groupedMap.has(k)) groupedMap.set(k, []);
        groupedMap.get(k)!.push(row);
      });
    });

    groupedMap.forEach((value, key) => {
      try {
        cacheService.putStockData(key, value);
      } catch (e) {
        console.log(`⚠️ Skipped ${key} (too large)`);
      }
    });

    console.log('✅ BotData cached successfully');
  }

  async preloadInventDataCache(): Promise<void> {
    const data = await supabaseService.getAllInventData();
    console.log(`📦 Loaded ${data.length} rows from InventData`);

    const inventDataItems = data.map((item) => ({
      name: item.item_name,
      stock: item.stock_quantity,
      status: item.stock_status,
    }));

    cacheService.putInventData(inventDataItems);
    console.log('✅ InventData cached successfully');
  }

  async manualRefreshCache(): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
  }> {
    await this.preloadStockCache();
    await this.preloadInventDataCache();

    return {
      success: true,
      message: '✅ Cache อัพเดทเรียบร้อยแล้ว (TTL: 30 นาที)',
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // Search Functions
  // ============================================

  async findItemAndPrepareReply(reqEvent: LineEvent): Promise<void> {
    try {
      await this.ensureCacheExists();

      const codeToFind = reqEvent.message?.text?.trim() || '';
      const replyToken = reqEvent.replyToken!;
      const quoteToken = reqEvent.message?.quoteToken;

      console.log(`🔍 Looking for: ${codeToFind}`);

      // Try exact match from cache first
      let items = cacheService.getStockData(codeToFind);

      if (!items) {
        console.log(`⚠️ Cache miss, reloading from BotData...`);
        await this.preloadStockCache();
        items = cacheService.getStockData(codeToFind);
      }

      if (!items || items.length === 0) {
        console.log(`❌ Not found in BotData, trying InventData fuzzy search...`);
        await this.searchInventDataAndReply(reqEvent);
        return;
      }

      console.log(`📦 Items matched: ${items.length}`);
      if (!items || items.length === 0) return;

      // Group by item name, keep earliest LOT
      const itemMap = groupDuplicateItems(items);

      if (itemMap.size === 0) return;

      console.log(`📋 Unique item names: ${itemMap.size}`);

      // Sort by name A → Z
      const sortedEntries = Array.from(itemMap.entries()).sort((a, b) =>
        a[0].localeCompare(b[0], 'th', { sensitivity: 'base' })
      );

      const now = new Date();
      const timestamp = now.toLocaleString('th-TH');

      const stockItems = sortedEntries.map(([itemName, row], index) => ({
        index: index + 1,
        item_name: itemName,
        lot_number: row.lot_number,
        on_hand_quantity: row.on_hand_quantity,
        stock_status:
          row.on_hand_quantity >= 4
            ? '✅ มีสินค้า'
            : '☎️ กรุณาโทรสอบถาม',
      }));

      const messageBody = formatStockMessage(stockItems, codeToFind);

      await this.lineService.replyMessage(replyToken, [
        {
          type: 'text',
          text: messageBody,
          quoteToken: quoteToken,
        },
      ]);

      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('❌ ERROR @ findItemAndPrepareReply:', error);
    }
  }

  async searchInventDataAndReply(reqEvent: LineEvent): Promise<void> {
    try {
      await this.ensureCacheExists();

      const searchTextRaw = reqEvent.message?.text?.trim() || '';
      const searchText = searchTextRaw.toLowerCase();
      const replyToken = reqEvent.replyToken!;

      if (searchText.length < 2) {
        console.log(`⚠️ Search text too short: "${searchText}"`);
        return;
      }

      console.log(`🔍 InventData partial search for: "${searchText}"`);

      let inventDataItems = cacheService.getInventData();

      if (!inventDataItems) {
        console.log('⚠️ Cache miss, loading InventData from sheet...');
        await this.preloadInventDataCache();
        inventDataItems = cacheService.getInventData();
      }

      if (!inventDataItems || inventDataItems.length === 0) {
        console.log('❌ No InventData available');
        await this.lineService.replyMessage(replyToken, [
          {
            type: 'text',
            text: '❌ ไม่สามารถโหลดข้อมูลสินค้าได้ (InventData)',
          },
        ]);
        return;
      }

      console.log(`📦 Searching through ${inventDataItems.length} items`);

      // Check for EXACT MATCH first
      const exactMatches = inventDataItems.filter(
        (item) => item.name.toLowerCase() === searchText
      );

      console.log(`🎯 Exact matches found: ${exactMatches.length}`);

      if (exactMatches.length === 1) {
        const item = exactMatches[0];
        const message = formatInventDataMessage(item);

        await this.lineService.replyMessage(replyToken, [
          {
            type: 'text',
            text: message,
            quoteToken: reqEvent.message?.quoteToken,
          },
        ]);

        console.log(`✅ Exact match 1 item: "${item.name}" → replied with text`);
        return;
      }

      // Partial match + group duplicates
      const matches = inventDataItems.filter((item) =>
        item.name.toLowerCase().includes(searchText)
      );

      if (matches.length === 0) {
        console.log(`🔍 No matches found for: "${searchText}"`);
        await this.lineService.replyMessage(replyToken, [
          {
            type: 'text',
            text: `❌ ไม่พบสินค้า "${searchTextRaw}"`,
          },
        ]);
        return;
      }

      // Group by name and sum stock
      const groupedMap = new Map<string, any>();
      matches.forEach((item) => {
        const key = item.name;
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            name: item.name,
            stock: item.stock,
            status: item.status,
          });
        } else {
          const existing = groupedMap.get(key);
          existing.stock += item.stock;
          existing.status =
            existing.stock >= 4 ? 'มีสินค้า' : 'ติดต่อแอดมิน';
        }
      });

      const grouped = Array.from(groupedMap.values());

      console.log(
        `🔍 Search result: ${grouped.length} unique items (from ${matches.length} total matches)`
      );

      const flexMessage = createSearchResultCarousel(grouped);
      await this.lineService.replyMessage(replyToken, [flexMessage]);
    } catch (error) {
      console.error('❌ ERROR @ searchInventDataAndReply:', error);
    }
  }
}

// Singleton instance
export const stockController = new StockController();
