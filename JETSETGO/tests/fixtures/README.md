# JETSETGO Test Fixtures Data

This directory contains test data for running JETSETGO test suites.

## Structure

```
fixtures/
├── images/              # OCR test images
│   ├── sample-catalog-page-1.png
│   ├── sample-catalog-page-2.jpg
│   ├── thai-text-sample.png
│   ├── table-sample.png
│   ├── low-quality-sample.png
│   ├── rotated-sample.png
│   └── noisy-sample.png
│
├── catalogs/             # Test catalog files
│   ├── small-catalog.pdf
│   ├── tire-catalog.xlsx
│   └── mixed-format-catalog.pdf
│
├── queries/              # Test search queries
│   ├── thai-queries.json
│   ├── english-queries.json
│   └── edge-case-queries.json
│
└── expected/             # Expected results
    ├── ocr-results.json
    ├── search-results.json
    └── llm-responses.json
```

## Thai Queries Test Data

### thai-queries.json

```json
{
  "basic_searches": [
    {
      "query": "ยางรถยนต์",
      "expected_category": "tires",
      "min_results": 3
    },
    {
      "query": "น้ำมันเครื่อง",
      "expected_category": "oil",
      "min_results": 2
    },
    {
      "query": "ปะกลงงพร้อม",
      "expected_category": "brakes",
      "min_results": 2
    }
  ],
  "vehicle_specific": [
    {
      "query": "ยาง Honda City",
      "expected_vehicle": ["Honda", "City"],
      "expected_category": "tires"
    },
    {
      "query": "น้ำมัน Toyota Vios 5W-30",
      "expected_vehicle": ["Toyota", "Vios"],
      "expected_specs": { "viscosity": "5W-30" }
    }
  ],
  "colloquial_terms": [
    {
      "query": "ยางแม็ก",
      "expected_brands": ["Michelin"]
    },
    {
      "query": "น้ำมันสังเครื่อง",
      "expected_category": "oil"
    }
  ]
}
```

## Expected OCR Results

### ocr-results.json

```json
{
  "benchmarks": [
    {
      "image": "sample-catalog-page-1.png",
      "ground_truth": {
        "part_numbers": ["ABC-1234", "XYZ-5678", "DEF-9012"],
        "thai_words": ["ยาง", "น้ำมัน", "ปะกลงงพร้อม", "กรองอากาศ"],
        "table_rows": 10
      },
      "thresholds": {
        "min_confidence": 75,
        "min_part_accuracy": 0.8
      }
    }
  ]
}
```

## Generating Test Fixtures

### OCR Test Images

To create OCR test images:

1. **Create clean catalog pages** with known content
2. **Add variations**: rotated, low-quality, noisy
3. **Document ground truth** for each image

### Search Test Data

To create search test data:

1. **Insert test products** into database
2. **Create queries** with expected results
3. **Define relevance scores** for each result

## Notes

- All image files should be small (< 100KB) for fast test execution
- PDF files should contain actual catalog data for realistic testing
- Expected results serve as "ground truth" for validation
