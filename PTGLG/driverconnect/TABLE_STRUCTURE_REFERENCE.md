# โครงสร้างตารางจริงใน Supabase

## ตาราง Origin
```
originKey     - Primary Key (TOP SR, MK, CP, SRT, SK)
name          - ชื่อต้นทาง (ไทยออยล์ ศรีราชา, คลังMK)
lat           - Latitude (13.10985, 13.37108873)
lng           - Longitude (100.913656, 100.000226)
radiusMeters  - รัศมี (300)
routeCode     - รหัสเส้นทาง (Z12, Z01, Z02, Z03)
```

### ตัวอย่างข้อมูล
| originKey | name             | lat         | lng         | routeCode |
|-----------|------------------|-------------|-------------|-----------|
| TOP SR    | ไทยออยล์ ศรีราชา | 13.10985    | 100.913656  | Z12       |
| MK        | คลังMK           | 13.37108873 | 100.000226  | Z01       |
| CP        | คลังCP           | 10.43757364 | 99.22090529 | Z02       |

## ตาราง Customer
```
stationKey    - Primary Key (1102, 1202, 1206, 1207, 1208)
stationKey2   - Duplicate key
name          - ชื่อลูกค้า (PTG-คลังชุมพร, PTC-คลังขอนแก่น)
lat           - Latitude (10.43757364, 16.67851456)
lng           - Longitude (99.22090529, 102.80198)
radiusMeters  - รัศมี (300)
email         - อีเมล
STD           - รหัส STD
```

### ตัวอย่างข้อมูล
| stationKey | name            | lat         | lng         |
|------------|-----------------|-------------|-------------|
| 1102       | PTG-คลังชุมพร   | 10.43757364 | 99.22090529 |
| 1202       | PTC-คลังชุมพร   | 10.43757364 | 99.22090529 |
| 1206       | PTC-คลังขอนแก่น | 16.67851456 | 102.80198   |
| 1207       | PTC-คลังลำปาง   | 18.29467435 | 99.41481973 |

## ตาราง Station
```
stationKey    - Primary Key (ZS184, ZS185, ZS186, ZS187, ZS188)
station_name  - ชื่อสถานี (น้ำพอง, พะเยา, แม่ใจ)
lat           - Latitude (16.678451, 19.196072)
lng           - Longitude (102.803971, 99.875543)
mobile        - เบอร์มือถือ
Name_Area     - ชื่อผู้รับผิดชอบพื้นที่
Phone_Area    - เบอร์โทรพื้นที่
Name_Region   - ชื่อผู้รับผิดชอบภูมิภาค
Phone_Region  - เบอร์โทรภูมิภาค
GPS           - พิกัด GPS แบบ string (16.678451,102.803971)
time_open     - เวลาเปิด-ปิด
depot_name    - ชื่อคลัง
plant code    - รหัสโรงงาน (S184, S185)
```

### ตัวอย่างข้อมูล
| stationKey | station_name | lat       | lng        | plant code |
|------------|--------------|-----------|------------|------------|
| ZS184      | น้ำพอง       | 16.678451 | 102.803971 | S184       |
| ZS185      | พะเยา        | 19.196072 | 99.875543  | S185       |
| ZS186      | แม่ใจ        | 19.349988 | 99.803925  | S186       |

## การใช้งานใน Code

### 1. Origin Lookup
```javascript
// route = "Z01123"
// routePrefix = "Z01"
const { data } = await supabase
  .from('origin')
  .select('originKey, name, lat, lng, radiusMeters, routeCode')
  .or(`routeCode.ilike.Z01%,originKey.ilike.Z01%`)
  .limit(1)
  .maybeSingle()
```

### 2. Customer Lookup
```javascript
// shipToCode = "1102"
const { data } = await supabase
  .from('customer')
  .select('stationKey, name, lat, lng, radiusMeters')
  .in('stationKey', ['1102', '1202'])
```

### 3. Station Lookup
```javascript
// shipToCode = "ZS184"
const { data } = await supabase
  .from('station')
  .select('stationKey, station_name, lat, lng')
  .in('stationKey', ['ZS184', 'ZS185'])
```

## Mapping ใน enrichStopsWithCoordinates()

```javascript
// Origin
originLat = parseFloat(originData.lat);
originLng = parseFloat(originData.lng);

// Customer (ใช้ stationKey เป็น key)
customerMap.set(c.stationKey, { 
  lat: parseFloat(c.lat), 
  lng: parseFloat(c.lng) 
});

// Station (ใช้ stationKey เป็น key)
stationMap.set(s.stationKey, { 
  lat: parseFloat(s.lat), 
  lng: parseFloat(s.lng) 
});
```

## ตัวอย่างการทำงาน

### ตัวอย่าง 1: Customer Stop
**Input:** stops with shipToCode
```json
{
  "seq": 1,
  "shipToCode": "1102",
  "shipToName": "PTG-คลังชุมพร",
  "destLat": null,
  "destLng": null
}
```

**Query Customer Table:**
```sql
SELECT stationKey, name, lat, lng, radiusMeters
FROM customer
WHERE stationKey IN ('1102')
```

**Output:** enriched stop
```json
{
  "seq": 1,
  "shipToCode": "1102",
  "shipToName": "PTG-คลังชุมพร",
  "destLat": 10.43757364,
  "destLng": 99.22090529
}
```

### ตัวอย่าง 2: Station Stop
**Input:** stops with shipToCode
```json
{
  "seq": 2,
  "shipToCode": "ZS184",
  "shipToName": "น้ำพอง",
  "destLat": null,
  "destLng": null
}
```

**Query Station Table:**
```sql
SELECT stationKey, station_name, lat, lng
FROM station
WHERE stationKey IN ('ZS184')
```

**Output:** enriched stop
```json
{
  "seq": 2,
  "shipToCode": "ZS184",
  "shipToName": "น้ำพอง",
  "destLat": 16.678451,
  "destLng": 102.803971
}
```

### ตัวอย่าง 3: Origin Stop
**Input:** stops with route
```json
{
  "seq": 1,
  "isOriginStop": true,
  "shipToName": "จุดเริ่มต้น",
  "destLat": null,
  "destLng": null
}
```

**Query Origin Table:** (route = "Z01123")
```sql
SELECT originKey, name, lat, lng, radiusMeters, routeCode
FROM origin
WHERE routeCode ILIKE 'Z01%' OR originKey ILIKE 'Z01%'
LIMIT 1
```

**Output:** enriched stop
```json
{
  "seq": 1,
  "isOriginStop": true,
  "shipToName": "จุดเริ่มต้น",
  "destLat": 13.37108873,
  "destLng": 100.000226
}
```

## หมายเหตุ

### ⚠️ Key Points
- **ตาราง origin:** ใช้ `originKey` เป็น primary key
- **ตาราง customer:** ใช้ `stationKey` เป็น primary key (ตัวเลข เช่น 1102, 1202)
- **ตาราง station:** ใช้ `stationKey` เป็น primary key (ขึ้นต้นด้วย Z เช่น ZS184, ZS185)
- **ทุกตาราง:** ใช้ `lat`, `lng` สำหรับพิกัด (ไม่ใช่ latitude, longitude)
- **การ query:** ต้อง `parseFloat()` เพราะบาง column อาจเป็น string
- **การ match:** ใช้ `shipToCode` match กับ `stationKey` ของทั้ง customer และ station

### 🔍 การแยก Customer vs Station
```javascript
// Customer: shipToCode เป็นตัวเลข (1102, 1202)
if (shipToCode.match(/^\d+$/)) {
  // Query customer table
}

// Station: shipToCode ขึ้นต้นด้วย Z (ZS184, ZS185)
if (shipToCode.startsWith('Z')) {
  // Query station table
}
```

### ✅ สิ่งที่ระบบทำ
1. ดึงพิกัดจาก **origin** table สำหรับ origin stops (ใช้ routeCode)
2. ดึงพิกัดจาก **customer** table สำหรับ customer stops (ใช้ stationKey)
3. ดึงพิกัดจาก **station** table สำหรับ station stops (ใช้ stationKey)
4. Enrich stops ด้วยพิกัดที่พบ
5. ถ้าไม่เจอพิกัดจะคงค่าเดิมไว้ (null)
