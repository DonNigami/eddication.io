// ===== File: config (config.gs) =====
/********************************
 * CONFIG: LINE / Main Sheet / zoile30Connect
 ********************************/

// ⚠️ ใส่ค่าให้ตรงกับ LINE Channel ของจริง
const CHANNEL_ACCESS_TOKEN = 'pIIWCDW03mWrY683D6/JtnNdbnAfXiWl0H4w7lrk0QvPxyHltJ74cI6jNKA/5daA23tLBGCPKWI+IMKhikzs36WVSsXCAxB8Iwe4gCJOIjkb9fxIV5tis1xkKEBAYW2xjA2uP2ov7QuXUTEI+xVQAQdB04t89/1O/w1cDnyilFU=';
const RICH_MENU_ID_MENU1   = 'richmenu-555df05125d319eccec615b05f85dd65';

// ไฟล์หลัก (มี register / userprofile / jobdata / Station / Origin / alcoholcheck / processdata)
const SHEET_ID             = '1UK6pdRrCGEjXmdtGe2FeSFflSimz0JhhGxAei_OKyLU';

// ไฟล์ zoile30Connect (ต้นทาง shipment/reference/destination)
const ZOILE_SHEET_ID       = '1iwPr3RSBUT4frRfyFJxW5C2qP-TPseEBW_80CDitbuE';

// โฟลเดอร์หลักสำหรับเก็บรูปเป่าแอลกอฮอล์ (จาก Google Drive)
const ALC_PARENT_FOLDER_ID = '1CMZBzQJ9to6TQKlx-Tp001Eq0sIbdy0P';

/********************************
 * Sheet Names (Main)
 ********************************/
const SHEET_REGISTER       = 'register';
const SHEET_USER_PROFILE   = 'userprofile';
const SHEET_JOBDATA        = 'jobdata';
const SHEET_STATION        = 'Station';
const SHEET_ORIGIN         = 'Origin';
const SHEET_ALCOHOL        = 'alcoholcheck';  // บันทึกการเป่าแอลกอฮอล์
const SHEET_REVIEW         = 'reviewdata';    // บันทึกการประเมิน + ลายเซ็น
const SHEET_ADMIN_LOG      = 'adminlog';      // บันทึกกิจกรรม admin
const SHEET_PROCESSDATA    = 'processdata';   // ✅ บันทึกข้อมูลผู้รับน้ำมัน (NEW)

// ✅ เพิ่ม: ชีท Admin (สำหรับ isAdminUser / checkadmin)
const SHEET_ADMIN          = 'userprofile';   // ถ้าชีทคุณชื่อไม่ใช่ "admin" ให้แก้ตรงนี้

/********************************
 * userprofile column index (1-based)
 ********************************/
const COL_USER_ID      = 1;  // A
const COL_DISPLAY_NAME = 2;  // B
const COL_PICTURE_URL  = 3;  // C
const COL_STATUS       = 4;  // D
const COL_CREATED_AT   = 5;  // E
const COL_UPDATED_AT   = 6;  // F
// G,H,I = คอลัมน์อื่น ๆ ที่อาจมีใช้งาน
const COL_USERTYPE     = 10; // J: usertype (ADMIN / DRIVER / ฯลฯ)

/********************************
 * zoile30Connect sheet names
 ********************************/
const ZOILE_SHEET_DATA  = 'data';
const ZOILE_SHEET_INPUT = 'InputZoile30';

/********************************
 * zoile30Connect!data column index (1-based)
 * ⚠️ หมายเหตุ: ค่านี้ต้องตรงกับโครงชีท data ของคุณจริง
 ********************************/
// A: Shipment No.
// E: Driver Name
// F: Distance
// M: Reference
// N: Ship to
// O: Ship to Name
// P: Material
// Q: Material Desc
// R: Delivery Qty
const Z_COL_SHIPMENT        = 1;   // A
const Z_COL_DRIVER_NAME     = 5;   // E
const Z_COL_DISTANCE        = 6;   // F
const Z_COL_REFERENCE       = 13;  // M
const Z_COL_SHIP_TO_CODE    = 14;  // N
const Z_COL_SHIP_TO_NAME    = 15;  // O
const Z_COL_MATERIAL        = 16;  // P
const Z_COL_MATERIAL_DESC   = 17;  // Q
const Z_COL_DELIVERY_QTY    = 18;  // R
const Z_COL_ROUTE           = 0;   // ไม่มี/ไม่ใช้

// ✅ เพิ่ม: Vehicle Description (ใน data)
// ถ้ารู้คอลัมน์จริงแล้ว “ใส่เลขให้ตรง” ได้เลย เช่น 6,7,8 ฯลฯ
// ตอนนี้ตั้ง 0 กันพัง
const Z_COL_VEHICLE_DESC    = 0;   // Vehicle Description (data)

/********************************
 * zoile30Connect!InputZoile30 column index (1-based)
 * ตามลำดับหัวคอลัมน์ที่คุณส่งมา
 ********************************/
// 1 Select
// 2 Shipment No.
// 3 Sts
// 4 Sts Text
// 5 Vehicle
// 6 Vehicle Description  ✅
// ...
// 12 Driver name
// 15 Distance
// 31 Reference
// 34 Ship to
// 35 Ship to Name
// 41 Material
// 42 Material Desc
// 43 Delivery Qty
// 14 Route
const ZI_COL_SHIPMENT       = 2;   // Shipment No.
const ZI_COL_VEHICLE_DESC   = 6;   // ✅ Vehicle Description
const ZI_COL_DRIVER_NAME    = 12;  // Driver name
const ZI_COL_DISTANCE       = 15;  // Distance
const ZI_COL_REFERENCE      = 31;  // Reference
const ZI_COL_SHIP_TO_CODE   = 34;  // Ship to
const ZI_COL_SHIP_TO_NAME   = 35;  // Ship to Name
const ZI_COL_MATERIAL       = 41;  // Material
const ZI_COL_MATERIAL_DESC  = 42;  // Material Desc
const ZI_COL_DELIVERY_QTY   = 43;  // Delivery Qty
const ZI_COL_ROUTE          = 14;  // Route

/********************************
 * jobdata column index (ไฟล์หลัก) (1-based)
 ********************************/
const J_COL_REFERENCE        = 1;  // A: referenceNo
const J_COL_SHIPMENT         = 2;  // B: shipmentNo
const J_COL_SHIPTO_CODE      = 3;  // C: shipToCode
const J_COL_SHIPTO_NAME      = 4;  // D: shipToName
const J_COL_STATUS           = 5;  // E: status ปัจจุบันของ stop
const J_COL_CHECKIN          = 6;  // F: checkInTime
const J_COL_CHECKOUT         = 7;  // G: checkOutTime
const J_COL_UPDATED_BY       = 8;  // H: updatedBy (userId)
const J_COL_SOURCE_ROW       = 9;  // I: sourceRow (zoile data row index)
const J_COL_CREATED_AT       = 10; // J: createdAt
const J_COL_UPDATED_AT       = 11; // K: updatedAt
const J_COL_DEST_LAT         = 12; // L
const J_COL_DEST_LNG         = 13; // M
const J_COL_RADIUS_M         = 14; // N
const J_COL_CHECKIN_LAT      = 15; // O
const J_COL_CHECKIN_LNG      = 16; // P
const J_COL_CHECKOUT_LAT     = 17; // Q
const J_COL_CHECKOUT_LNG     = 18; // R

// เวลาแต่ละสเต็ป
const J_COL_FUELING_TIME     = 19; // S: fuelingTime
const J_COL_UNLOAD_DONE_TIME = 20; // T: unloadDoneTime
const J_COL_REVIEWED_TIME    = 21; // U: reviewedTime (คงไว้ของเดิม)
const J_COL_JOB_CLOSED_AT    = 22; // V: jobClosedAt

// Distance และเลขไมล์
const J_COL_DISTANCE_KM      = 23; // W: Distance จาก zoile
const J_COL_CHECKIN_ODO      = 24; // X: เลขไมล์ตอน Check-in

// 🔹 ข้อมูลจบทริป (Y–AC)
const J_COL_TRIP_END_ODO     = 25; // Y: tripEndOdo
const J_COL_TRIP_END_LAT     = 26; // Z: tripEndLat
const J_COL_TRIP_END_LNG     = 27; // AA: tripEndLng
const J_COL_TRIP_END_PLACE   = 28; // AB: tripEndPlace
const J_COL_TRIP_ENDED_AT    = 29; // AC: tripEndedAt

// ✅ NEW: เก็บ Vehicle Description (มาจาก InputZoile30 เท่านั้น)
const J_COL_VEHICLE_DESC     = 30; // AD: vehicleDescription

// ✅ NEW: processdataTime (เวลาบันทึกข้อมูลผู้รับน้ำมัน) แยกคอลัมน์ใหม่
const J_COL_PROCESSDATA_TIME = 31; // AE: processdataTime

// last col ต้องครอบคลุมถึง AE
const J_COL_LAST             = J_COL_PROCESSDATA_TIME;

/********************************
 * Station column index (1-based)
 * Station: A=stationKey, B=stationKey2, C=name, D=lat, E=lng, F=radiusMeters
 ********************************/
const ST_COL_KEY1      = 1;  // A
const ST_COL_KEY2      = 2;  // B
const ST_COL_NAME      = 3;  // C
const ST_COL_LAT       = 4;  // D
const ST_COL_LNG       = 5;  // E
const ST_COL_RADIUS_M  = 6;  // F

/********************************
 * Origin column index (1-based)
 * A: originKey
 * B: name
 * C: lat
 * D: lng
 * E: radiusMeters
 * F: routeCode
 ********************************/
const OR_COL_CODE        = 1;
const OR_COL_NAME        = 2;
const OR_COL_LAT         = 3;
const OR_COL_LNG         = 4;
const OR_COL_RADIUS_M    = 5;
const OR_COL_ROUTE_CODE  = 6;  // ✅ routeCode
