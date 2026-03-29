/**
 * Message Formatters
 * Format messages for LINE bot responses
 */

import { formatLotDisplay } from './lot-parser';

export interface StockItemDisplay {
  index: number;
  item_name: string;
  lot_number: string;
  on_hand_quantity: number;
  stock_status: string;
}

export function formatStockMessage(
  items: StockItemDisplay[],
  searchCode: string
): string {
  const now = new Date();
  const timestamp = now.toLocaleString('th-TH');

  let messageBody = `📅 เวลาค้นหา: ${timestamp}\n`;
  messageBody += `🔍 พบ ${items.length} รายการสำหรับ "${searchCode}"\n\n`;

  const itemDetails = items
    .map((item) => {
      return `${item.index}. ${item.item_name}\n${formatLotDisplay(item.lot_number)}\nStock: ${item.stock_status}`;
    })
    .join('\n\n');

  return messageBody + itemDetails;
}

export function formatInventDataMessage(item: {
  name: string;
  stock: number;
  status: string;
}): string {
  const stockIcon = item.stock >= 4 ? '✅' : '☎️';
  const stockStatus = item.stock >= 4 ? 'มีสินค้า' : 'กรุณาโทรสอบถาม';

  return `${stockIcon} ${item.name}\n\n📋 สถานะ: ${stockStatus}`;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const past = new Date(timestamp).getTime();
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'เมื่อสักครู่';
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  return `${diffDays} วันที่แล้ว`;
}
