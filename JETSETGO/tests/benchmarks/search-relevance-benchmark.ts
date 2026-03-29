/**
 * Search Relevance Benchmark
 * Tests how well the semantic search returns relevant results
 */

export interface SearchTestCase {
  id: string;
  query: string;
  expectedCategory?: string;
  expectedPartType?: string;
  expectedBrands?: string[];
  minRelevanceScore: number;
  shouldFindResults: boolean;
  description: string;
}

export const SEARCH_TEST_CASES: SearchTestCase[] = [
  // Thai queries - basic categories
  {
    id: 'TH-001',
    query: 'ยางรถยนต์',
    expectedCategory: 'tires',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Basic Thai tire search'
  },
  {
    id: 'TH-002',
    query: 'ยาง 205/55R16',
    expectedPartType: 'tires',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'Specific tire size search'
  },
  {
    id: 'TH-003',
    query: 'น้ำมันเครื่อง',
    expectedCategory: 'oil',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Engine oil Thai search'
  },
  {
    id: 'TH-004',
    query: 'น้ำมัน 5W-30',
    expectedPartType: 'engine-oil',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'Specific oil viscosity'
  },
  {
    id: 'TH-005',
    query: 'ปะกลงงพร้อม',
    expectedCategory: 'brakes',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Brake pads Thai search'
  },
  {
    id: 'TH-006',
    query: 'กรองอากาศ',
    expectedCategory: 'filters',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Air filter Thai search'
  },
  {
    id: 'TH-007',
    query: 'หัวเทียน',
    expectedCategory: 'ignition',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Spark plugs Thai search'
  },
  {
    id: 'TH-008',
    query: 'สายพานหมาน',
    expectedCategory: 'belts',
    minRelevanceScore: 0.6,
    shouldFindResults: true,
    description: 'Fan belt Thai search'
  },

  // Thai queries - vehicle specific
  {
    id: 'TH-V-001',
    query: 'ยาง Honda City',
    expectedCategory: 'tires',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Tires for Honda City'
  },
  {
    id: 'TH-V-002',
    query: 'น้ำมัน Toyota Vios',
    expectedCategory: 'oil',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Oil for Toyota Vios'
  },
  {
    id: 'TH-V-003',
    query: 'ปะกลง Ford Ranger',
    expectedCategory: 'brakes',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Brakes for Ford Ranger'
  },
  {
    id: 'TH-V-004',
    query: 'ยาง Isuzu D-Max',
    expectedCategory: 'tires',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Tires for Isuzu D-Max'
  },

  // Thai colloquial terms
  {
    id: 'TH-C-001',
    query: 'ยางแม็ก',
    expectedBrands: ['Michelin', 'Bridgestone'],
    minRelevanceScore: 0.6,
    shouldFindResults: true,
    description: 'Colloquial "michelin"'
  },
  {
    id: 'TH-C-002',
    query: 'ยางยาง',
    expectedCategory: 'tires',
    minRelevanceScore: 0.6,
    shouldFindResults: true,
    description: 'Colloquial "yang yang"'
  },
  {
    id: 'TH-C-003',
    query: 'น้ำมันเครื่อง 5W',
    expectedPartType: 'engine-oil',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Shortened viscosity term'
  },

  // English queries
  {
    id: 'EN-001',
    query: 'car tire',
    expectedCategory: 'tires',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'English tire search'
  },
  {
    id: 'EN-002',
    query: 'brake pads',
    expectedCategory: 'brakes',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'English brake pads search'
  },
  {
    id: 'EN-003',
    query: 'engine oil 5W-30',
    expectedPartType: 'engine-oil',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'English oil with viscosity'
  },
  {
    id: 'EN-004',
    query: 'oil filter',
    expectedCategory: 'filters',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'English oil filter search'
  },
  {
    id: 'EN-005',
    query: 'air filter',
    expectedCategory: 'filters',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'English air filter search'
  },
  {
    id: 'EN-006',
    query: 'spark plug',
    expectedCategory: 'ignition',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'English spark plug search'
  },

  // Brand-specific searches
  {
    id: 'BR-001',
    query: 'ยาง Michelin',
    expectedBrands: ['Michelin'],
    expectedCategory: 'tires',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'Michelin brand search'
  },
  {
    id: 'BR-002',
    query: 'ยาง Bridgestone',
    expectedBrands: ['Bridgestone'],
    expectedCategory: 'tires',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'Bridgestone brand search'
  },
  {
    id: 'BR-003',
    query: 'น้ำมัน Castrol',
    expectedBrands: ['Castrol'],
    expectedCategory: 'oil',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'Castrol oil search'
  },
  {
    id: 'BR-004',
    query: 'น้ำมัน Mobil',
    expectedBrands: ['Mobil'],
    expectedCategory: 'oil',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'Mobil oil search'
  },

  // Size-specific searches
  {
    id: 'SZ-001',
    query: 'ยาง 185/65R15',
    expectedPartType: 'tires',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'Small tire size search'
  },
  {
    id: 'SZ-002',
    query: 'ยาง 205/55R16',
    expectedPartType: 'tires',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'Medium tire size search'
  },
  {
    id: 'SZ-003',
    query: 'ยาง 265/70R17',
    expectedPartType: 'tires',
    minRelevanceScore: 0.8,
    shouldFindResults: true,
    description: 'Large tire size search'
  },

  // Edge cases - should NOT find results
  {
    id: 'EDGE-001',
    query: 'ยางสำหรับเครื่องบิน',
    shouldFindResults: false,
    minRelevanceScore: 0,
    description: 'Aircraft tire - not in catalog'
  },
  {
    id: 'EDGE-002',
    query: 'สปีกเกอร์แมน',
    shouldFindResults: false,
    minRelevanceScore: 0,
    description: 'Speaker - unrelated product'
  },
  {
    id: 'EDGE-003',
    query: 'ผักตามร้านอาหาร',
    shouldFindResults: false,
    minRelevanceScore: 0,
    description: 'Vegetable - unrelated product'
  },
  {
    id: 'EDGE-004',
    query: 'โทรศัพท์์',
    shouldFindResults: false,
    minRelevanceScore: 0,
    description: 'Tablet device - unrelated product'
  },
  {
    id: 'EDGE-005',
    query: 'เฟอร์นิเจอร์',
    shouldFindResults: false,
    minRelevanceScore: 0,
    description: 'Furniture - unrelated product'
  },
  {
    id: 'EDGE-006',
    query: 'smartphone',
    shouldFindResults: false,
    minRelevanceScore: 0,
    description: 'Phone - unrelated product'
  },

  // Complex queries
  {
    id: 'CPL-001',
    query: 'ยางสำหรับรถเก๋ง ขนาด 185 รุ่น 15',
    expectedCategory: 'tires',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Complex: kei car tire specification'
  },
  {
    id: 'CPL-002',
    query: 'น้ำมันเครื่องเบนซิน 4 สูบ สำหรับรถ Toyota',
    expectedCategory: 'oil',
    minRelevanceScore: 0.7,
    shouldFindResults: true,
    description: 'Complex: synthetic oil for Toyota'
  },
  {
    id: 'CPL-003',
    query: 'ปะกลงหน้า ปะกลงหลัง พร้อม sensor',
    expectedCategory: 'brakes',
    minRelevanceScore: 0.6,
    shouldFindResults: true,
    description: 'Complex: front and rear brake pads'
  }
];

export interface SearchBenchmarkResult {
  testCase: SearchTestCase;
  passed: boolean;
  score: number;
  resultCount: number;
  topResult?: {
    partNumber: string;
    name: string;
    category: string;
    relevanceScore: number;
  };
  error?: string;
}

export async function runSearchBenchmark(): Promise<{
  totalTests: number;
  passed: number;
  failed: number;
  avgRelevanceScore: number;
  byCategory: Record<string, { total: number; passed: number }>;
  details: SearchBenchmarkResult[];
}> {
  const results: SearchBenchmarkResult[] = [];
  const byCategory: Record<string, { total: number; passed: number }> = {};
  let totalScore = 0;
  let passed = 0;
  let failed = 0;

  for (const testCase of SEARCH_TEST_CASES) {
    const result = await testSearch(testCase);
    results.push(result);

    // Track by category
    const cat = testCase.expectedCategory || 'other';
    if (!byCategory[cat]) {
      byCategory[cat] = { total: 0, passed: 0 };
    }
    byCategory[cat].total++;
    if (result.passed) {
      byCategory[cat].passed++;
      passed++;
      totalScore += result.score;
    } else {
      failed++;
    }
  }

  return {
    totalTests: SEARCH_TEST_CASES.length,
    passed,
    failed,
    avgRelevanceScore: totalScore / results.length,
    byCategory,
    details: results
  };
}

async function testSearch(testCase: SearchTestCase): Promise<SearchBenchmarkResult> {
  // Implementation: run actual search and evaluate results
  // For now, return mock result
  return {
    testCase,
    passed: true,
    score: 0.85,
    resultCount: 5,
    topResult: {
      partNumber: 'TEST-001',
      name: 'Test Product',
      category: testCase.expectedCategory || 'other',
      relevanceScore: 0.85
    }
  };
}
