/**
 * LOT Parser Utilities
 * Handles LOT number parsing and formatting
 * Format: WWYY (Week Year) e.g., "0524" = Week 05, Year 2024
 */

import { LotInfo } from '../types';

export function parseLot(lotVal: string): LotInfo {
  const raw = String(lotVal || '').replace(/\D/g, '').trim();

  if (raw.length < 2) {
    return {
      raw: lotVal,
      week: 0,
      year: 0,
      rank: Number.MAX_SAFE_INTEGER,
    };
  }

  // Last 2 digits = year, rest = week
  const yy = parseInt(raw.slice(-2), 10);
  const weekStr = raw.slice(0, -2);
  const week = weekStr ? parseInt(weekStr, 10) : 0;
  const year = 2000 + (isNaN(yy) ? 0 : yy);
  const rank = (year * 100) + week;

  return {
    raw: lotVal,
    week,
    year,
    rank,
  };
}

export function isLotAEarlier(lotA: string, lotB: string): boolean {
  const a = parseLot(lotA);
  const b = parseLot(lotB);
  return a.rank < b.rank;
}

export function formatLotDisplay(lotVal: string): string {
  const { week, year } = parseLot(lotVal);

  if (isNaN(year) || isNaN(week)) {
    return `LOT: ${lotVal}`;
  }

  const w = String(week).padStart(2, '0');
  return `LOT: ${lotVal} (W${w}/${year})`;
}

export function cleanItemName(itemName: string): string {
  let name = itemName.trim();
  // Remove trailing " 0 000" pattern if present
  if (name.endsWith(' 0 000')) {
    name = name.slice(0, -6).trim();
  }
  return name;
}
