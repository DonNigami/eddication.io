/**
 * String Matching Utilities
 * Fuzzy search algorithms (Levenshtein distance, similarity scoring)
 */

export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

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

export function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(
    str1.toLowerCase(),
    str2.toLowerCase()
  );
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - (distance / maxLen);
}

export function normalizeText(text: string): string {
  return String(text || '')
    .replace(/\u200B/g, '') // Remove zero-width space
    .trim()
    .toLowerCase();
}

/**
 * Group duplicate items by name and keep earliest LOT
 */
export function groupDuplicateItems(items: any[]): Map<string, any> {
  const itemMap = new Map<string, any>();

  items.forEach((row) => {
    let itemName = row.item_name || row.name || '';
    itemName = itemName.trim();

    // Remove trailing " 0 000" if present
    if (itemName.endsWith(' 0 000')) {
      itemName = itemName.slice(0, -6).trim();
    }

    const lot = row.lot_number;

    if (!itemMap.has(itemName)) {
      itemMap.set(itemName, row);
    } else {
      const currentRow = itemMap.get(itemName);
      const currentLot = currentRow.lot_number || currentRow.lot;

      if (lot && currentLot && isLotAEarlier(lot, currentLot)) {
        itemMap.set(itemName, row);
      }
    }
  });

  return itemMap;
}

// Import isLotAEarlier from lot-parser
function isLotAEarlier(lotA: string, lotB: string): boolean {
  const rawA = String(lotA || '').replace(/\D/g, '').trim();
  const rawB = String(lotB || '').replace(/\D/g, '').trim();

  if (rawA.length < 2 || rawB.length < 2) return false;

  const yyA = parseInt(rawA.slice(-2), 10);
  const yyB = parseInt(rawB.slice(-2), 10);
  const weekA = rawA.slice(0, -2);
  const weekB = rawB.slice(0, -2);

  const yearA = 2000 + (isNaN(yyA) ? 0 : yyA);
  const yearB = 2000 + (isNaN(yyB) ? 0 : yyB);
  const rankA = (yearA * 100) + (weekA ? parseInt(weekA, 10) : 0);
  const rankB = (yearB * 100) + (weekB ? parseInt(weekB, 10) : 0);

  return rankA < rankB;
}
