# Supabase Edge Function: Geocode

This Edge Function provides server-side geocoding using Nominatim (OpenStreetMap), avoiding CORS issues when calling from the browser.

## Deploy

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Click **New Function**
4. Name it `geocode`
5. Copy the contents of `index.ts` into the editor
6. Click **Deploy**

### Option 2: Using Supabase CLI

```bash
# From the driverapp directory
cd supabase
supabase functions deploy geocode
```

## Usage

The Edge Function is automatically called by the location service when geocoding addresses.

```javascript
const { data, error } = await supabase.functions.invoke('geocode', {
  body: { address: 'บริษัท ชุน ยี อินเตอร์เนชั่นแนล เทรดดิ้ง จำกัด', country: 'th' }
});

if (data && data.lat && data.lng) {
  console.log(`Coordinates: ${data.lat}, ${data.lng}`);
}
```

## How it works

1. The function receives an address and optional country code
2. It calls Nominatim API server-side (no CORS issues)
3. Returns the coordinates or an error

## Alternative: Longdo Map API (Better for Thailand)

For better Thai address coverage, consider using Longdo Map API instead:

1. Sign up at https://map.longdo.com/
2. Get an API key
3. Modify the Edge Function to use Longdo's geocoding API:

```typescript
const longdoUrl = `https://search.longdo.com/mapsearch/ajax/suggest`;
const params = new URLSearchParams({
  key: Deno.env.get('LONGDO_API_KEY')!,
  keyword: address,
  limit: '1',
});

const response = await fetch(`${longdoUrl}?${params.toString()}`);
```
