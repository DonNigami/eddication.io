# MLSTMS - Refactored Codebase

## 📁 New Structure

The code has been refactored into modular, maintainable files using modern ES6+ JavaScript:

```
MLSTMS/Codebase/
├── Config.gs           # Configuration management
├── ApiClient.gs        # API communication
├── Utils.gs            # Utility functions
├── SheetManager.gs     # Google Sheets operations
└── README.md           # This file
```

## 🚀 Key Improvements

### 1. Modern JavaScript (ES6+)

- **Classes**: Object-oriented design with `ConfigManager`, `ApiClient`, `SheetManager`
- **Const/Let**: Block-scoped variables instead of `var`
- **Arrow Functions**: Cleaner syntax for callbacks
- **Template Literals**: String interpolation (already used)
- **Destructuring**: Extract values from objects/arrays
- **Optional Chaining**: Safe property access (`obj?.prop`)
- **Nullish Coalescing**: Default values (`??` operator)
- **Spread Operator**: Array/object manipulation
- **Array Methods**: `map`, `filter`, `reduce`, `find`, etc.

### 2. Better Organization

- **Separation of Concerns**: Each file has a single responsibility
- **Modular Design**: Easy to test and maintain individual components
- **Global Instances**: Shared instances (`configManager`, `apiClient`, `sheetManager`)
- **Backward Compatibility**: Original function names still work

### 3. Enhanced Utilities

- **Logging**: `smartLog()` with configurable levels
- **Rate Limiting**: `adaptiveSleep()` for optimal API performance
- **Data Extraction**: `getTripField()` with multiple field name support
- **Validation**: Helper functions for data validation
- **Array/Object Utils**: Common operations (`chunk`, `uniqueBy`, `groupBy`, etc.)

## 📦 Module Overview

### Config.gs

**Purpose**: Centralized configuration management

**Key Features**:
- `ConfigManager` class for all configuration operations
- Type-safe configuration access
- Performance presets (SAFE, BALANCED, TURBO)
- Batch state persistence

**Usage**:
```javascript
const config = configManager.getAll();
configManager.set('STATUS_ID', '4');
configManager.applyPerformancePreset('TURBO');
```

### ApiClient.gs

**Purpose**: Handle all API communication

**Key Features**:
- `ApiClient` class with authentication
- Auto token refresh on 401 errors
- Pagination support
- Connection testing and benchmarking

**Usage**:
```javascript
const trips = await apiClient.getTrips({ statusId: '4', limit: 50 });
const details = await apiClient.getTripDetails(tripId);
const benchmark = apiClient.benchmark();
```

### Utils.gs

**Purpose**: Common utility functions

**Key Features**:
- Logging utilities
- Rate limiting helpers
- Data extraction and filtering
- Date/time formatting
- Validation functions
- Array/object manipulation

**Usage**:
```javascript
smartLog('Processing trip...', 'NORMAL');
adaptiveSleep(lastResponseTime);
const filtered = filterTripsByOpenDateTime(trips, start, end);
```

### SheetManager.gs

**Purpose**: Google Sheets operations

**Key Features**:
- `SheetManager` class for sheet operations
- Duplicate detection and updates
- Automatic header creation
- Status checking

**Usage**:
```javascript
const stats = sheetManager.saveTrips(trips, false, true);
sheetManager.saveTripDetails(details, true, true);
const status = sheetManager.checkStatus();
```

## 🔧 Migration Guide

### For Existing Code

The refactored code maintains **backward compatibility** with the original `TripsToSheets.gs`. All original functions still work:

```javascript
// Still works!
setupConfig();
getConfig();
login();
getTrips();
getTripDetails(tripId);
saveTripsToSheet(trips);
saveTripDetailsToSheet(details);
```

### Using New Features

To use the new modular approach:

```javascript
// Get configuration
const config = configManager.getAll();

// Make API calls
const trips = apiClient.getTripsPaginated(0, 50);

// Save to sheets
const stats = sheetManager.saveTrips(trips, false, true);

// Use utilities
smartLog('Processing complete', 'NORMAL');
```

## 📝 Code Examples

### Example 1: Pull Today's Data

```javascript
function pullToday() {
  const today = getTodayString();

  // Set date range
  configManager.set('START_DATE', today);
  configManager.set('END_DATE', today);
  configManager.set('STATUS_ID', '');

  // Get data
  const response = apiClient.getTripsPaginated(0, 9999);
  const trips = response.data?.trips || [];

  // Save to sheets
  sheetManager.saveTrips(trips, false, true);
  sheetManager.saveTripDetails(trips, false, true);
}
```

### Example 2: Batch Processing with Progress

```javascript
function pullBatchWithProgress() {
  const config = configManager.getAll();
  const limit = parseInt(config.limit);

  let offset = 0;
  let totalProcessed = 0;

  while (true) {
    const response = apiClient.getTripsPaginated(offset, limit);
    const trips = response.data?.trips || [];

    if (trips.length === 0) break;

    // Get details for each trip
    const details = trips.map(trip => {
      const tripId = getTripField(trip, ['id', 'tripId']);
      return apiClient.getTripDetails(tripId);
    }).filter(Boolean);

    // Save to sheets
    sheetManager.saveTrips(trips, true, true);
    sheetManager.saveTripDetails(details, true, true);

    totalProcessed += trips.length;
    Logger.log(`✅ Processed ${totalProcessed} trips`);

    offset += limit;

    // Adaptive rate limiting
    adaptiveSleep(500);
  }
}
```

### Example 3: Custom Performance Mode

```javascript
function setCustomPerformance() {
  // Apply preset
  configManager.applyPerformancePreset('TURBO');

  // Or customize individual settings
  configManager.set('RATE_LIMIT_MS', '100');
  configManager.set('FAST_MODE', 'true');
  configManager.set('LOG_LEVEL', 'MINIMAL');

  // Benchmark API
  const benchmark = apiClient.benchmark();
  Logger.log(`API response time: ${benchmark.responseTime}ms`);
  Logger.log(`Recommended mode: ${benchmark.performanceMode}`);
}
```

## 🎯 Best Practices

### 1. Use Global Instances

```javascript
// ✅ Good
const config = configManager.getAll();

// ❌ Bad (creates new instance)
const newManager = new ConfigManager();
const config = newManager.getAll();
```

### 2. Refresh Configuration After Changes

```javascript
configManager.set('LIMIT', '100');
apiClient.refreshConfig(); // Refresh to get new values
```

### 3. Use Smart Logging

```javascript
// Only logs if level allows
smartLog('Detailed debug info', 'DEBUG');
smartLog('Normal progress', 'NORMAL');
smartLog('Critical error', 'MINIMAL');
```

### 4. Handle Errors Gracefully

```javascript
try {
  const trips = apiClient.getTrips();
  sheetManager.saveTrips(trips);
} catch (error) {
  Logger.log(`❌ Error: ${error.message}`);
  // Handle error
}
```

## 🔍 Debugging

### Enable Debug Logging

```javascript
configManager.set('LOG_LEVEL', 'DEBUG');
```

### Log Trip Fields

```javascript
logTripFields(trip); // Shows all fields in trip object
```

### Test API Connection

```javascript
const connected = apiClient.testConnection();
Logger.log(`Connection status: ${connected}`);
```

## 📊 Performance Tips

1. **Use Adaptive Rate Limiting**: Enabled by default for optimal speed
2. **Batch Processing**: Process in chunks to avoid timeouts
3. **Fast Mode**: Disable rate limiting for small datasets
4. **Performance Presets**: Use TURBO for fast APIs, SAFE for slow ones

## 🚧 Next Steps

1. **UI Components**: Extract HTML templates to separate files
2. **Main Logic**: Create `Main.gs` for orchestration functions
3. **Tests**: Add unit tests for utility functions
4. **Documentation**: Add JSDoc comments to all functions

## 📞 Support

For issues or questions:
- Check the original `TripsToSheets.gs` for reference
- Review Google Apps Script documentation
- Check logs: `View > Logs` in Apps Script editor

---

**Version**: 2.0.0 (Refactored)
**Last Updated**: 2026-03-22
**License**: Same as original project
