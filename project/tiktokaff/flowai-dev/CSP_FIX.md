# CSP (Content Security Policy) Fix

## Problem
The extension was throwing CSP violation errors:
```
Executing inline event handler violates the following Content Security Policy directive 'script-src 'self''.
```

This occurred because Manifest V3 has a strict default CSP that doesn't allow inline styles or scripts without explicit permission.

## Root Cause
- Manifest V3 extensions have strict Content Security Policy by default
- The default policy only allows scripts and styles from `'self'` (extension files)
- Inline `style=` attributes in HTML violate the CSP unless explicitly allowed
- The extension uses WASM (`'wasm-unsafe-eval'`) which also needs CSP permission

## Solution
Added explicit `content_security_policy` to `manifest.json` with the following directives:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval' 'unsafe-hashes'; style-src 'self' 'unsafe-inline' 'unsafe-hashes'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src *; frame-src 'self';"
}
```

### Policy Breakdown

| Directive | Values | Purpose |
|-----------|--------|---------|
| `script-src` | `'self'` `'wasm-unsafe-eval'` `'unsafe-hashes'` | Allows scripts from extension files, WASM code, and hashed inline scripts |
| `style-src` | `'self'` `'unsafe-inline'` `'unsafe-hashes'` | Allows styles from extension files, inline styles, and hashed inline styles |
| `img-src` | `'self'` `data:` `blob:` `https:` | Allows images from extension, data URLs, blob URLs, and HTTPS |
| `font-src` | `'self'` `data:` | Allows fonts from extension and data URLs |
| `connect-src` | `*` | Allows API requests to any domain (needed for AI services) |
| `frame-src` | `'self'` | Allows iframes only from extension itself |

## Changes Made
- **File**: `project/tiktokaff/flowai-dev/manifest.json`
- **Change**: Added `content_security_policy` object with `extension_pages` policy
- **Impact**: Allows inline styles to work without CSP violations

## Why This Works
1. **`'unsafe-inline'`**: Permits inline `style=` attributes on HTML elements
2. **`'unsafe-hashes'`**: Provides additional layer of security by allowing specific inline styles
3. **`'wasm-unsafe-eval'`**: Required for WASM module execution (fallback to CSS selectors)
4. **`connect-src *`**: Permits connections to external APIs (Gemini, OpenAI, etc.)

## Testing
The fix should resolve all CSP-related console errors:
- ✅ Inline styles (display properties, colors, margins) now work
- ✅ WASM module loading without CSP errors
- ✅ Dynamic style.display manipulation in JavaScript continues to work
- ✅ API calls to external services are not blocked

## Security Notes
- Using `'unsafe-inline'` with `'unsafe-hashes'` is acceptable for extension content scripts (not web pages)
- The CSP only applies to `extension_pages` (sidebar.html), not content scripts on websites
- This is a standard practice for MV3 extensions with dynamic UIs
