/**
 * JETSETGO - Thai Text Normalization Utilities
 * Handles Thai language processing for RAG system
 */

/**
 * Normalize Thai text for better search and embedding
 */
export function normalizeThaiText(text: string): string {
  if (!text) return '';

  return text
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Fix double Sara Am (Thai vowel)
    .replace(/\u0E33\u0E33/g, '\u0E4D')
    // Remove tone marks (optional - for search purposes)
    // .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
    // Remove special characters but keep Thai, English, numbers
    .replace(/[^\u0E00-\u0E7F\uA74E-\uA7FFa-zA-Z0-9\s\-\/]/g, '')
    .trim();
}

/**
 * Remove tone marks from Thai text (for fuzzy matching)
 */
export function removeThaiToneMarks(text: string): string {
  if (!text) return '';

  // Thai tone marks: ่ ้ ๊ ๋ ็ ์ ํ ๎ ๏ ๚ ๛
  return text.replace(/[\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E4D\u0E4E\u0E4F\u0E5A\u0E5B]/g, '');
}

/**
 * Transliterate Thai to Roman (simple version)
 * For more accurate results, use a library like 'thai2rom'
 */
export function thaiToRoman(text: string): string {
  if (!text) return '';

  const consonants: Record<string, string> = {
    'ก': 'k', 'ข': 'kh', 'ฃ': 'kh', 'ค': 'kh', 'ฅ': 'kh', 'ฆ': 'kh', 'ง': 'ng',
    'จ': 'ch', 'ฉ': 'ch', 'ช': 'ch', 'ซ': 's', 'ฌ': 'ch', 'ญ': 'y', 'ฎ': 'd',
    'ฏ': 't', 'ฐ': 'th', 'ฑ': 'd', 'ฒ': 'th', 'ณ': 'n', 'ด': 'd', 'ต': 't',
    'ถ': 'th', 'ท': 'th', 'ธ': 'th', 'น': 'n', 'บ': 'b', 'ป': 'p', 'ผ': 'ph',
    'ฝ': 'f', 'พ': 'ph', 'ฟ': 'f', 'ภ': 'ph', 'ม': 'm', 'ย': 'y', 'ร': 'r',
    'ฤ': 'rue', 'ล': 'l', 'ฦ': 'lue', 'ว': 'w', 'ศ': 's', 'ษ': 's', 'ส': 's',
    'ห': 'h', 'ฬ': 'l', 'ฮ': 'h'
  };

  const vowels: Record<string, string> = {
    'ะ': 'a', 'ั': 'a', 'า': 'a', 'ำ': 'am',
    'ิ': 'i', 'ี': 'i', 'ึ': 'ue', 'ี': 'i',
    'ุ': 'u', 'ู': 'u',
    'เ': 'e', 'แ': 'ae', 'โ': 'o', 'ใ': 'ai', 'ไ': 'ai',
    '็': '', // Maisannok (shorten vowel)
    '่': '', // Mai ek (tone mark)
    '้': '', // Mai tho (tone mark)
    '๊': '', // Mai tri (tone mark)
    '๋': '', // Mai chattawa (tone mark)
    '์': ''  // Thanthakhat (no sound)
  };

  let result = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // Check if it's a Thai consonant or vowel
    if (consonants[char]) {
      result += consonants[char];
    } else if (vowels[char]) {
      result += vowels[char];
    } else if (/[a-zA-Z0-9\s]/.test(char)) {
      result += char;
    }
    // Skip other Thai characters

    i++;
  }

  return result.toLowerCase();
}

/**
 * Extract vehicle information from Thai text
 * Common patterns: "รถยนต์ Toyota", "ปี 2018", "รุ่น Altis"
 */
export interface VehicleInfo {
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
}

export function extractVehicleInfo(text: string): VehicleInfo {
  const info: VehicleInfo = {};

  // Thai vehicle brands
  const brands = [
    'Toyota', 'โตโยต้า', 'Honda', 'ฮอนด้า', 'Isuzu', 'อิสุซุ',
    'Mazda', 'มาสด้า', 'Mitsubishi', 'มิตซูบิชิ', 'Nissan', 'นิสสัน',
    'Suzuki', 'ซูซูกิ', 'Ford', 'ฟอร์ด', 'Chevrolet', 'เชฟโรเลต',
    'BMW', 'Mercedes', 'Benz', 'เบนซ์', 'Audi', 'Volkswagen', 'โฟล์กสวาเกน',
    'Volvo', 'วอลโว่', 'Hyundai', 'ฮุนได', 'Kia', 'คิา', 'Proton', 'เปอร์โตน'
  ];

  // Extract brand
  for (const brand of brands) {
    if (text.toLowerCase().includes(brand.toLowerCase())) {
      // Standardize brand name
      info.make = brand.replace(/โตโยต้า/i, 'Toyota')
        .replace(/ฮอนด้า/i, 'Honda')
        .replace(/อิสุซุ/i, 'Isuzu')
        .replace(/มาสด้า/i, 'Mazda')
        .replace(/มิตซูบิชิ/i, 'Mitsubishi')
        .replace(/นิสสัน/i, 'Nissan')
        .replace(/ซูซูกิ/i, 'Suzuki')
        .replace(/เชฟโรเลต/i, 'Chevrolet')
        .replace(/เบนซ์/i, 'Mercedes-Benz')
        .replace(/โฟล์กสวาเกน/i, 'Volkswagen')
        .replace(/วอลโว่/i, 'Volvo')
        .replace(/ฮุนได/i, 'Hyundai')
        .replace(/คิา/i, 'Kia')
        .replace(/เปอร์โตน/i, 'Proton');
      break;
    }
  }

  // Extract year (Thai BE or AD)
  const yearPatterns = [
    /ปี\s*(\d{4})/,  // "ปี 2018"
    /(?:model|รุ่น|ยี่ห้อ)[:\s]*(\d{4})/i,
    /(\d{4})/  // Any 4-digit number
  ];

  for (const pattern of yearPatterns) {
    const match = text.match(pattern);
    if (match) {
      let year = parseInt(match[1]);
      // Convert Thai BE to AD (BE - 543)
      if (year > 2400) {
        year -= 543;
      }
      // Validate reasonable year range
      if (year >= 1980 && year <= new Date().getFullYear() + 1) {
        info.year = year;
        break;
      }
    }
  }

  // Extract engine (common patterns)
  const enginePatterns = [
    /(\d\.\d)\s*(?:ลิตร|liter|l)/i,
    /(\d{3,4})\s*cc/i
  ];

  for (const pattern of enginePatterns) {
    const match = text.match(pattern);
    if (match) {
      info.engine = match[1];
      break;
    }
  }

  return info;
}

/**
 * Tokenize Thai text (simple word segmentation)
 * For production, use a library like 'libthai' or 'pythainlp'
 */
export function tokenizeThai(text: string): string[] {
  const normalized = normalizeThaiText(text);
  const tokens: string[] = [];
  let currentToken = '';

  // Simple rule-based tokenization
  // Thai words are separated by: spaces, numbers, English characters, or certain characters
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const code = normalized.charCodeAt(i);

    // Check if it's a Thai character
    const isThai = code >= 0x0E00 && code <= 0x0E7F;

    if (isThai) {
      currentToken += char;
    } else {
      // Non-Thai character - push current token if any
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
      // Push non-Thai character as separate token
      if (char.trim()) {
        tokens.push(char);
      }
    }
  }

  if (currentToken) {
    tokens.push(currentToken);
  }

  return tokens.filter(t => t.trim().length > 0);
}

/**
 * Detect if text is primarily Thai
 */
export function isThaiText(text: string): boolean {
  if (!text) return false;

  let thaiChars = 0;
  let totalChars = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x0E00 && code <= 0x0E7F) {
      thaiChars++;
    }
    if (char.trim()) totalChars++;
  }

  return totalChars > 0 && (thaiChars / totalChars) > 0.3;
}

/**
 * Prepare text for embedding generation
 * Combines Thai and English fields for better semantic search
 */
export function prepareTextForEmbedding(
  partNumber: string,
  nameTh?: string,
  nameEn?: string,
  description?: string,
  brand?: string,
  category?: string
): string {
  const parts: string[] = [];

  // Always include part number
  parts.push(`Part: ${partNumber}`);

  // Add brand
  if (brand) parts.push(`Brand: ${brand}`);

  // Add category
  if (category) parts.push(`Category: ${category}`);

  // Add Thai name
  if (nameTh) parts.push(`ชื่อ: ${nameTh}`);

  // Add English name
  if (nameEn) parts.push(`Name: ${nameEn}`);

  // Add description
  if (description) parts.push(`Description: ${description}`);

  // Combine with separator
  const combined = parts.join(' | ');

  // Normalize
  return normalizeThaiText(combined);
}

/**
 * Truncate text to max tokens (approximate)
 */
export function truncateToMaxTokens(text: string, maxTokens: number = 512): string {
  // Rough estimate: 1 token ≈ 3-4 characters for Thai, 4 characters for English
  const avgCharsPerToken = 3.5;
  const maxChars = Math.floor(maxTokens * avgCharsPerToken);

  if (text.length <= maxChars) return text;

  return text.slice(0, maxChars);
}
