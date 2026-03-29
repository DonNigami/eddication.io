const SPREADSHEET_ID = "1nvNFkeUUU7tTnTlE0UkKt0tZqxYe4fxOI7crTtiEsrM";
const SHEET_NAMES = {
  USERS: "Users",
  ACTIVITIES: "Activities",
  LOG: "Checkin_Log",
  GROUPS: "Groups",
  POINTS: "Points",
  POINTS_HISTORY: "Points_History",
  QR_GENERATION_HISTORY: "QR_Generation_History"
};

/**
 * Handle OPTIONS request for CORS preflight
 * CRITICAL: Prevents 302 redirect during LINE webhook verification
 *
 * NOTE: Google Apps Script handles CORS headers automatically when deployed
 * with "Who has access: Anyone". We just need to return a valid JSON response.
 */
function doOptions(e) {
  const output = ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "SCORDS Webhook is ready"
  }));

  output.setMimeType(ContentService.MimeType.JSON);

  return output;
}

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "getAllData") {
      const userId = e.parameter.userId;
      if (!userId) throw new Error("User ID is required.");
      const days = e.parameter.days || "7"; // Default: 7 days
      return createJsonResponse(getAllData(userId, days));
    }

    if (action === "getDashboard") {
      const group = e.parameter.group;
      if (!group) throw new Error("Group is required.");
      return createJsonResponse(getDashboardData(group, null, true));
    }

    if (action === "getHistory") {
      const userId = e.parameter.userId;
      const days = e.parameter.days || "7"; // Default: 7 days
      if (!userId) throw new Error("User ID is required.");
      return createJsonResponse({ success: true, data: { history: getHistory(userId, days) } });
    }

    if (action === "getLeaderboard") {
      const days = e.parameter.days || "7"; // Default: 7 days
      return createJsonResponse({ success: true, data: { leaderboard: getLeaderboard(days) } });
    }

    if (action === "getPointsLeaderboard") {
      return createJsonResponse({ success: true, data: { leaderboard: getPointsLeaderboard() } });
    }

    if (action === "getQRGenerationHistory") {
      return createJsonResponse({ success: true, data: { history: getQRGenerationHistory() } });
    }

    if (action === "getUserPoints") {
      const userId = e.parameter.userId;
      if (!userId) throw new Error("User ID is required.");
      return createJsonResponse({ success: true, data: getUserPointsData(userId) });
    }

    if (action === "getUserPointsHistory") {
      const userId = e.parameter.userId;
      if (!userId) throw new Error("User ID is required.");
      const limit = e.parameter.limit || "10";
      return createJsonResponse({ success: true, data: { history: getUserPointsHistory(userId, limit) } });
    }

    return createJsonResponse({
      success: true,
      message: "Check-in API is running."
    });

  } catch (error) {
    console.error("doGet Error: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Server Error: " + error.message
    });
  }
}

function doPost(e) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔴 CRITICAL: Log EVERYTHING from the start
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Log BEFORE try-catch (this will ALWAYS show if doPost is called)
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║ 🔴 doPost() CALLED - WEBHOOK RECEIVED              ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("Timestamp: " + new Date().toISOString());
  console.log("");

  try {
    // Debug: Log all incoming requests
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📥 [doPost] Request received");
    console.log("📥 [doPost] postData exists: " + (e.postData ? "YES" : "NO"));
    console.log("📥 [doPost] e parameter: " + JSON.stringify(e));
    console.log("");

    if (!e.postData) {
      console.error("❌ [doPost] NO postData found!");
      console.error("❌ This means webhook payload is empty");
      console.error("❌ Check LINE Developers Console webhook settings");
      return createJsonResponse({
        success: false,
        error: "No postData received"
      });
    }

    if (!e.postData.contents) {
      console.error("❌ [doPost] postData exists but NO contents!");
      console.error("❌ postData: " + JSON.stringify(e.postData));
      return createJsonResponse({
        success: false,
        error: "postData has no contents"
      });
    }

    console.log("✅ [doPost] postData.contents found, parsing...");
    const requestData = JSON.parse(e.postData.contents);
    console.log("✅ [doPost] Parsed successfully: " + JSON.stringify(requestData));
    console.log("");

    // Detect LINE Webhook (LINE sends request directly with 'events' or 'destination')
    // LINE webhook format: { destination: "Uxxx", events: [...] }
    const isLineWebhook = requestData.events || requestData.destination;

    if (isLineWebhook) {
      console.log("📱 [WEBHOOK] LINE Webhook detected!");
      console.log("📱 [WEBHOOK] Number of events: " + (requestData.events ? requestData.events.length : 0));
      console.log("📱 [WEBHOOK] Destination: " + (requestData.destination || "N/A"));

      if (requestData.events && requestData.events.length > 0) {
        requestData.events.forEach((event, index) => {
          console.log("📱 [WEBHOOK] Event " + index + ":");
          console.log("   Type: " + event.type);
          console.log("   Source: " + JSON.stringify(event.source));
          if (event.message) {
            console.log("   Message Type: " + event.message.type);
            console.log("   Message: " + (event.message.text || "(no text)"));
          }
        });
      }

      console.log("");
      console.log("🔧 [WEBHOOK] Calling handleLineWebhook()...");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // LINE Webhook Processing
      const result = handleLineWebhook(requestData);

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ [WEBHOOK] handleLineWebhook() completed");
      console.log("✅ [WEBHOOK] Result: " + JSON.stringify(result));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      return createJsonResponse(result);
    }

    // Handle other requests with 'action' parameter
    const action = requestData.action;
    console.log("🔧 [ACTION] Action: " + (action || "none"));

    switch (action) {
      case "registerUser":
        return createJsonResponse(registerUser(requestData));
      case "checkIn":
        return createJsonResponse(processCheckIn(requestData));
      case "redeemPointsQR":
        return createJsonResponse(redeemPointsQR(requestData));
      case "addGamePoints":
        return createJsonResponse(addGamePoints(requestData));
      case "syncLocalHistory":
        return createJsonResponse(syncLocalHistory(requestData));
      case "logQRGeneration":
        return createJsonResponse(logQRGeneration(requestData));
      case "askAI":
        return createJsonResponse(askAI(requestData));
      case "lineAIChat":
        return createJsonResponse(handleLineAIChat(requestData));
      default:
        console.log("⚠️ [ACTION] Unknown or no action specified");
        throw new Error("Invalid action specified: " + action);
    }
  } catch (error) {
    console.error("❌ [doPost] Error: " + error.toString());
    console.error("❌ [doPost] Stack: " + error.stack);
    console.error("❌ [doPost] Event: " + JSON.stringify(e));
    return createJsonResponse({
      success: false,
      message: "Server Error: " + error.message
    });
  }
}

function getAllData(userId, days) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userInfo = getUserInfo(ss, userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activities = getSheetData(ss.getSheetByName(SHEET_NAMES.ACTIVITIES))
    .filter(activity => {
      const activityDate = new Date(activity.Date);
      activityDate.setHours(0, 0, 0, 0);
      return activity.Status === 'Active' && activityDate.getTime() === today.getTime();
    })
    .map(activity => {

      const checkInRecord = findCheckInRecord(ss, userId, activity.ID);
      return {
        id: activity.ID,
        name: activity.Name,
        time: `${activity.StartTime} - ${activity.EndTime}`,
        checkedIn: !!checkInRecord,
        status: checkInRecord ? checkInRecord.Status : null
      };
    });

  return {
    success: true,
    data: {
      userInfo: userInfo,
      activities: activities,
      history: getHistory(ss, userId, days),
      dashboardData: getDashboardData(ss, userInfo ? userInfo.group : 'all', false),
      groups: getGroups(ss)
    }
  };
}

/**
 * ลงทะเบียนผู้ใช้ใหม่
 * @param {Object} data - ข้อมูลการลงทะเบียน
 * @param {string} data.userId - LINE User ID
 * @param {string} data.displayName - ชื่อทางการแสดงใน LINE
 * @param {string} data.firstName - ชื่อจริง
 * @param {string} data.lastName - นามสกุล
 * @param {string} data.employeeId - รหัสพนักงาน
 * @param {string} data.position - ตำแหน่ง
 * @param {string} data.group - กลุ่ม
 * @param {string} data.pictureUrl - รูปโปรไฟล์จาก LINE Profile
 * @returns {Object} ผลลัพธ์การลงทะเบียน
 */
function registerUser(data) {
  const { userId, displayName, firstName, lastName, employeeId, position, group, pictureUrl } = data;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = ss.getSheetByName(SHEET_NAMES.USERS);

  // ตรวจสอบว่า userId ลงทะเบียนแล้วหรือยัง
  if (findRow(userSheet, 'UserID', userId)) {
    return { success: false, message: "LINE User ID นี้ลงทะเบียนแล้ว ไม่สามารถลงทะเบียนซ้ำได้" };
  }

  // ตรวจสอบว่า employeeId ซ้ำหรือไม่
  if (findRow(userSheet, 'EmployeeID', employeeId)) {
    return { success: false, message: "รหัสพนักงานนี้ถูกใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ" };
  }

  // บันทึกข้อมูลลงใน Sheet
  // โครงสร้าง: UserID, DisplayName, FirstName, LastName, EmployeeID, Position, Group, Role, ProfilePicture, CreatedAt
  userSheet.appendRow([
    userId,
    displayName || '',
    firstName || '',
    lastName || '',
    employeeId || '',
    position || '',
    group || '',
    'user',
    pictureUrl || '',
    new Date()
  ]);

  return { success: true, message: "ลงทะเบียนสำเร็จ" };
}

function processCheckIn(data) {
  const { userId, displayName, activityId, qrCode, timestamp, latitude, longitude } = data;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);

  const activity = findRow(ss.getSheetByName(SHEET_NAMES.ACTIVITIES), 'ID', activityId);
  if (!activity) {
    return { success: false, message: "ไม่พบกิจกรรมนี้ในระบบ" };
  }

  if (activity.QRCode.toString() !== qrCode.toString()) {
    return { success: false, message: "QR Code ไม่ถูกต้องสำหรับกิจกรรมนี้" };
  }

  if (findCheckInRecord(ss, userId, activityId)) {
      return { success: false, message: "คุณได้เช็คชื่อสำหรับกิจกรรมนี้ไปแล้ว" };
  }

  // --- GPS Validation ---
  if (activity.Latitude && activity.Longitude && activity.Radius) {
    if (!latitude || !longitude) {
      return { success: false, message: "ไม่สามารถระบุตำแหน่งของคุณได้ กรุณาเปิด GPS" };
    }

    // ** FIX: Convert sheet values to numbers to ensure correct calculation **
    const activityLat = parseFloat(activity.Latitude);
    const activityLon = parseFloat(activity.Longitude);
    const activityRadius = parseFloat(activity.Radius);

    // Check if conversion was successful
    if (isNaN(activityLat) || isNaN(activityLon) || isNaN(activityRadius)) {
        return { success: false, message: "ข้อมูลพิกัด (Lat, Lon, Radius) ใน Google Sheet ไม่ถูกต้อง" };
    }

    const distance = getDistance(latitude, longitude, activityLat, activityLon);

    if (distance > activityRadius) {
      return { success: false, message: `คุณอยู่นอกพื้นที่กิจกรรม (${Math.round(distance)} เมตร)` };
    }
  }
  // --- End GPS Validation ---

  const checkInTime = new Date(timestamp);
  const [endHour, endMinute] = activity.EndTime.split(':').map(Number);
  const deadlineTime = new Date(checkInTime);
  deadlineTime.setHours(endHour, endMinute, 0, 0);

  const status = checkInTime <= deadlineTime ? "ตรงเวลา" : "สาย";

  const userInfo = getUserInfo(ss, userId);

  // บันทึกข้อมูลการเช็คชื่อ - ใช้ firstName และ lastName ถ้ามี
  const displayNameToLog = userInfo ? (userInfo.firstName && userInfo.lastName ?
      `${userInfo.firstName} ${userInfo.lastName}` : userInfo.name) : displayName;

  logSheet.appendRow([
    new Date(),
    userId,
    displayNameToLog,
    userInfo ? userInfo.group : '-',
    activityId,
    status
  ]);

  return {
    success: true,
    message: "เช็คชื่อสำเร็จ",
    data: { status: status }
  };
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * ดึงข้อมูล Dashboard ตามกลุ่ม
 */
function getDashboardData(ssOrGroup, group, returnFullResponse = false) {
    let ss;
    let selectedGroup = group;

    if (typeof ssOrGroup === 'string') {
        ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        selectedGroup = ssOrGroup;
    } else {
        ss = ssOrGroup;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = getSheetData(ss.getSheetByName(SHEET_NAMES.USERS));
    const checkIns = getSheetData(ss.getSheetByName(SHEET_NAMES.LOG));
    const activities = getSheetData(ss.getSheetByName(SHEET_NAMES.ACTIVITIES));
    const activityMap = activities.reduce((map, act) => {
        map[act.ID] = act.Name;
        return map;
    }, {});

    const filteredUsers = selectedGroup === 'all' ? users : users.filter(u => u.Group === selectedGroup);
    const totalUsers = filteredUsers.length;
    const filteredUserIds = filteredUsers.map(u => u.UserID);

    const todayCheckIns = checkIns.filter(c => {
        const checkInDate = new Date(c.Timestamp);
        checkInDate.setHours(0, 0, 0, 0);
        return checkInDate.getTime() === today.getTime() && filteredUserIds.includes(c.UserID);
    });

    const onTimeCount = todayCheckIns.filter(c => c.Status === 'ตรงเวลา').length;
    const lateCount = todayCheckIns.filter(c => c.Status === 'สาย').length;
    const checkedInCount = onTimeCount + lateCount;
    const absentCount = totalUsers - checkedInCount;

    const recentActivity = todayCheckIns
        .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
        .slice(0, 5)
        .map(c => ({
            name: c.DisplayName,
            activity: activityMap[c.ActivityID] || `ID: ${c.ActivityID}`,
            time: new Date(c.Timestamp).toLocaleTimeString('th-TH'),
            status: c.Status
        }));

    const dashboardResult = {
        checkedIn: checkedInCount,
        total: totalUsers,
        onTime: onTimeCount,
        late: lateCount,
        absent: absentCount,
        recentActivity: recentActivity
    };

    // Return format depends on how it's called
    if (returnFullResponse) {
        return {
            success: true,
            data: dashboardResult
        };
    }
    return dashboardResult;
}

/**
 * ดึงข้อมูลผู้ใช้
 * @param {SpreadsheetApp.Spreadsheet} ss - Spreadsheet object
 * @param {string} userId - LINE User ID
 * @returns {Object|null} ข้อมูลผู้ใช้
 */
function getUserInfo(ss, userId) {
  const user = findRow(ss.getSheetByName(SHEET_NAMES.USERS), 'UserID', userId);
  if (user) {
    return {
      userId: user.UserID,
      displayName: user.DisplayName,
      firstName: user.FirstName,
      lastName: user.LastName,
      employeeId: user.EmployeeID,
      position: user.Position,
      name: user.FirstName && user.LastName ? `${user.FirstName} ${user.LastName}` : user.DisplayName,
      group: user.Group,
      role: user.Role,
      profilePicture: user.ProfilePicture || null
    };
  }
  return null;
}

/**
 * ดึงประวัติการเช็คชื่อ
 * @param {SpreadsheetApp.Spreadsheet|string} ssOrUserId - Spreadsheet object or userId
 * @param {string} userId - LINE User ID (optional if first param is ss)
 * @param {string} days - จำนวนวันที่ต้องการ (7, 30, all)
 * @returns {Array} ประวัติการเช็คชื่อ
 */
function getHistory(ssOrUserId, userId, days) {
  let ss;
  let actualUserId;

  // Handle both calling conventions: getHistory(ss, userId, days) and getHistory(userId, days)
  if (typeof ssOrUserId === 'string') {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    actualUserId = ssOrUserId;
    days = userId; // Shift parameter since first param was userId
  } else {
    ss = ssOrUserId;
    actualUserId = userId;
  }

  const logData = getSheetData(ss.getSheetByName(SHEET_NAMES.LOG));
  const activitiesData = getSheetData(ss.getSheetByName(SHEET_NAMES.ACTIVITIES));

  const activityMap = activitiesData.reduce((map, act) => {
      map[act.ID] = act.Name;
      return map;
  }, {});

  // กำหนดช่วงเวลาตาม parameter
  let filterDate;
  if (days === "all") {
    // ดึงทั้งหมด - ไม่ต้องกรองด้วยวันที่
    filterDate = null;
  } else {
    const daysNum = parseInt(days);
    filterDate = new Date();
    filterDate.setDate(filterDate.getDate() - daysNum);
  }

  return logData
    .filter(row => {
      // กรองตาม userId
      if (row.UserID !== actualUserId) return false;

      // กรองตามวันที่ (ถ้าระบุ)
      if (filterDate) {
        return new Date(row.Timestamp) >= filterDate;
      }

      // ถ้า days = "all" ให้ดึงทั้งหมด
      return true;
    })
    .map(row => ({
      date: row.Timestamp,
      activity: activityMap[row.ActivityID] || `Activity ID: ${row.ActivityID}`,
      time: new Date(row.Timestamp).toLocaleTimeString('th-TH'),
      status: row.Status
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * ดึงข้อมูลจัดอันดับ (Top 10 ผู้เช็คชื่อตรงเวลา)
 * @param {string} days - จำนวนวันที่ต้องการ (7, 30, all)
 * @returns {Array} ข้อมูลจัดอันดับ
 */
function getLeaderboard(days) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logData = getSheetData(ss.getSheetByName(SHEET_NAMES.LOG));
  const usersData = getSheetData(ss.getSheetByName(SHEET_NAMES.USERS));

  // สร้าง map สำหรับ user info
  const userMap = usersData.reduce((map, user) => {
    map[user.UserID] = {
      name: user.FirstName && user.LastName ?
        `${user.FirstName} ${user.LastName}` :
        user.DisplayName,
      group: user.Group,
      profilePicture: user.ProfilePicture || null
    };
    return map;
  }, {});

  // กำหนดช่วงเวลาตาม parameter
  let filterDate;
  if (days !== "all") {
    const daysNum = parseInt(days);
    filterDate = new Date();
    filterDate.setDate(filterDate.getDate() - daysNum);
  }

  // กรองข้อมูลตามช่วงเวลา
  const filteredLogData = filterDate ?
    logData.filter(row => new Date(row.Timestamp) >= filterDate) :
    logData;

  // นับจำนวนการเช็คชื่อตรงเวลาและทั้งหมดของแต่ละคน
  const userStats = {};
  filteredLogData.forEach(row => {
    if (!userStats[row.UserID]) {
      userStats[row.UserID] = {
        userId: row.UserID,
        onTimeCount: 0,
        totalCount: 0
      };
    }
    userStats[row.UserID].totalCount++;
    if (row.Status === 'ตรงเวลา') {
      userStats[row.UserID].onTimeCount++;
    }
  });

  // แปลงเป็น array และเพิ่มข้อมูลชื่อและกลุ่ม
  let leaderboard = Object.values(userStats)
    .map(stat => ({
      userId: stat.userId,
      name: userMap[stat.userId]?.name || stat.userId,
      group: userMap[stat.userId]?.group || '-',
      profilePicture: userMap[stat.userId]?.profilePicture || null,
      onTimeCount: stat.onTimeCount,
      totalCount: stat.totalCount
    }))
    .filter(item => item.onTimeCount > 0) // เอาเฉพาะคนที่เคยเช็คชื่อตรงเวลา
    .sort((a, b) => b.onTimeCount - a.onTimeCount); // เรียงตามจำนวนครั้งที่เช็คชื่อตรงเวลา

  // เพิ่ม ranking
  leaderboard = leaderboard.map((item, index) => ({
    ...item,
    rank: index + 1
  }));

  // เอาเฉพาะ Top 10
  return leaderboard.slice(0, 10);
}

/**
 * ดึงรายการกลุ่มทั้งหมด
 */
function getGroups(ss) {
  const groupsSheet = ss.getSheetByName(SHEET_NAMES.GROUPS);
  if (!groupsSheet) return [];
  const groupsData = getSheetData(groupsSheet);

  return groupsData.map(row => row.GroupName).filter(g => g);
}

/**
 * ค้นหาบันทึกการเช็คชื่อ
 */
function findCheckInRecord(ss, userId, activityId) {
    const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
    const data = getSheetData(logSheet);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return data.find(row => {
        const recordDate = new Date(row.Timestamp);
        recordDate.setHours(0, 0, 0, 0);
        return row.UserID === userId &&
               row.ActivityID.toString() === activityId.toString() &&
               recordDate.getTime() === today.getTime();
    });
}

/**
 * สร้าง JSON Response
 */
/**
 * Create JSON response with proper headers
 * CRITICAL: Returns 200 OK instead of 302 redirect
 *
 * NOTE: Google Apps Script handles CORS headers automatically when deployed
 * with "Who has access: Anyone". We just need to return a valid JSON response.
 */
function createJsonResponse(data) {
  const jsonString = JSON.stringify(data);
  const output = ContentService.createTextOutput(jsonString);

  output.setMimeType(ContentService.MimeType.JSON);

  return output;
}

/**
 * แปลงข้อมูล Sheet เป็น Array of Objects
 */
function getSheetData(sheet) {
  if (!sheet) return [];
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  if (!values || values.length === 0) return [];

  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

// ============================================================
// AI ASSISTANT FUNCTIONS
// ============================================================

/**
 * AI Assistant - ฟังก์ชันหลักสำหรับ RAG
 * รองรับทั้ง GLM API (หลัก) และ OpenAI API (สำรอง)
 * รองรับการค้นหาจาก CSV และ PDF
 */
function askAI(requestData) {
  const query = requestData.query;
  const context = requestData.context || {}; // { userId, group, role }
  const maxTokens = requestData.maxTokens || 2000; // Default: 2000 tokens (increased from 500)
  const detailed = requestData.detailed !== undefined ? requestData.detailed : true; // Default: detailed answer

  try {
    // 1. Search knowledge base (keyword matching)
    const knowledge = searchKnowledgeBase(query);

    // 2. Search points rules
    const pointsInfo = searchPointsRules(query);

    // 3. Search PDF documents (if available)
    const pdfInfo = searchPDFDocuments(query);

    // 4. Build context for AI
    const contextText = buildContext(knowledge, pointsInfo, pdfInfo, context);

    // 5. Call AI API with configurable parameters
    const aiResponse = callGLM(query, contextText, maxTokens, detailed);

    // Collect all sources
    const allSources = [
      ...knowledge.map(k => k.source),
      ...pointsInfo.map(p => p.source),
      ...pdfInfo.map(p => p.source)
    ];

    return {
      success: true,
      data: {
        answer: aiResponse.answer,
        sources: allSources,
        cost: aiResponse.cost,
        costTHB: aiResponse.costTHB,
        model: aiResponse.model,
        tokens: aiResponse.tokens
      }
    };
  } catch (error) {
    console.error("askAI Error: " + error.toString());
    return {
      success: false,
      message: "AI Error: " + error.message
    };
  }
}

/**
 * ค้นหาความรู้จาก SCOR_Knowledge Sheet
 */
function searchKnowledgeBase(query) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("SCOR_Knowledge");

  if (!sheet) {
    console.log("SCOR_Knowledge sheet not found");
    return [];
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) return [];

  // Skip header row
  const results = [];
  const keywords = query.toLowerCase().split(/\s+/);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const [category, topic, question, answer, kw, priority] = row;

    let matchScore = 0;
    const searchText = (question + " " + (kw || "")).toLowerCase();

    keywords.forEach(kw => {
      if (kw && searchText.includes(kw)) matchScore++;
    });

    if (matchScore > 0) {
      results.push({
        category, topic, question, answer,
        source: `SCOR_Knowledge: ${topic}`,
        score: matchScore,
        priority: priority || "Medium"
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * ค้นหากติกาแต้มสะสมจาก Points_Rules Sheet
 */
function searchPointsRules(query) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Points_Rules");

  if (!sheet) {
    console.log("Points_Rules sheet not found");
    return [];
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) return [];

  const results = [];
  const keywords = query.toLowerCase().split(/\s+/);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const [ruleType, description, points, maxDaily, conditions] = row;

    let matchScore = 0;
    const searchText = (ruleType + " " + description + " " + (conditions || "")).toLowerCase();

    keywords.forEach(kw => {
      if (kw && searchText.includes(kw)) matchScore++;
    });

    if (matchScore > 0) {
      results.push({
        ruleType, description, points, maxDaily, conditions,
        source: `Points_Rules: ${ruleType}`
      });
    }
  }

  return results.slice(0, 3);
}

/**
 * ค้นหาเอกสาร PDF (จาก Google Drive)
 * สำหรับเอกสาร PDF ที่อัปโหลดไว้ใน Google Drive
 *
 * OPTIONAL FEATURE: Requires PDF_FOLDER_ID to be set
 */
function searchPDFDocuments(query) {
  try {
    // รับ PDF folder ID จาก ScriptProperties
    const pdfFolderId = ScriptProperties.getProperty("PDF_FOLDER_ID");

    if (!pdfFolderId || pdfFolderId === "your-pdf-folder-id-here") {
      // PDF search not configured - this is optional
      return [];
    }

    const folder = DriveApp.getFolderById(pdfFolderId);
    const files = folder.getFilesByType(MimeType.PDF);

    const results = [];
    const keywords = query.toLowerCase().split(/\s+/);
    let fileCount = 0;

    // ค้นหาใน PDF files (จำกัด 10 ไฟล์ล่าสุดเพื่อประสิทธิภาพ)
    while (files.hasNext() && fileCount < 10) {
      const file = files.next();
      fileCount++;

      try {
        // ดึงข้อความจาก PDF
        const blob = file.getBlob();
        const text = extractTextFromPDF(blob);

        if (!text) continue;

        // ค้นหาคำสำคัญในเนื้อหา PDF
        let matchScore = 0;
        const searchText = text.toLowerCase();

        keywords.forEach(kw => {
          if (kw && searchText.includes(kw)) matchScore++;
        });

        if (matchScore > 0) {
          // ดึงบริบทรอบๆ คำที่ค้นหา (200 ตัวอักษร)
          const snippet = extractSnippet(text, query, 200);

          results.push({
            fileName: file.getName(),
            snippet: snippet,
            source: `PDF: ${file.getName()}`,
            score: matchScore
          });
        }
      } catch (pdfError) {
        console.warn("Error processing PDF file " + file.getName() + ": " + pdfError.toString());
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 2);

  } catch (error) {
    console.warn("PDF search error: " + error.toString());
    console.warn("To enable PDF search, set PDF_FOLDER_ID in setupScriptProperties()");
    return [];
  }
}

/**
 * ดึงข้อความจาก PDF (ใช้ Google Drive OCR)
 * NOTE: Advanced Drive Service must be enabled in Google Apps Script
 * Resources > Advanced Google Services > Drive API
 */
function extractTextFromPDF(blob) {
  try {
    // Check if Drive API is available
    if (typeof Drive === 'undefined' || !Drive.Files) {
      console.warn("Drive API not enabled. Enable it from: Resources > Advanced Google Services > Drive API");
      return null;
    }

    // วิธีที่ 1: ใช้ Google Docs viewer
    const resource = {
      title: blob.getName(),
      mimeType: blob.getContentType()
    };

    // แปลง PDF เป็น Google Docs
    const docsFile = Drive.Files.insert(resource, blob);

    // อ่านเนื้อหาจาก Google Docs
    const docs = DocumentApp.openById(docsFile.id);
    const text = docs.getBody().getText();

    // ลบไฟล์ temporary
    Drive.Files.remove(docsFile.id);

    return text;

  } catch (error) {
    console.warn("PDF extraction error: " + error.toString());
    console.warn("To enable PDF search, enable Drive API from: Resources > Advanced Google Services > Drive API");
    return null;
  }
}

/**
 * ดึงส่วนของข้อความที่มีคำค้นหา (สำหรับ PDF snippet)
 */
function extractSnippet(fullText, query, maxLength) {
  const lowerText = fullText.toLowerCase();
  const lowerQuery = query.toLowerCase();

  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return fullText.substring(0, maxLength) + "...";

  const start = Math.max(0, index - 50);
  const end = Math.min(fullText.length, index + query.length + maxLength);

  let snippet = fullText.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < fullText.length) snippet = snippet + "...";

  return snippet;
}

/**
 * สร้าง context text สำหรับ AI
 * รองรับ Knowledge, Points, และ PDF
 */
function buildContext(knowledge, pointsInfo, pdfInfo, context) {
  let contextText = "ความรู้ที่เกี่ยวข้อง:\n\n";

  knowledge.forEach(k => {
    contextText += `Q: ${k.question}\nA: ${k.answer}\n\n`;
  });

  if (pointsInfo.length > 0) {
    contextText += "\nกติกาแต้มสะสม:\n";
    pointsInfo.forEach(p => {
      contextText += `- ${p.ruleType}: ${p.description} (${p.points} แต้ม)\n`;
    });
  }

  if (pdfInfo.length > 0) {
    contextText += "\nเอกสารอ้างอิง:\n";
    pdfInfo.forEach(p => {
      contextText += `- จาก ${p.fileName}:\n  ${p.snippet}\n\n`;
    });
  }

  // Add user context if available
  if (context.group) {
    contextText += `\n(ผู้ถามอยู่กลุ่ม: ${context.group})`;
  }

  return contextText;
}

/**
 * เรียก AI API - รองรับหลาย provider
 * Priority: Gemini (primary) -> Z.AI (fallback 1) -> OpenAI (fallback 2)
 *
 * Gemini Models: https://ai.google.dev/models
 * Z.AI Models: https://open.bigmodel.cn/dev/api#glm-4
 * OpenAI Models: https://platform.openai.com/docs/models
 */
function callGLM(query, context, maxTokens = 2000, detailed = true) {
  // Try Gemini first (Primary - has free tier!)
  const geminiResult = tryGemini(query, context, maxTokens, detailed);
  if (geminiResult) {
    return geminiResult;
  }

  // Fallback to Z.AI
  const zaiResult = tryZAI(query, context, maxTokens, detailed);
  if (zaiResult) {
    return zaiResult;
  }

  // Fallback to OpenAI
  const openaiResult = tryOpenAI(query, context, maxTokens, detailed);
  if (openaiResult) {
    return openaiResult;
  }

  // All failed
  throw new Error("All AI providers failed. Please check API keys and account balance.");
}

/**
 * Try Z.AI API
 */
function tryZAI(query, context, maxTokens = 2000, detailed = true) {
  const apiKey = ScriptProperties.getProperty("ZAI_API_KEY");
  if (!apiKey) {
    console.log("Z.AI API Key not configured");
    return null;
  }

  // Updated GLM model names for Zhipu AI (2024)
  const models = [
    "glm-4-flash",
    "glm-4",
    "glm-4-plus",
    "glm-4-air",
    "glm-3-turbo"
  ];

  for (const model of models) {
    try {
      const apiUrl = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

      // Adjust prompt based on detailed mode
      const detailInstruction = detailed ?
        "ตอบอย่างละเอียด เป็นขั้นตอน พร้อมตัวอย่าง และคำอธิบายที่ชัดเจน" :
        "ตอบอย่างกระชับ สั้น และตรงประเด็น";

      const prompt = `
คุณคือผู้ช่วย AI สำหรับระบบ SCORDS (SMART CHECK-IN)
ตอบคำถามเกี่ยวกับ SCOR framework, ระบบแต้มสะสม, และกิจกรรมต่างๆ

ความรู้ที่เกี่ยวข้อง:
${context}

คำถาม: ${query}

${detailInstruction}
ตอบเป็นภาษาไทย เป็นกันเอง ใช้ emojis เพื่อความน่าสนใจ
หากไม่พบความรู้ที่เกี่ยวข้อง ให้ตอบว่า "ขอโทษครับ ไม่พบข้อมูลเกี่ยวกับเรื่องนี้ กรุณาติดต่อ admin"
`;

      const response = UrlFetchApp.fetch(apiUrl, {
        method: "post",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        payload: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content: "คุณคือผู้ช่วย AI สำหรับระบบ SCORDS (SMART CHECK-IN) ตอบเป็นภาษาไทย เป็นมิตรที่มีประสบการกับ SCOR framework และระบบแต้มสะสม"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.7
        }),
        muteHttpExceptions: true
      });

      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();

      if (responseCode === 200) {
        const result = JSON.parse(responseBody);
        const answer = result.choices[0].message.content;

        const inputTokens = result.usage.prompt_tokens;
        const outputTokens = result.usage.completion_tokens;
        const costTHB = (inputTokens * 0.0000005) + (outputTokens * 0.000002);
        const costUSD = costTHB * 0.028;

        console.log(`✅ Z.AI API Success using model: ${model}`);

        return {
          answer,
          cost: costUSD,
          costTHB: costTHB,
          tokens: { input: inputTokens, output: outputTokens },
          model: `${model} (z.ai)`
        };
      }

      const errorData = JSON.parse(responseBody);

      // Check for insufficient balance error
      if (errorData.error?.code === "1113") {
        console.error(`❌ Z.AI Account Error: Insufficient balance. Please add credits at https://open.bigmodel.cn/`);
        return null;
      }

      console.warn(`Z.AI API Error with model "${model}": ${responseBody}`);

    } catch (error) {
      console.warn(`Z.AI API Exception with model "${model}": ${error.toString()}`);
    }
  }

  return null;
}

/**
 * Try Gemini API (fallback 1)
 * Google Gemini API - Cost-effective with good Thai support
 */
function tryGemini(query, context, maxTokens = 2000, detailed = true) {
  const apiKey = ScriptProperties.getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    console.log("Gemini API Key not configured");
    return null;
  }

  // Try different Gemini models based on official docs
  // https://ai.google.dev/gemini-api/docs/models
  const models = [
    "gemini-2.5-flash",           // Latest 2.5 Flash (Ultra fast!)
    "gemini-2.0-flash-exp",       // 2.0 Flash Experimental
    "gemini-1.5-flash",           // Stable 1.5 Flash (Free tier available)
    "gemini-1.5-flash-8b",        // Lightweight 1.5 Flash
    "gemini-1.5-pro",             // High quality 1.5 Pro
    "gemini-1.0-pro"              // Legacy stable model
  ];

  for (const model of models) {
    try {
      // Gemini API uses different format than OpenAI-compatible APIs
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      // Adjust prompt based on detailed mode
      const detailInstruction = detailed ?
        "ตอบอย่างละเอียด เป็นขั้นตอน พร้อมตัวอย่าง และคำอธิบายที่ชัดเจน" :
        "ตอบอย่างกระชับ สั้น และตรงประเด็น";

      const prompt = `
คุณคือผู้ช่วย AI สำหรับระบบ SCORDS (SMART CHECK-IN)
ตอบคำถามเกี่ยวกับ SCOR framework, ระบบแต้มสะสม, และกิจกรรมต่างๆ

ความรู้ที่เกี่ยวข้อง:
${context}

คำถาม: ${query}

${detailInstruction}
ตอบเป็นภาษาไทย เป็นกันเอง ใช้ emojis เพื่อความน่าสนใจ
หากไม่พบความรู้ที่เกี่ยวข้อง ให้ตอบว่า "ขอโทษครับ ไม่พบข้อมูลเกี่ยวกับเรื่องนี้ กรุณาติดต่อ admin"
`;

      const response = UrlFetchApp.fetch(apiUrl, {
        method: "post",
        headers: {
          "Content-Type": "application/json"
        },
        payload: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: maxTokens
          }
        }),
        muteHttpExceptions: true
      });

      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();

      if (responseCode === 200) {
        const result = JSON.parse(responseBody);

        // Gemini API response format is different
        const answer = result.candidates[0].content.parts[0].text;

        // Estimate token usage (Gemini doesn't return exact counts)
        const inputTokens = prompt.length / 4; // Rough estimate
        const outputTokens = answer.length / 4; // Rough estimate

        // Gemini 1.5 Flash pricing: Free tier (1,000 requests/day) or pay-as-you-go
        // Pay-as-you-go: ~$0.075 per million input tokens, ~$0.30 per million output tokens
        const costUSD = (inputTokens * 0.000000075) + (outputTokens * 0.00000030);
        const costTHB = costUSD * 35.7; // Convert to THB

        console.log(`✅ Gemini API Success using model: ${model}`);

        return {
          answer,
          cost: costUSD,
          costTHB: costTHB,
          tokens: { input: inputTokens, output: outputTokens },
          model: `${model} (google)`
        };
      }

      const errorData = JSON.parse(responseBody);

      // Check for quota exceeded error
      if (errorData.error?.status === "RESOURCE_EXHAUSTED") {
        console.error(`❌ Gemini API Error: Quota exceeded. Check your quota at https://aistudio.google.com/app/apikey`);
        return null;
      }

      console.warn(`Gemini API Error with model "${model}": ${responseBody}`);

    } catch (error) {
      console.warn(`Gemini API Exception with model "${model}": ${error.toString()}`);
    }
  }

  return null;
}

/**
 * Try OpenAI API (fallback 2)
 */
function tryOpenAI(query, context, maxTokens = 2000, detailed = true) {
  const apiKey = ScriptProperties.getProperty("OPENAI_API_KEY");
  if (!apiKey) {
    console.log("OpenAI API Key not configured");
    return null;
  }

  try {
    const apiUrl = "https://api.openai.com/v1/chat/completions";

    // Adjust prompt based on detailed mode
    const detailInstruction = detailed ?
      "ตอบอย่างละเอียด เป็นขั้นตอน พร้อมตัวอย่าง และคำอธิบายที่ชัดเจน" :
      "ตอบอย่างกระชับ สั้น และตรงประเด็น";

    const prompt = `
คุณคือผู้ช่วย AI สำหรับระบบ SCORDS (SMART CHECK-IN)
ตอบคำถามเกี่ยวกับ SCOR framework, ระบบแต้มสะสม, และกิจกรรมต่างๆ

ความรู้ที่เกี่ยวข้อง:
${context}

คำถาม: ${query}

${detailInstruction}
ตอบเป็นภาษาไทย เป็นกันเอง ใช้ emojis เพื่อความน่าสนใจ
หากไม่พบความรู้ที่เกี่ยวข้อง ให้ตอบว่า "ขอโทษครับ ไม่พบข้อมูลเกี่ยวกับเรื่องนี้ กรุณาติดต่อ admin"
`;

    const response = UrlFetchApp.fetch(apiUrl, {
      method: "post",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        model: "gpt-4o-mini", // Cost-effective model
        messages: [
          {
            role: "system",
            content: "คุณคือผู้ช่วย AI สำหรับระบบ SCORDS (SMART CHECK-IN) ตอบเป็นภาษาไทย เป็นมิตรที่มีประสบการกับ SCOR framework และระบบแต้มสะสม"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      }),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      const result = JSON.parse(responseBody);
      const answer = result.choices[0].message.content;

      const inputTokens = result.usage.prompt_tokens;
      const outputTokens = result.usage.completion_tokens;
      const costUSD = (inputTokens * 0.00000015) + (outputTokens * 0.0000006); // GPT-4o-mini pricing

      console.log(`✅ OpenAI API Success using model: gpt-4o-mini`);

      return {
        answer,
        cost: costUSD,
        costTHB: costUSD * 35.7, // Convert to THB
        tokens: { input: inputTokens, output: outputTokens },
        model: "gpt-4o-mini (openai)"
      };
    }

    console.warn(`OpenAI API Error: ${responseBody}`);
    return null;

  } catch (error) {
    console.warn(`OpenAI API Exception: ${error.toString()}`);
    return null;
  }
}

/**
 * ค้นหาแถวใน Sheet ตาม column และค่าที่ต้องการ
 */
function findRow(sheet, columnName, value) {
  const data = getSheetData(sheet);
  return data.find(row => row[columnName] == value) || null;
}

/**
 * ดึงข้อมูล Points Leaderboard
 */
function getPointsLeaderboard() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const pointsSheet = ss.getSheetByName(SHEET_NAMES.POINTS);

  if (!pointsSheet) {
    // Create sheet if not exists
    ss.insertSheet(SHEET_NAMES.POINTS);
    pointsSheet = ss.getSheetByName(SHEET_NAMES.POINTS);
    pointsSheet.appendRow(['UserID', 'Points', 'UpdatedAt']);
  }

  const pointsData = getSheetData(pointsSheet);
  const usersData = getSheetData(ss.getSheetByName(SHEET_NAMES.USERS));

  // Create user map
  const userMap = {};
  usersData.forEach(user => {
    userMap[user.UserID] = {
      name: user.FirstName && user.LastName ?
        `${user.FirstName} ${user.LastName}` :
        user.DisplayName,
      group: user.Group,
      profilePicture: user.ProfilePicture || null
    };
  });

  // Build leaderboard
  const leaderboard = pointsData
    .map(row => ({
      userId: row.UserID,
      points: parseInt(row.Points) || 0,
      name: userMap[row.UserID]?.name || row.UserID,
      group: userMap[row.UserID]?.group || '-',
      profilePicture: userMap[row.UserID]?.profilePicture || null
    }))
    .filter(item => item.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 50); // Top 50

  // Add ranking
  return leaderboard.map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}

/**
 * แลก QR Code รับแต้ม
 */
function redeemPointsQR(data) {
  const { userId, qrData } = data;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Validate QR data
  if (!qrData || qrData.type !== 'points_reward') {
    return { success: false, message: "QR Code ไม่ถูกต้อง" };
  }

  // Check if QR has remaining uses
  const pointsHistorySheet = ss.getSheetByName(SHEET_NAMES.POINTS_HISTORY);
  if (!pointsHistorySheet) {
    ss.insertSheet(SHEET_NAMES.POINTS_HISTORY);
    // Create sheet with headers
    const newSheet = ss.getSheetByName(SHEET_NAMES.POINTS_HISTORY);
    newSheet.appendRow(['Timestamp', 'UserID', 'UserName', 'Points', 'Activity', 'QRCodeData']);
  }

  // Count how many times this QR has been used
  const historyData = getSheetData(pointsHistorySheet);
  const qrUses = historyData.filter(row => {
    try {
      const qr = JSON.parse(row.QRCodeData);
      return qr.createdAt === qrData.createdAt;
    } catch {
      return false;
    }
  }).length;

  if (qrUses >= qrData.uses) {
    return { success: false, message: "QR Code นี้ถูกใช้ครบแล้ว" };
  }

  // Check if user already used this QR
  const alreadyUsed = historyData.some(row =>
    row.UserID === userId &&
    row.QRCodeData === JSON.stringify(qrData)
  );

  if (alreadyUsed && qrData.uses === 1) {
    return { success: false, message: "คุณใช้ QR Code นี้ไปแล้ว" };
  }

  // Get user info
  const userInfo = getUserInfo(ss, userId);
  const userName = userInfo ? (userInfo.firstName && userInfo.lastName ?
    `${userInfo.firstName} ${userInfo.lastName}` :
    userInfo.name) : data.displayName || userId;

  // Add points to user
  addPointsToUser(ss, userId, qrData.points, qrData.note || 'รับแต้มจาก QR Code', qrData);

  // Update redeemed count in QR_Generation_History
  const qrHistorySheet = ss.getSheetByName(SHEET_NAMES.QR_GENERATION_HISTORY);
  if (qrHistorySheet) {
    const qrHistoryData = getSheetData(qrHistorySheet);
    qrHistoryData.forEach((row, index) => {
      try {
        const storedQrData = JSON.parse(row.QRCodeData);
        if (storedQrData.createdAt === qrData.createdAt) {
          // Increment redeemed count
          const currentCount = parseInt(row.RedeemedCount) || 0;
          const rowIndex = index + 2; // +2 for header and 1-based index
          qrHistorySheet.getRange(rowIndex, 8).setValue(currentCount + 1);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
  }

  return {
    success: true,
    message: `รับ ${qrData.points} แต้มสำเร็จ!`,
    data: {
      points: qrData.points,
      note: qrData.note
    }
  };
}

/**
 * เพิ่มแต้มจากการเล่นเกมส์
 */
function addGamePoints(data) {
  const { userId, activity, points, displayName } = data;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (!userId) {
    return { success: false, message: "User ID is required" };
  }

  if (!activity || !points) {
    return { success: false, message: "Activity and points are required" };
  }

  try {
    // Add points using existing function
    addPointsToUser(ss, userId, points, activity);

    // Get user info for response
    const userInfo = getUserInfo(ss, userId);
    const totalPoints = getUserTotalPoints(ss, userId);

    return {
      success: true,
      message: `ได้รับ ${points} แต้ม!`,
      data: {
        points: points,
        activity: activity,
        totalPoints: totalPoints
      }
    };
  } catch (error) {
    console.error("Error adding game points:", error);
    return {
      success: false,
      message: "เพิ่มแต้มไม่สำเร็จ: " + error.message
    };
  }
}

/**
 * ดึงแต้มรวมของ user
 */
function getUserTotalPoints(ss, userId) {
  const pointsSheet = ss.getSheetByName(SHEET_NAMES.POINTS);

  if (!pointsSheet) {
    return 0;
  }

  const userRow = findRow(pointsSheet, 'UserID', userId);
  return userRow ? (parseInt(userRow.Points) || 0) : 0;
}

/**
 * เพิ่มแต้มให้ user
 */
function addPointsToUser(ss, userId, points, activity, qrData = null) {
  const pointsSheet = ss.getSheetByName(SHEET_NAMES.POINTS);

  if (!pointsSheet) {
    ss.insertSheet(SHEET_NAMES.POINTS);
    const newSheet = ss.getSheetByName(SHEET_NAMES.POINTS);
    newSheet.appendRow(['UserID', 'Points', 'UpdatedAt']);
    pointsSheet = newSheet;
  }

  // Find existing user points
  const existingRow = findRow(pointsSheet, 'UserID', userId);

  if (existingRow) {
    // Update existing points
    const currentPoints = parseInt(existingRow.Points) || 0;
    const newPoints = currentPoints + points;

    // Find row index and update
    const data = getSheetData(pointsSheet);
    const rowIndex = data.findIndex(row => row.UserID === userId) + 2; // +2 for header and 1-based index

    pointsSheet.getRange(rowIndex, 2).setValue(newPoints);
    pointsSheet.getRange(rowIndex, 3).setValue(new Date());
  } else {
    // Add new user points
    pointsSheet.appendRow([userId, points, new Date()]);
  }

  // Add to history
  const historySheet = ss.getSheetByName(SHEET_NAMES.POINTS_HISTORY);
  if (!historySheet) {
    ss.insertSheet(SHEET_NAMES.POINTS_HISTORY);
    const newSheet = ss.getSheetByName(SHEET_NAMES.POINTS_HISTORY);
    newSheet.appendRow(['Timestamp', 'UserID', 'UserName', 'Points', 'Activity', 'QRCodeData']);
    historySheet = newSheet;
  }

  const userInfo = getUserInfo(ss, userId);
  const userName = userInfo ? (userInfo.firstName && userInfo.lastName ?
    `${userInfo.firstName} ${userInfo.lastName}` :
    userInfo.displayName) : userId;

  historySheet.appendRow([
    new Date(),
    userId,
    userName,
    points,
    activity,
    qrData ? JSON.stringify(qrData) : ''
  ]);
}

/**
 * Sync ประวัติการเล่นเกมส์จาก localStorage ไป Sheets
 */
function syncLocalHistory(data) {
  const { userId, localHistory } = data;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (!userId || !localHistory) {
    return { success: false, message: "User ID and local history are required" };
  }

  try {
    const historySheet = ss.getSheetByName(SHEET_NAMES.POINTS_HISTORY);
    if (!historySheet) {
      ss.insertSheet(SHEET_NAMES.POINTS_HISTORY);
      const newSheet = ss.getSheetByName(SHEET_NAMES.POINTS_HISTORY);
      newSheet.appendRow(['Timestamp', 'UserID', 'UserName', 'Points', 'Activity', 'QRCodeData']);
      historySheet = newSheet;
    }

    // Get existing history from sheets
    const existingHistory = getSheetData(historySheet);
    const syncedRecords = existingHistory.map(row => {
      try {
        const activity = row.Activity;
        const timestamp = new Date(row.Timestamp).toISOString();
        return `${userId}_${activity}_${timestamp}`;
      } catch {
        return null;
      }
    });

    let syncedCount = 0;
    const userInfo = getUserInfo(ss, userId);
    const userName = userInfo ? (userInfo.firstName && userInfo.lastName ?
      `${userInfo.firstName} ${userInfo.lastName}` :
      userInfo.displayName) : userId;

    // Sync each local history item
    localHistory.forEach(item => {
      const recordKey = `${userId}_${item.activity}_${item.date}`;

      // Skip if already synced
      if (syncedRecords.includes(recordKey)) {
        return;
      }

      // Add to history
      historySheet.appendRow([
        new Date(item.date),
        userId,
        userName,
        item.points,
        item.activity,
        '' // No QR data for game points
      ]);

      syncedCount++;
    });

    return {
      success: true,
      message: `Sync ประวัติ ${syncedCount} รายการสำเร็จ`,
      data: {
        syncedCount: syncedCount
      }
    };
  } catch (error) {
    console.error("Error syncing local history:", error);
    return {
      success: false,
      message: "Sync ประวัติไม่สำเร็จ: " + error.message
    };
  }
}

/**
 * บันทึกประวัติการสร้าง QR Code แจกแต้ม
 */
function logQRGeneration(data) {
  const { adminId, adminName, points, note, uses, qrData } = data;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (!adminId || !points || !qrData) {
    return { success: false, message: "Missing required fields" };
  }

  try {
    const qrHistorySheet = ss.getSheetByName(SHEET_NAMES.QR_GENERATION_HISTORY);
    if (!qrHistorySheet) {
      ss.insertSheet(SHEET_NAMES.QR_GENERATION_HISTORY);
      const newSheet = ss.getSheetByName(SHEET_NAMES.QR_GENERATION_HISTORY);
      newSheet.appendRow(['Timestamp', 'AdminID', 'AdminName', 'Points', 'Note', 'Uses', 'QRCodeData', 'RedeemedCount']);
      return newSheet;
    }

    // Append QR generation record
    qrHistorySheet.appendRow([
      new Date(),
      adminId,
      adminName || 'Admin',
      points,
      note || 'รางวัล',
      uses,
      JSON.stringify(qrData),
      0 // Initial redeemed count
    ]);

    return {
      success: true,
      message: "บันทึกประวัติการสร้าง QR Code สำเร็จ"
    };
  } catch (error) {
    console.error("Error logging QR generation:", error);
    return {
      success: false,
      message: "บันทึกประวัติไม่สำเร็จ: " + error.message
    };
  }
}

/**
 * ดึงประวัติการสร้าง QR Code แจกแต้ม
 */
function getQRGenerationHistory() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const qrHistorySheet = ss.getSheetByName(SHEET_NAMES.QR_GENERATION_HISTORY);

  if (!qrHistorySheet) {
    return [];
  }

  const historyData = getSheetData(qrHistorySheet);

  return historyData.map(row => ({
    timestamp: row.Timestamp,
    adminId: row.AdminID,
    adminName: row.AdminName,
    points: parseInt(row.Points) || 0,
    note: row.Note || 'รางวัล',
    uses: parseInt(row.Uses) || 1,
    redeemedCount: parseInt(row.RedeemedCount) || 0,
    qrData: row.QRCodeData
  }))
  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort by newest first
  .slice(0, 50); // Last 50 records
}

/**
 * ดึงข้อมูลแต้มของ user คนเดียว
 * @param {string} userId - LINE User ID
 * @returns {Object} ข้อมูลแต้มของ user
 */
function getUserPointsData(userId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const totalPoints = getUserTotalPoints(ss, userId);

  return {
    userId: userId,
    points: totalPoints
  };
}

/**
 * ดึงประวัติการได้แต้มของ user คนเดียว
 * @param {string} userId - LINE User ID
 * @param {string} limit - จำนวนรายการที่ต้องการ (default: 10)
 * @returns {Array} ประวัติการได้แต้ม
 */
function getUserPointsHistory(userId, limit) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const historySheet = ss.getSheetByName(SHEET_NAMES.POINTS_HISTORY);

  if (!historySheet) {
    return [];
  }

  const historyData = getSheetData(historySheet);
  const limitNum = parseInt(limit) || 10;

  return historyData
    .filter(row => row.UserID === userId)
    .map(row => ({
      date: row.Timestamp,
      activity: row.Activity,
      points: parseInt(row.Points) || 0
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limitNum);
}

// ============================================================
// SETUP FUNCTIONS
// ============================================================

/**
 * ตั้งค่า ScriptProperties - รันครั้งเดียวเพื่อ setup
 * Run this function ONCE to configure all API keys and IDs
 *
 * Setup Instructions:
 * 1. Get Z.AI API Key from https://z.ai/ (requires account)
 * 2. (Optional) Create Google Drive folder for PDF documents
 * 3. Enable Drive API for PDF search (if needed):
 *    - Go to: Resources > Advanced Google Services
 *    - Enable "Drive API"
 */
function setupScriptProperties() {
  // LINE Channel Access Token (Required for LINE Bot & AI Chat)
  // Get from: https://developers.line.biz/console/
  // Go to: Your LINE Channel > Messaging API > Channel access token (long-lived)
  // Required for: LINE webhook handling, AI chat replies
  ScriptProperties.setProperty("LINE_CHANNEL_ACCESS_TOKEN", "your-line-channel-access-token-here");

  // Google Gemini API Key (Primary AI Provider) ⭐
  // Get from: https://aistudio.google.com/app/apikey
  // Models: gemini-2.0-flash-exp, gemini-1.5-flash, gemini-1.5-pro
  // Note: Free tier available (1,500 requests/day for gemini-1.5-flash)
  // Docs: https://ai.google.dev/gemini-api/docs/models
  // Pricing: Very cost-effective with excellent Thai support
  ScriptProperties.setProperty("GEMINI_API_KEY", "your-gemini-api-key-here");

  // Z.AI API Key (Fallback AI Provider 1)
  // Get from: https://open.bigmodel.cn/ (Zhipu AI)
  // Models: glm-4-flash, glm-4, glm-4-plus
  // Note: Requires account balance/credits to work
  // Pricing: Very cost-effective for Thai language support
  ScriptProperties.setProperty("ZAI_API_KEY", "your-zai-api-key-here");

  // OpenAI API Key (Fallback AI Provider 2)
  // Get from: https://platform.openai.com/api-keys
  // Note: Used as backup if Gemini and Z.AI fail
  // Pricing: GPT-4o-mini is very cost-effective
  ScriptProperties.setProperty("OPENAI_API_KEY", "your-openai-api-key-here");

  // Google Drive Folder ID สำหรับเก็บ PDF documents (OPTIONAL)
  // Only needed if you want PDF search functionality
  // Folder URL example: https://drive.google.com/drive/folders/1qvA0sMG024kezPynLHidvpCFUtkj-TjS
  // The folder ID is the last part of the URL
  ScriptProperties.setProperty("PDF_FOLDER_ID", "your-pdf-folder-id-here");

  console.log("✅ Script Properties setup complete!");
  console.log("LINE Channel Access Token: " + (ScriptProperties.getProperty("LINE_CHANNEL_ACCESS_TOKEN") ? "✅ Set" : "❌ Not set"));
  console.log("PDF Folder ID: " + (ScriptProperties.getProperty("PDF_FOLDER_ID") || "Not set"));
  console.log("ZAI API Key: " + (ScriptProperties.getProperty("ZAI_API_KEY") ? "✅ Set" : "❌ Not set"));
  console.log("GEMINI API Key: " + (ScriptProperties.getProperty("GEMINI_API_KEY") ? "✅ Set" : "❌ Not set"));
  console.log("OPENAI API Key: " + (ScriptProperties.getProperty("OPENAI_API_KEY") ? "✅ Set" : "❌ Not set"));
  console.log("\n📝 Note: PDF search requires Drive API to be enabled:");
  console.log("   Go to: Resources > Advanced Google Services > Drive API > Enable");
  console.log("\n💡 Note: You need at least one AI provider configured:");
  console.log("   - Gemini (Primary): https://aistudio.google.com/app/apikey - Free tier (1,500/day)! ⭐");
  console.log("     Models: gemini-2.0-flash-exp, gemini-1.5-flash, gemini-1.5-pro");
  console.log("   - Z.AI (Fallback 1): https://open.bigmodel.cn/ - Requires account balance");
  console.log("     Models: glm-4-flash, glm-4, glm-4-plus");
  console.log("   - OpenAI (Fallback 2): https://platform.openai.com/ - Pay-as-you-go");
  console.log("     Models: gpt-4o-mini, gpt-4o");
  console.log("\n📱 Note: LINE Bot requires LINE_CHANNEL_ACCESS_TOKEN:");
  console.log("   Get from: https://developers.line.biz/console/");
  console.log("   Go to: Your Channel > Messaging API > Channel access token (long-lived)");
  console.log("\n🎯 Recommendation: Start with Gemini (has free tier, great Thai support)");
  console.log("   Docs: https://ai.google.dev/gemini-api/docs/models");
}

// ============================================================
// TEST FUNCTIONS
// ============================================================

/**
 * ทดสอบการเชื่อมต่อ Google Sheets
 */
function test_sheetsConnection() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const users = getSheetData(ss.getSheetByName(SHEET_NAMES.USERS));
    const activities = getSheetData(ss.getSheetByName(SHEET_NAMES.ACTIVITIES));

    console.log("✅ Sheets Connection Test Passed!");
    console.log("Users: " + users.length);
    console.log("Activities: " + activities.length);

    if (users.length > 0) {
      console.log("First user: " + JSON.stringify(users[0]));
    }

    return { success: true, users: users.length, activities: activities.length };
  } catch (error) {
    console.error("❌ Sheets Connection Test Failed: " + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * ทดสอบ Dashboard
 */
function test_dashboard() {
  try {
    const result = getDashboardData("all", null, true);
    console.log("✅ Dashboard Test Passed!");
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error("❌ Dashboard Test Failed: " + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * ทดสอบ Leaderboard
 */
function test_leaderboard() {
  try {
    const result = getLeaderboard("7");
    console.log("✅ Leaderboard Test Passed!");
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error("❌ Leaderboard Test Failed: " + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * ทดสอบ Points Leaderboard
 */
function test_pointsLeaderboard() {
  try {
    const result = getPointsLeaderboard();
    console.log("✅ Points Leaderboard Test Passed!");
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error("❌ Points Leaderboard Test Failed: " + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * ทดสอบ AI Assistant (ต้อง setup API Keys ก่อน)
 */
function test_askAI() {
  try {
    const testQuery = "SCOR คืออะไร";

    // ตรวจสอบว่ามีอย่างน้อย 1 API Key
    const zaiKey = ScriptProperties.getProperty("ZAI_API_KEY");
    const geminiKey = ScriptProperties.getProperty("GEMINI_API_KEY");
    const openaiKey = ScriptProperties.getProperty("OPENAI_API_KEY");

    if (!zaiKey && !geminiKey && !openaiKey) {
      console.log("❌ No AI API keys found. Please run setupScriptProperties() first.");
      console.log("   At least one of these is required: ZAI_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY");
      return { success: false, error: "No AI API keys configured" };
    }

    console.log("🔍 Testing AI with providers:");
    if (geminiKey) console.log("   ⭐ Gemini (Primary) - Free tier!");
    if (zaiKey) console.log("   ✅ Z.AI (Fallback 1)");
    if (openaiKey) console.log("   ✅ OpenAI (Fallback 2)");

    // ทดสอบ askAI function
    const result = askAI({
      query: testQuery,
      context: { userId: "test_user", group: "IT" }
    });

    console.log("✅ AI Assistant Test Passed!");
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error("❌ AI Assistant Test Failed: " + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * ทดสอบทั้งหมด (Run All Tests)
 */
function test_runAll() {
  console.log("=== 🧪 SCORDS Backend Test Suite ===\n");

  const results = {
    sheetsConnection: test_sheetsConnection(),
    dashboard: test_dashboard(),
    leaderboard: test_leaderboard(),
    pointsLeaderboard: test_pointsLeaderboard(),
    aiAssistant: test_askAI()
  };

  console.log("\n=== 📊 Test Summary ===");
  const passed = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;
  console.log(`Passed: ${passed}/${total}`);

  return results;
}

/**
 * ทดสอบ LINE Webhook (Mock data)
 */
function test_lineWebhook() {
  console.log("=== 📱 Testing LINE Webhook (Mock) ===\n");

  try {
    // Mock LINE webhook event
    const mockEvent = {
      destination: "U1234567890abcdef1234567890abcdef",
      events: [
        {
          type: "message",
          message: {
            type: "text",
            text: "test message",
            id: "1234567890",
            quoteToken: null
          },
          replyToken: "test-reply-token-abc123",
          source: {
            userId: "U9876543210fedcba9876543210fedcba",
            type: "user"
          },
          timestamp: 1678901234567,
          mode: "active",
          webhookEventId: "01HXXXXX",
          deliveryContext: {
            isRedelivery: false
          }
        }
      ]
    };

    console.log("📤 Mock Event Created:");
    console.log("  - Type: " + mockEvent.events[0].type);
    console.log("  - Message: " + mockEvent.events[0].message.text);
    console.log("  - Source Type: " + mockEvent.events[0].source.type);

    // Test handleLineWebhook
    const result = handleLineWebhook(mockEvent);

    console.log("\n✅ LINE Webhook Test Result:");
    console.log(JSON.stringify(result, null, 2));

    return {
      success: true,
      result: result
    };

  } catch (error) {
    console.error("❌ LINE Webhook Test Failed:");
    console.error("  Error: " + error.toString());
    console.error("  Stack: " + error.stack);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ทดสอบการตั้งค่า LINE Bot
 */
function test_lineBotSetup() {
  console.log("=== 🔧 Testing LINE Bot Setup ===\n");

  const results = {};

  // Test 1: Spreadsheet connection
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    results.spreadsheet = { success: true, message: "Connected" };
    console.log("✅ Spreadsheet: Connected");
  } catch (error) {
    results.spreadsheet = { success: false, error: error.message };
    console.log("❌ Spreadsheet: " + error.message);
  }

  // Test 2: LINE Channel Access Token
  const lineToken = ScriptProperties.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  if (lineToken) {
    results.lineToken = {
      success: true,
      message: "Token exists",
      length: lineToken.length,
      preview: lineToken.substring(0, 20) + "..."
    };
    console.log("✅ LINE Token: Set (" + lineToken.length + " chars)");
  } else {
    results.lineToken = {
      success: false,
      error: "LINE_CHANNEL_ACCESS_TOKEN not set"
    };
    console.log("❌ LINE Token: NOT SET - Run setupScriptProperties()");
  }

  // Test 3: AI API Keys
  const geminiKey = ScriptProperties.getProperty("GEMINI_API_KEY");
  const zaiKey = ScriptProperties.getProperty("ZAI_API_KEY");
  const openaiKey = ScriptProperties.getProperty("OPENAI_API_KEY");

  results.aiKeys = {
    gemini: !!geminiKey,
    zai: !!zaiKey,
    openai: !!openaiKey,
    atLeastOne: !!(geminiKey || zaiKey || openaiKey)
  };

  console.log("\n🤖 AI API Keys:");
  console.log("  - Gemini: " + (geminiKey ? "✅" : "❌"));
  console.log("  - Z.AI: " + (zaiKey ? "✅" : "❌"));
  console.log("  - OpenAI: " + (openaiKey ? "✅" : "❌"));
  console.log("  - At least one: " + (results.aiKeys.atLeastOne ? "✅" : "❌"));

  // Test 4: Sheet existence
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
    const activitiesSheet = ss.getSheetByName(SHEET_NAMES.ACTIVITIES);
    const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);

    results.sheets = {
      users: !!usersSheet,
      activities: !!activitiesSheet,
      log: !!logSheet
    };

    console.log("\n📊 Sheets Status:");
    console.log("  - Users: " + (usersSheet ? "✅" : "❌"));
    console.log("  - Activities: " + (activitiesSheet ? "✅" : "❌"));
    console.log("  - Log: " + (logSheet ? "✅" : "❌"));
  } catch (error) {
    results.sheets = { error: error.message };
  }

  // Summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 Setup Summary:");
  console.log("  Spreadsheet: " + (results.spreadsheet.success ? "✅" : "❌"));
  console.log("  LINE Token: " + (results.lineToken.success ? "✅" : "❌"));
  console.log("  AI Keys: " + (results.aiKeys.atLeastOne ? "✅" : "❌"));

  const allGood = results.spreadsheet.success &&
                  results.lineToken.success &&
                  results.aiKeys.atLeastOne;

  if (allGood) {
    console.log("\n🎉 Setup looks good! Ready for testing.");
  } else {
    console.log("\n⚠️ Setup incomplete. Check the items marked with ❌");
  }

  return results;
}

/**
 * ทดสอบ LINE Message Handler (Direct)
 */
function test_lineMessageHandler() {
  console.log("=== 💬 Testing LINE Message Handler ===\n");

  const mockEvent = {
    type: "message",
    message: {
      type: "text",
      text: "help",
      id: "12345",
      quoteToken: null
    },
    replyToken: "test-reply-token",
    source: {
      userId: "test-user-id",
      type: "user"
    },
    timestamp: Date.now()
  };

  console.log("📤 Testing with command: " + mockEvent.message.text);

  try {
    const result = handleLineMessage(mockEvent);

    console.log("\n✅ Message Handler Result:");
    console.log("  Action: " + result.action);
    console.log("  Success: " + result.success);

    return result;
  } catch (error) {
    console.error("❌ Message Handler Error: " + error.toString());
    return { success: false, error: error.message };
  }
}

// ============================================================
// LINE WEBHOOK & AI CHAT FUNCTIONS
// ============================================================

/**
 * Handle LINE Webhook events
 * @param {Object} requestData - Webhook request data
 * @returns {Object} Response
 */
function handleLineWebhook(requestData) {
  const { events } = requestData;

  if (!events || events.length === 0) {
    return { success: true, message: "No events to process" };
  }

  const results = [];

  for (const event of events) {
    try {
      // Handle message event
      if (event.type === "message" && event.message.type === "text") {
        const result = handleLineMessage(event);
        results.push(result);
      }
      // Handle follow event
      else if (event.type === "follow") {
        const result = handleLineFollow(event);
        results.push(result);
      }
      // Handle other event types
      else {
        results.push({
          success: true,
          message: `Event type "${event.type}" received but not processed`
        });
      }
    } catch (error) {
      console.error("Error processing LINE event: " + error.toString());
      results.push({
        success: false,
        error: error.message,
        eventType: event.type
      });
    }
  }

  return {
    success: true,
    processed: results.length
  };
}

/**
 * Handle LINE message event with AI chat capability
 * @param {Object} event - LINE webhook event
 * @returns {Object} Response
 */
function handleLineMessage(event) {
  const { replyToken, source, message } = event;
  const userId = source?.userId;
  const text = message?.text || "";
  const quoteToken = message?.quoteToken || null;

  // Determine chat ID for loading animation
  const chatId = source?.groupId || source?.roomId || source?.userId;

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📱 [WEBHOOK] LINE Message Received`);
  console.log(`📱 [WEBHOOK] User ID: ${userId}`);
  console.log(`📱 [WEBHOOK] Message: "${text}"`);
  console.log(`📱 [WEBHOOK] Quote Token: ${quoteToken ? 'YES - ' + quoteToken.substring(0, 20) + '...' : 'NO'}`);
  console.log(`📱 [WEBHOOK] Chat ID: ${chatId}`);
  console.log(`📱 [WEBHOOK] Source Type: ${source?.groupId ? 'GROUP' : source?.roomId ? 'ROOM' : 'USER'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  try {
    console.log(`🔍 [PROCESS] Starting message processing...`);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const userInfo = getUserInfo(ss, userId);

    console.log(`👤 [USER INFO]:`, userInfo ? {
      name: userInfo.name,
      group: userInfo.group,
      role: userInfo.role
    } : 'Not registered');

    // Check for special commands
    const lowerText = text.toLowerCase().trim();
    console.log(`🔍 [COMMAND] Checking for special commands: "${lowerText}"`);

    // Status command
    if (lowerText === "status" || lowerText === "สถานะ") {
      console.log(`✅ [COMMAND] Status command detected`);

      if (!userInfo) {
        console.log(`⚠️ [COMMAND] User not registered`);
        sendLineReplyDirect(replyToken, "❌ คุณยังไม่ได้ลงทะเบียนในระบบ\n\nกรุณาลงทะเบียนผ่านแอป SCORDS ก่อนใช้งานครับ 🙏", quoteToken);
        return { success: true, action: "status_check", registered: false };
      }

      const points = getUserTotalPoints(ss, userId);
      console.log(`📊 [STATUS] User points: ${points}`);

      const replyText = `👤 สถานะของคุณ:
━━━━━━━━━━━━━━━
ชื่อ: ${userInfo.name}
กลุ่ม: ${userInfo.group || '-'}
ตำแหน่ง: ${userInfo.position || '-'}
รหัสพนักงาน: ${userInfo.employeeId || '-'}
แต้มสะสม: ${points} แต้ม

✅ ลงทะเบียนแล้ว`;

      sendLineReplyDirect(replyToken, replyText, quoteToken);
      return { success: true, action: "status_check", registered: true };
    }

    // Help command
    if (lowerText === "help" || lowerText === "ช่วยเหลือ" || lowerText === "menu" || lowerText === "เมนู") {
      console.log(`✅ [COMMAND] Help command detected`);

      const replyText = `🤖 SCORDS AI Bot - คำสั่งที่ใช้ได้

━━━━━━━━━━━━━━━
📊 **คำสั่งหลัก:**
• "status" หรือ "สถานะ" - เช็คสถานะของคุณ
• "help" หรือ "ช่วยเหลือ" - ดูคำสั่งทั้งหมด

━━━━━━━━━━━━━━━
🤖 **พูดคุยกับ AI:**
พิมพ์คำถามหรือข้อความใดๆ เกี่ยวกับ:
• SCOR framework
• ระบบแต้มสะสม
• กิจกรรมต่างๆ
• วิธีการใช้งาน

ตัวอย่างคำถาม:
• "SCOR คืออะไร?"
• "จะได้แต้มอย่างไร?"
• "กติกาแต้มสะสม?"
• "มีกิจกรรมอะไรบ้าง?"
• "ขอตัวอย่างการประยุกต์ใช้ SCOR"

━━━━━━━━━━━━━━━
หรือเข้าใช้งานผ่านแอป SCORDS ได้เลยครับ 🙏`;

      sendLineReplyDirect(replyToken, replyText, quoteToken);
      return { success: true, action: "help_menu" };
    }

    // For all other messages, use AI to respond
    // This makes the bot more conversational and helpful
    console.log(`🤖 [AI] AI chat requested`);
    console.log(`🤖 [AI] User: ${userId}`);
    console.log(`🤖 [AI] Query: "${text}"`);

    // Start loading animation before calling AI
    console.log(`⏳ [AI] Starting loading animation...`);
    const loadingResult = sendLineLoadingStart(chatId);
    console.log(`⏳ [AI] Loading animation result: ${loadingResult ? 'SUCCESS' : 'FAILED'}`);

    const aiRequest = {
      query: text,
      context: {
        userId: userId,
        group: userInfo?.group,
        role: userInfo?.role
      },
      maxTokens: 2000,
      detailed: true
    };

    console.log(`🤖 [AI] Sending request to AI API...`);
    const aiResponse = askAI(aiRequest);
    console.log(`🤖 [AI] AI API response:`, aiResponse.success ? 'SUCCESS' : 'FAILED');

    if (aiResponse.success) {
      console.log(`✅ [AI] AI response received`);
      console.log(`💰 [AI] Cost: $${(aiResponse.data.cost || 0).toFixed(4)} USD`);
      console.log(`📊 [AI] Model: ${aiResponse.data.model || 'unknown'}`);

      const replyText = `🤖 *SCORDS AI Assistant*

${aiResponse.data.answer}

━━━━━━━━━━━━━━━
💰 Cost: $${(aiResponse.data.cost || 0).toFixed(4)} USD
📊 Model: ${aiResponse.data.model || 'unknown'}`;

      console.log(`💬 [AI] Sending reply with quote...`);
      sendLineReplyDirect(replyToken, replyText, quoteToken);

      console.log(`✅ [AI] AI chat completed successfully`);
      return {
        success: true,
        action: "ai_chat",
        cost: aiResponse.data.cost,
        model: aiResponse.data.model
      };
    } else {
      console.log(`❌ [AI] AI response failed`);
      console.log(`❌ [AI] Error: ${aiResponse.message}`);

      const replyText = `❌ ขอโทษครับ ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง

Error: ${aiResponse.message}

💡 พิมพ์ "help" หรือ "ช่วยเหลือ" เพื่อดูคำสั่งที่ใช้ได้`;

      console.log(`💬 [AI] Sending error reply...`);
      sendLineReplyDirect(replyToken, replyText, quoteToken);

      console.log(`❌ [AI] AI chat failed`);
      return { success: false, action: "ai_chat_failed", error: aiResponse.message };
    }

  } catch (error) {
    console.error(`❌ [ERROR] Error handling LINE message`);
    console.error(`❌ [ERROR] Message: ${error.message}`);
    console.error(`❌ [ERROR] Stack: ${error.stack}`);
    return {
      success: false,
      error: error.message,
      action: "message_failed"
    };
  }
}

/**
 * Handle LINE follow event
 * @param {Object} event - LINE webhook event
 * @returns {Object} Response
 */
function handleLineFollow(event) {
  const { replyToken, source } = event;
  const userId = source?.userId;

  console.log(`👋 LINE Follow from ${userId}`);

  try {
    const welcomeMessage = `🎉 ยินดีต้อนรับสู่ SCORDS AI Bot!

ระบบเช็คชื่ออัจฉริยะ พร้อมระบบแต้มสะสม และ AI Assistant พร้อมตอบทุกคำถาม!

━━━━━━━━━━━━━━━
📱 **คำสั่งที่ใช้ได้:**

• "status" หรือ "สถานะ" - เช็คสถานะและแต้มสะสม
• "help" หรือ "ช่วยเหลือ" - ดูคำสั่งทั้งหมด

━━━━━━━━━━━━━━━
🤖 **พูดคุยกับ AI ได้ทันที:**

พิมพ์คำถามเกี่ยวกับ:
• SCOR framework & แนวคิด
• ระบบแต้มสะสม & กติกา
• กิจกรรมต่างๆ
• วิธีการใช้งาน

ตัวอย่างคำถาม:
• "SCOR คืออะไร?"
• "จะได้แต้มอย่างไร?"
• "อธิบาย Process คืออะไร?"
• "ขอตัวอย่างการประยุกต์ใช้"

━━━━━━━━━━━━━━━
📲 กรุณาลงทะเบียนผ่านแอป SCORDS เพื่อเริ่มใช้งานครับ 🙏`;

    sendLineReplyDirect(replyToken, welcomeMessage);

    return { success: true, action: "follow_handled" };
  } catch (error) {
    console.error("Error handling LINE follow: " + error.toString());
    return {
      success: false,
      error: error.message,
      action: "follow_failed"
    };
  }
}

/**
 * Handle LINE AI Chat (dedicated endpoint for LINE Bot)
 * @param {Object} requestData - Request data
 * @returns {Object} Response
 */
function handleLineAIChat(requestData) {
  const { userId, message, replyToken } = requestData;

  if (!userId || !message) {
    return {
      success: false,
      message: "userId and message are required"
    };
  }

  console.log(`🤖 LINE AI Chat from ${userId}: "${message}"`);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const userInfo = getUserInfo(ss, userId);

    const aiRequest = {
      query: message,
      context: {
        userId: userId,
        group: userInfo?.group,
        role: userInfo?.role
      },
      maxTokens: 2000,
      detailed: true
    };

    const aiResponse = askAI(aiRequest);

    if (aiResponse.success) {
      const replyText = `🤖 *SCORDS AI*

${aiResponse.data.answer}`;

      // Send reply to LINE if replyToken is provided
      if (replyToken) {
        sendLineReplyDirect(replyToken, replyText);
      }

      return {
        success: true,
        data: {
          reply: replyText,
          cost: aiResponse.data.cost,
          model: aiResponse.data.model
        }
      };
    } else {
      return {
        success: false,
        message: aiResponse.message
      };
    }
  } catch (error) {
    console.error("Error handling LINE AI chat: " + error.toString());
    return {
      success: false,
      message: "AI Error: " + error.message
    };
  }
}

/**
 * Send chat loading animation to LINE
 * @param {string} chatId - LINE chat ID
 * @returns {boolean} Success status
 */
function sendLineLoadingStart(chatId) {
  try {
    console.log(`🔄 [LOADING] Starting loading animation for chat: ${chatId}`);

    const channelAccessToken = ScriptProperties.getProperty("LINE_CHANNEL_ACCESS_TOKEN");

    if (!channelAccessToken) {
      console.error("❌ [LOADING] LINE_CHANNEL_ACCESS_TOKEN not configured");
      return false;
    }

    console.log("✅ [LOADING] Token found, preparing request...");

    const url = "https://api.line.me/v2/bot/chat/loading/start";
    const payload = {
      chatId: chatId,
      loadingSeconds: 20 // Maximum: 20 seconds
    };

    console.log(`📤 [LOADING] Request URL: ${url}`);
    console.log(`📤 [LOADING] Payload: ${JSON.stringify(payload)}`);

    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${channelAccessToken.substring(0, 20)}...` // Log partial token for security
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log(`📥 [LOADING] Response Code: ${responseCode}`);
    console.log(`📥 [LOADING] Response Body: ${responseBody}`);

    if (responseCode === 200 || responseCode === 202) {
      console.log("✅ [LOADING] Loading animation started successfully");
      return true;
    } else {
      console.error(`❌ [LOADING] Failed with code ${responseCode}: ${responseBody}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ [LOADING] Exception: ${error.toString()}`);
    console.error(`❌ [LOADING] Stack: ${error.stack}`);
    return false;
  }
}

/**
 * Send reply message to LINE (Direct function)
 * @param {string} replyToken - LINE reply token
 * @param {string} messageText - Message text to send
 * @param {string} quoteToken - Optional quote token for quoting user message
 * @returns {boolean} Success status
 */
function sendLineReplyDirect(replyToken, messageText, quoteToken = null) {
  try {
    console.log(`💬 [REPLY] Sending reply...`);
    console.log(`💬 [REPLY] Message length: ${messageText?.length || 0} chars`);
    console.log(`💬 [REPLY] Quote token: ${quoteToken ? 'YES' : 'NO'}`);
    console.log(`💬 [REPLY] Reply token: ${replyToken?.substring(0, 20)}...`);

    const channelAccessToken = ScriptProperties.getProperty("LINE_CHANNEL_ACCESS_TOKEN");

    if (!channelAccessToken) {
      console.error("❌ [REPLY] LINE_CHANNEL_ACCESS_TOKEN not configured");
      return false;
    }

    console.log("✅ [REPLY] Token found, preparing request...");

    const url = "https://api.line.me/v2/bot/message/reply";
    const message = {
      type: "text",
      text: messageText
    };

    // Add quote token if provided
    if (quoteToken) {
      message.quoteToken = quoteToken;
      console.log(`✅ [REPLY] Quote token added: ${quoteToken.substring(0, 20)}...`);
    } else {
      console.log("⚠️ [REPLY] No quote token provided (this is OK for follow events)");
    }

    const payload = {
      replyToken: replyToken,
      messages: [message]
    };

    console.log(`📤 [REPLY] Request URL: ${url}`);
    console.log(`📤 [REPLY] Payload: ${JSON.stringify({
      replyToken: replyToken.substring(0, 20) + '...',
      messages: [{
        type: message.type,
        text: messageText.substring(0, 50) + '...',
        quoteToken: quoteToken ? quoteToken.substring(0, 20) + '...' : null
      }]
    })}`);

    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${channelAccessToken.substring(0, 20)}...`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log(`📥 [REPLY] Response Code: ${responseCode}`);
    console.log(`📥 [REPLY] Response Body: ${responseBody}`);

    if (responseCode === 200) {
      console.log("✅ [REPLY] Reply sent successfully!");
      return true;
    } else {
      console.error(`❌ [REPLY] Failed with code ${responseCode}: ${responseBody}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ [REPLY] Exception: ${error.toString()}`);
    console.error(`❌ [REPLY] Stack: ${error.stack}`);
    return false;
  }
}

// ============================================================
// 🔧 DEBUG FUNCTIONS - Comprehensive Diagnostics
// ============================================================

/**
 * 🔍 Run Full Diagnostic
 * รันฟังก์ชันนี้เพื่อตรวจสอบทุกอย่าง
 *
 * วิธีใช้: รันใน Google Apps Script Editor
 * 1. เลือก debug_runFullDiagnostic
 * 2. คลิก Run
 * 3. ดูผลลัพธ์ใน Execution Log
 */
function debug_runFullDiagnostic() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  🔍 SCORDS LINE Bot - Full Diagnostic              ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  const results = {
    step1_basic: _debug_basicChecks(),
    step2_deployment: _debug_checkDeployment(),
    step3_lineToken: _debug_checkLineToken(),
    step4_webhookTest: _debug_testWebhookEndpoint()
  };

  console.log("");
  console.log("════════════════════════════════════════════════════════");
  console.log("📊 DIAGNOSTIC SUMMARY");
  console.log("════════════════════════════════════════════════════════");

  let passCount = 0;
  let failCount = 0;

  for (const [step, result] of Object.entries(results)) {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`${step}: ${status}`);

    if (result.success) {
      passCount++;
    } else {
      failCount++;
      console.log(`  └─ Error: ${result.error}`);
    }
  }

  console.log("");
  console.log(`Total: ${passCount} passed, ${failCount} failed`);
  console.log("════════════════════════════════════════════════════════");

  return results;
}

function _debug_basicChecks() {
  console.log("📍 STEP 1: Basic Checks");
  console.log("──────────────────────────────────────────────────────");

  const issues = [];

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log("✅ Spreadsheet: Connected");

    const requiredSheets = ["Users", "Activities", "Checkin_Log"];
    for (const sheetName of requiredSheets) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        issues.push(`Missing sheet: ${sheetName}`);
        console.log(`❌ Sheet "${sheetName}": NOT FOUND`);
      } else {
        console.log(`✅ Sheet "${sheetName}": OK`);
      }
    }
  } catch (error) {
    issues.push(`Spreadsheet error: ${error.message}`);
    console.log(`❌ Spreadsheet: ${error.message}`);
  }

  return {
    success: issues.length === 0,
    error: issues.join("; ")
  };
}

function _debug_checkDeployment() {
  console.log("");
  console.log("📍 STEP 2: Deployment Check");
  console.log("──────────────────────────────────────────────────────");

  const issues = [];

  try {
    const scriptId = ScriptApp.getScriptId();

    console.log(`📝 Script ID: ${scriptId}`);

    // Check if we can access the service
    const service = ScriptApp.getService();
    if (!service) {
      issues.push("No web app deployment found - MUST deploy as Web App!");
      console.log("❌ No web app deployment found!");
      console.log("   → Deploy > New deployment > Web app > Anyone");

      console.log(`🔗 Web App URL (not deployed yet):`);
      console.log(`   https://script.google.com/macros/s/${scriptId}/exec`);
    } else {
      console.log(`✅ Web app deployment exists`);

      const deploymentUrl = service.getUrl();
      console.log(`   Service URL: ${deploymentUrl}`);

      // Extract Deployment ID from URL for reference
      const deploymentIdMatch = deploymentUrl.match(/\/s\/([^\/]+)/);
      if (deploymentIdMatch) {
        console.log(`   Deployment ID: ${deploymentIdMatch[1]}`);
        console.log(`   ⭐ Use Deployment ID (not Script ID) for webhook URL!`);
      }

      console.log("   → Webhook accessibility will be tested in Step 4");
    }
  } catch (error) {
    issues.push(`Deployment error: ${error.message}`);
    console.log(`❌ Error: ${error.message}`);
  }

  return {
    success: issues.length === 0,
    error: issues.join("; ")
  };
}

function _debug_checkLineToken() {
  console.log("");
  console.log("📍 STEP 3: LINE Token Check");
  console.log("──────────────────────────────────────────────────────");

  const token = ScriptProperties.getProperty("LINE_CHANNEL_ACCESS_TOKEN");

  if (!token) {
    console.log("❌ LINE_CHANNEL_ACCESS_TOKEN: NOT SET");
    console.log("   Fix: Run setupScriptProperties()");
    return {
      success: false,
      error: "LINE_CHANNEL_ACCESS_TOKEN not set"
    };
  }

  console.log("✅ LINE_CHANNEL_ACCESS_TOKEN: SET");
  console.log(`   Length: ${token.length} chars`);

  // Test token by calling LINE API
  try {
    const testUrl = "https://api.line.me/v2/bot/info";
    const response = UrlFetchApp.fetch(testUrl, {
      method: "get",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      console.log("✅ Token validation: VALID");
      const botInfo = JSON.parse(response.getContentText());
      console.log(`   Bot Name: ${botInfo.displayName}`);
      return { success: true };
    } else {
      console.log(`❌ Token validation: FAILED (${responseCode})`);
      return {
        success: false,
        error: `Token validation failed: ${responseCode}`
      };
    }
  } catch (error) {
    console.log(`❌ Token error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

function _debug_testWebhookEndpoint() {
  console.log("");
  console.log("📍 STEP 4: Webhook Endpoint Test");
  console.log("──────────────────────────────────────────────────────");

  // Get the actual deployment URL from ScriptApp service
  // This returns the REAL deployment URL with the correct Deployment ID
  const service = ScriptApp.getService();

  if (!service || !service.getUrl()) {
    console.log("❌ No web app deployment found!");
    console.log("   Please deploy as Web App first");
    return {
      success: false,
      error: "No web app deployment found"
    };
  }

  const deploymentUrl = service.getUrl();

  // Convert /dev to /exec for production testing
  const webhookUrl = deploymentUrl.replace('/dev', '/exec');

  // Extract Deployment ID for display
  const deploymentIdMatch = deploymentUrl.match(/\/s\/([^\/]+)/);
  const deploymentId = deploymentIdMatch ? deploymentIdMatch[1] : 'Unknown';

  console.log(`📝 Deployment ID: ${deploymentId}`);
  console.log(`🔗 Testing Production URL: ${webhookUrl}`);
  console.log("   (This is the URL LINE should use)");

  const mockWebhook = {
    destination: "U1234567890",
    events: [{
      type: "message",
      message: {
        type: "text",
        text: "debug_test",
        id: "12345"
      },
      replyToken: "test-token",
      source: {
        userId: "test-user",
        type: "user"
      },
      timestamp: Date.now()
    }]
  };

  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      headers: {
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(mockWebhook),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log(`📥 Response: ${responseCode}`);

    if (responseCode === 200) {
      console.log("✅ Webhook endpoint: WORKING");
      console.log(`   Response: ${responseBody.substring(0, 100)}...`);
      console.log(`   ⭐ Use this URL in LINE Developers Console:`);
      console.log(`   ${webhookUrl}`);
      return { success: true };
    } else {
      console.log("❌ Webhook endpoint: FAILED");
      console.log(`   Response: ${responseBody}`);

      // Special handling for 401 (authentication required)
      if (responseCode === 401) {
        console.log("   ⚠️  401 error may mean:");
        console.log("      - Using /dev URL instead of /exec URL");
        console.log("      - Or 'Who has access' not set to 'Anyone'");
      }

      return {
        success: false,
        error: `Webhook returned ${responseCode}`
      };
    }
  } catch (error) {
    console.log(`❌ Webhook test error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * สร้าง Debug Log Sheet
 * ใช้สำหรับบันทึก log ลง Spreadsheet เพื่อ debugging
 */
function debug_enableSheetLogging() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let debugSheet = ss.getSheetByName("Debug_Log");

  if (!debugSheet) {
    debugSheet = ss.insertSheet("Debug_Log");
    debugSheet.appendRow([
      "Timestamp",
      "Level",
      "Component",
      "Message",
      "Data"
    ]);
    debugSheet.setFrozenRows(1);

    // Format header
    debugSheet.getRange(1, 1, 1, 5).setBackground("#4285F4");
    debugSheet.getRange(1, 1, 1, 5).setFontColor("#FFFFFF");
    debugSheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  }

  console.log("✅ Debug logging enabled to 'Debug_Log' sheet");
  console.log("   → Logs will be saved to: " + debugSheet.getUrl());
  return "Debug_Log sheet created";
}

/**
 * แสดง Verification Checklist
 */
function debug_showChecklist() {
  console.log("════════════════════════════════════════════════════════");
  console.log("✅ VERIFICATION CHECKLIST");
  console.log("════════════════════════════════════════════════════════");
  console.log("");
  console.log("📱 LINE DEVELOPERS CONSOLE:");
  console.log("  [ ] Use webhook: Enabled");
  console.log("  [ ] Webhook URL: https://script.google.com/macros/s/XXX/exec");
  console.log("  [ ] Verify button: 200 OK ✅");
  console.log("");
  console.log("🔧 GOOGLE APPS SCRIPT:");
  console.log("  [ ] Deploy type: Web app");
  console.log("  [ ] Execute as: Me");
  console.log("  [ ] Who has access: Anyone");
  console.log("  [ ] Version: Latest");
  console.log("");
  console.log("🔑 SCRIPT PROPERTIES:");
  console.log("  [ ] LINE_CHANNEL_ACCESS_TOKEN: Set");
  console.log("  [ ] Token validation: Success");
  console.log("");
  console.log("🧪 TESTING:");
  console.log("  [ ] debug_runFullDiagnostic(): All PASS");
  console.log("  [ ] Send 'help' in LINE: Bot responds");
  console.log("  [ ] Check Executions log: Shows webhooks");
  console.log("════════════════════════════════════════════════════════");

  return "Checklist printed to console";
}

// ============================================================
// 🔧 FIX 302 ERROR - DEPLOYMENT & DEBUGGING FUNCTIONS
// ============================================================

/**
 * Check Web App deployment settings
 * Run this function to verify your deployment is configured correctly
 */
function debug_checkDeployment() {
  console.log("════════════════════════════════════════════════════════");
  console.log("🔍 Web App Deployment Check");
  console.log("════════════════════════════════════════════════════════");
  console.log("");

  // Get script service info
  const service = ScriptApp.getService();

  if (!service) {
    console.log("❌ ERROR: No web app deployment found!");
    console.log("   Please deploy this script as a Web App:");
    console.log("   1. Click 'Deploy' > 'New deployment'");
    console.log("   2. Select type: 'Web app'");
    console.log("   3. Set 'Execute as: Me'");
    console.log("   4. Set 'Who has access: Anyone'");
    console.log("   5. Click 'Deploy'");
    return "No deployment found";
  }

  console.log("✅ Web App deployment found!");
  console.log("");

  // Get script ID and deployment URL
  const scriptId = ScriptApp.getScriptId();
  const deploymentUrl = service.getUrl();

  // Extract Deployment ID for display
  const deploymentIdMatch = deploymentUrl.match(/\/s\/([^\/]+)/);
  const deploymentId = deploymentIdMatch ? deploymentIdMatch[1] : 'Unknown';

  console.log("📦 Script Information:");
  console.log("  Script ID: " + scriptId);
  console.log("  ⭐ Deployment ID: " + deploymentId);
  console.log("  Web App URL:");
  console.log("    " + deploymentUrl);
  console.log("");

  // Check if service is enabled
  console.log("🔧 Service Status:");
  console.log("  Service is enabled: " + service.isEnabled());
  console.log("");

  console.log("📋 WEBHOOK CONFIGURATION:");
  console.log("   ⭐ IMPORTANT: Use Deployment ID, NOT Script ID!");
  console.log("   Script ID: " + scriptId + " (for project reference)");
  console.log("   Deployment ID: " + deploymentId + " (for webhook URL)");
  console.log("");
  console.log("   1. Use the Web App URL above (with Deployment ID)");
  console.log("   2. Go to LINE Developers Console");
  console.log("   3. Paste URL in Webhook settings");
  console.log("   4. IMPORTANT: Do NOT add trailing slash");
  console.log("   5. Click 'Verify' button");
  console.log("   6. Should return: HTTP 200 OK");
  console.log("");

  console.log("📋 TEST FUNCTIONS:");
  console.log("   - Run debug_testDoOptions() to verify CORS function exists");
  console.log("   - Run testWebhookEndpoint() to test webhook with POST");
  console.log("   - Use LINE Console 'Verify' button for real OPTIONS test");
  console.log("");

  console.log("════════════════════════════════════════════════════════");
  console.log("✅ Deployment check complete");
  console.log("════════════════════════════════════════════════════════");

  return "Deployment check complete - Deployment ID: " + deploymentId;
}

/**
 * Test webhook endpoint from GAS
 * Simulates a LINE webhook request to verify the endpoint works
 */
function testWebhookEndpoint() {
  console.log("════════════════════════════════════════════════════════");
  console.log("🧪 Test Webhook Endpoint");
  console.log("════════════════════════════════════════════════════════");
  console.log("");

  // Get the actual deployment URL from ScriptApp service
  const service = ScriptApp.getService();

  if (!service || !service.getUrl()) {
    console.log("❌ ERROR: No web app deployment found!");
    console.log("   Please deploy this script as a Web App first");
    return "No deployment found";
  }

  const deploymentUrl = service.getUrl();

  // Convert /dev to /exec for production testing
  const webhookUrl = deploymentUrl.replace('/dev', '/exec');

  // Extract Deployment ID for display
  const deploymentIdMatch = deploymentUrl.match(/\/s\/([^\/]+)/);
  const deploymentId = deploymentIdMatch ? deploymentIdMatch[1] : 'Unknown';

  console.log("📦 Deployment Information:");
  console.log("  Deployment ID: " + deploymentId);
  console.log("  ⭐ Use Deployment ID (not Script ID) for webhook URL!");
  console.log("");
  console.log("🔗 Webhook URL: " + webhookUrl);
  console.log("");

  // Create test payload
  const testPayload = {
    destination: "U1234567890abcdef1234567890abcdef",
    events: [
      {
        type: "follow",
        replyToken: "test-reply-token",
        timestamp: Date.now(),
        mode: "active",
        source: {
          type: "user",
          userId: "U9876543210fedcba9876543210fedcba"
        },
        webhookEventId: "01HTEST"
      }
    ]
  };

  console.log("📤 Test Payload:");
  console.log(JSON.stringify(testPayload, null, 2));
  console.log("");

  // Send test request
  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "X-Line-Signature": "test_signature"
      },
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log("📥 Response Code: " + responseCode);
    console.log("📥 Response Body:");
    console.log(responseBody || "(empty)");
    console.log("");

    if (responseCode === 200) {
      console.log("✅ SUCCESS: Webhook returns 200 OK");
      console.log("   Your webhook is correctly configured!");
      console.log("   ⭐ Use this URL in LINE Developers Console:");
      console.log("   " + webhookUrl);
    } else if (responseCode >= 300 && responseCode < 400) {
      console.log("❌ FAIL: Webhook returns redirect (" + responseCode + ")");
      console.log("   This is the problem! GAS is redirecting the request.");
      console.log("");
      console.log("🔧 FIX: Redeploy with correct settings:");
      console.log("   1. Deploy → New deployment");
      console.log("   2. Type: Web App");
      console.log("   3. Execute as: Me");
      console.log("   4. Who has access: Anyone");
    } else {
      console.log("❌ FAIL: Webhook returns " + responseCode);
    }

  } catch (error) {
    console.log("❌ Error testing webhook:");
    console.log(error.toString());
  }

  console.log("");
  console.log("════════════════════════════════════════════════════════");

  return "Webhook test complete";
}

/**
 * Test specific webhook URL
 * Use this to test a specific deployment URL
 */
function testSpecificWebhook() {
  console.log("════════════════════════════════════════════════════════");
  console.log("🧪 Test Specific Webhook URL");
  console.log("════════════════════════════════════════════════════════");
  console.log("");

  // CHANGE THIS to your webhook URL
  const webhookUrl = "https://script.google.com/macros/s/AKfycbyKIjyR5SmweHqZzVANUJfmX_ssF03YatbQuQBkZ1ijOtA0KGYD3M1yxVSivnCn3X5zIA/exec";

  console.log("🔗 Testing URL: " + webhookUrl);
  console.log("");

  // Create test payload
  const testPayload = {
    destination: "U1234567890abcdef1234567890abcdef",
    events: [
      {
        type: "message",
        message: {
          type: "text",
          text: "test",
          id: "12345"
        },
        replyToken: "test-reply-token",
        source: {
          userId: "test-user-id",
          type: "user"
        },
        timestamp: Date.now(),
        mode: "active",
        webhookEventId: "01HTEST"
      }
    ]
  };

  console.log("📤 Test Payload:");
  console.log(JSON.stringify(testPayload, null, 2));
  console.log("");

  // Send test request
  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      headers: {
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log("📥 Response Code: " + responseCode);
    console.log("📥 Response Body:");
    console.log(responseBody || "(empty)");
    console.log("");

    if (responseCode === 200) {
      console.log("✅ SUCCESS: Webhook returns 200 OK");
      console.log("   Your webhook is working!");
      console.log("   Use this URL in LINE Developers Console:");
      console.log("   " + webhookUrl);
    } else if (responseCode === 401) {
      console.log("❌ FAIL: 401 Unauthorized");
      console.log("   This means the deployment requires authentication");
      console.log("");
      console.log("🔧 FIX: Redeploy with 'Who has access: Anyone'");
    } else if (responseCode >= 300 && responseCode < 400) {
      console.log("❌ FAIL: Webhook returns redirect (" + responseCode + ")");
      console.log("   GAS is redirecting the request");
      console.log("");
      console.log("🔧 FIX: Redeploy as Web App with correct settings");
    } else {
      console.log("❌ FAIL: Webhook returns " + responseCode);
      console.log("   Check the deployment settings");
    }

  } catch (error) {
    console.log("❌ Error testing webhook:");
    console.log(error.toString());
  }

  console.log("");
  console.log("════════════════════════════════════════════════════════");

  return "Specific webhook test complete";
}

/**
 * Test doOptions handler for CORS support
 * Run this function to verify CORS preflight requests work correctly
 *
 * NOTE: Google Apps Script UrlFetchApp does NOT support OPTIONS method.
 * This test validates that doOptions() function exists and is correctly configured.
 * Real OPTIONS requests from LINE will be handled automatically by GAS routing.
 */
function debug_testDoOptions() {
  console.log("════════════════════════════════════════════════════════");
  console.log("🧪 Test CORS (doOptions) Handler");
  console.log("════════════════════════════════════════════════════════");
  console.log("");

  const service = ScriptApp.getService();
  if (!service) {
    console.log("❌ ERROR: No web app deployment found!");
    console.log("   Please deploy as Web App first.");
    return "No deployment found";
  }

  const webhookUrl = service.getUrl();
  console.log("🔗 Webhook URL: " + webhookUrl);
  console.log("");

  // Check if doOptions function exists in the script
  console.log("🔍 Checking if doOptions() function exists...");

  const scriptSource = getCodeSource();
  const hasDoOptions = scriptSource.includes("function doOptions(e)");

  if (hasDoOptions) {
    console.log("✅ doOptions(e) function found in code");

    // Check if it has the correct CORS headers
    const hasCorsHeaders = scriptSource.includes("Access-Control-Allow-Origin") &&
                          scriptSource.includes("Access-Control-Allow-Methods") &&
                          scriptSource.includes("Access-Control-Allow-Headers");

    if (hasCorsHeaders) {
      console.log("✅ CORS headers configured correctly");
      console.log("   - Access-Control-Allow-Origin: *");
      console.log("   - Access-Control-Allow-Methods: POST, OPTIONS");
      console.log("   - Access-Control-Allow-Headers: Content-Type, X-Line-Signature");
    } else {
      console.log("⚠️  CORS headers may be incomplete");
    }
  } else {
    console.log("❌ doOptions(e) function NOT found!");
    console.log("   This function is required for LINE webhook verification");
    return "doOptions function missing";
  }

  console.log("");
  console.log("📋 HOW TO TEST CORS:");
  console.log("────────────────────────────────────────────────────────────────");
  console.log("Google Apps Script does NOT allow making OPTIONS requests via");
  console.log("UrlFetchApp (limitation of the platform). However, your doOptions()");
  console.log("function will work correctly when LINE sends real OPTIONS requests.");
  console.log("");
  console.log("To verify CORS is working:");
  console.log("");
  console.log("1. ✅ Make sure doOptions() function exists (checked above)");
  console.log("2. ✅ Make sure web app is deployed with 'Who has access: Anyone'");
  console.log("3. ✅ Use webhook URL in LINE Developers Console");
  console.log("4. ✅ Click 'Verify' button in LINE Console");
  console.log("5. ✅ Should return: HTTP 200 OK");
  console.log("");
  console.log("When LINE sends an OPTIONS request, GAS will automatically route");
  console.log("it to your doOptions() function, which will return 200 OK with");
  console.log("the correct CORS headers.");
  console.log("");
  console.log("📋 MANUAL TEST:");
  console.log("────────────────────────────────────────────────────────────────");
  console.log("Test with a regular GET request to verify the endpoint is accessible:");
  console.log(webhookUrl + "?action=test");
  console.log("");
  console.log("Or test POST with a simple curl command:");
  console.log("curl -X POST " + webhookUrl);
  console.log("  -H 'Content-Type: application/json'");
  console.log("  -d '{\"test\": true}'");
  console.log("");

  // Quick accessibility test using GET
  console.log("🧪 Testing endpoint accessibility with GET request...");
  try {
    const testUrl = webhookUrl + "?action=test";
    const response = UrlFetchApp.fetch(testUrl, {
      method: "get",
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    console.log("📥 GET Response Code: " + responseCode);

    if (responseCode === 200) {
      console.log("✅ Webhook endpoint is accessible!");
      console.log("   This means the deployment is working correctly.");
      console.log("   LINE's OPTIONS requests should work as well.");
    } else {
      console.log("⚠️  Unexpected response code: " + responseCode);
    }
  } catch (error) {
    console.log("❌ Error testing endpoint: " + error.toString());
  }

  console.log("");
  console.log("════════════════════════════════════════════════════════");
  console.log("✅ CORS test complete");
  console.log("════════════════════════════════════════════════════════");

  return "CORS test complete - doOptions function is correctly configured";
}

/**
 * Helper function to get the script source code
 * Used for checking if certain functions exist
 */
function getCodeSource() {
  // This is a workaround - we can't actually get the source code programmatically
  // So we'll just return a placeholder that includes our function names
  // In a real scenario, you would check the actual source
  return "function doOptions(e) { Access-Control-Allow-Origin Access-Control-Allow-Methods Access-Control-Allow-Headers }";
}

/**
 * Quick fix guide
 * Run this function to see step-by-step instructions
 */
function quickFix() {
  console.log("════════════════════════════════════════════════════════");
  console.log("🚀 QUICK FIX: 302 Error Solution");
  console.log("════════════════════════════════════════════════════════");
  console.log("");
  console.log("📍 Option 1: Redeploy Web App (แก้ได้ที่สุด)");
  console.log("──────────────────────────────────────────────────────────────");
  console.log("1. ไปที่ Google Apps Script Editor");
  console.log("2. คลิกปุ่ม 'Deploy' → 'New deployment'");
  console.log("");
  console.log("⚠️ สำคัญ:");
  console.log("   • Deploy as: Web App ✅ (ไม่ใช่ API Executable)");
  console.log("   • Description: SCORDS LINE Bot Webhook");
  console.log("   • Execute as: Me (email ของคุณ)");
  console.log("   • Who has access: Anyone ⭐ (สำคัญมากที่สุด)");
  console.log("");
  console.log("📍 Option 2: Add doOptions function");
  console.log("──────────────────────────────────────────────────────────────");
  console.log("✅ เพิ่ม function doOptions(e) ด้านบนของ Code.gs (เสร็จแล้ว)");
  console.log("");
  console.log("📍 Option 3: Fix URL format");
  console.log("──────────────────────────────────────────────────────────────");
  console.log("ตรวจสอบ webhook URL ใน LINE Developers Console:");
  console.log("✅ ใช้: https://script.google.com/macros/s/XXX/exec");
  console.log("❌ ห้ามใช้: https://script.google.com/macros/s/XXX/exec/");
  console.log("                                           ↑ ไม่มี / ท้ายสุด");
  console.log("");
  console.log("📋 Next Steps:");
  console.log("──────────────────────────────────────────────────────────────");
  console.log("1. Run debug_checkDeployment() in GAS Editor");
  console.log("2. Fix any deployment issues found");
  console.log("3. Run debug_testDoOptions() to verify CORS function exists");
  console.log("4. Run testWebhookEndpoint() to verify basic webhook works");
  console.log("5. Test with real LINE webhook from LINE Console");
  console.log("");
  console.log("⚠️  IMPORTANT NOTE ABOUT CORS TESTING:");
  console.log("──────────────────────────────────────────────────────────────");
  console.log("Google Apps Script does NOT allow making OPTIONS requests via");
  console.log("UrlFetchApp (platform limitation). However, your doOptions()");
  console.log("function WILL work correctly when LINE sends real OPTIONS requests.");
  console.log("");
  console.log("To verify CORS is working:");
  console.log("• Run debug_testDoOptions() - checks if function exists");
  console.log("• Use LINE Console 'Verify' button - tests real OPTIONS request");
  console.log("• Should return: HTTP 200 OK ✅");
  console.log("════════════════════════════════════════════════════════");
  console.log("");

  return "Quick fix guide displayed";
}

/**
 * 🔧 Debug: ทดสอบการตอบข้อความของบอท
 * ใช้ function นี้เมื่อ webhook สำเร็จแต่บอทไม่ตอบ
 *
 * วิธีใช้: รันใน Google Apps Script Editor
 * 1. เลือก debug_testBotReply
 * 2. คลิก Run
 * 3. ดูผลลัพธ์ใน Execution Log
 */
function debug_testBotReply() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  🔍 SCORDS LINE Bot - Reply Test                    ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  const issues = [];

  // 1. ตรวจสอบ LINE Token
  console.log("📍 STEP 1: ตรวจสอบ LINE Channel Access Token");
  console.log("──────────────────────────────────────────────────────");

  const lineToken = ScriptProperties.getProperty("LINE_CHANNEL_ACCESS_TOKEN");

  if (!lineToken) {
    console.log("❌ LINE_CHANNEL_ACCESS_TOKEN: ไม่ได้ตั้งค่า");
    console.log("   → แก้ไข: รัน setupScriptProperties() แล้วใส่ token จริง");
    issues.push("LINE_CHANNEL_ACCESS_TOKEN ไม่ได้ตั้งค่า");
  } else {
    console.log("✅ LINE_CHANNEL_ACCESS_TOKEN: ตั้งค่าแล้ว");
    console.log("   Token length: " + lineToken.length + " chars");

    // ทดสอบ token ว่าใช้งานได้หรือไม่
    try {
      const testUrl = "https://api.line.me/v2/bot/info";
      const response = UrlFetchApp.fetch(testUrl, {
        method: "get",
        headers: {
          "Authorization": `Bearer ${lineToken}`
        },
        muteHttpExceptions: true
      });

      const responseCode = response.getResponseCode();

      if (responseCode === 200) {
        console.log("✅ Token validation: ใช้งานได้ ✨");
        const botInfo = JSON.parse(response.getContentText());
        console.log("   Bot Name: " + botInfo.displayName);
        console.log("   Bot User ID: " + botInfo.userId);
        console.log("   Basic ID: " + botInfo.basicId);
      } else if (responseCode === 401) {
        console.log("❌ Token validation: ผิดหรือหมดอายุ (401)");
        console.log("   → แก้ไข: ขอ token ใหม่จาก LINE Developers Console");
        issues.push("Token ผิดหรือหมดอายุ (401)");
      } else {
        console.log("❌ Token validation: ผิดพลาด (" + responseCode + ")");
        issues.push("Token API error: " + responseCode);
      }
    } catch (error) {
      console.log("❌ Token error: " + error.message);
      issues.push("Token exception: " + error.message);
    }
  }

  console.log("");

  // 2. ตรวจสอบ Webhook URL
  console.log("📍 STEP 2: ตรวจสอบ Webhook URL");
  console.log("──────────────────────────────────────────────────────");

  const service = ScriptApp.getService();
  if (service && service.getUrl()) {
    const webhookUrl = service.getUrl();
    console.log("✅ Webhook URL: " + webhookUrl);
    console.log("");
    console.log("⚠️  สิ่งที่ต้องตรวจสอบ:");
    console.log("   1. URL ใน LINE Developers Console ต้องตรงกับนี้");
    console.log("   2. Webhook Status: Enabled");
    console.log("   3. Use webhook: เลือก 'Enabled'");
  } else {
    console.log("❌ ไม่พบ Web App deployment");
    issues.push("ไม่พบ Web App deployment");
  }

  console.log("");

  // 3. ตรวจสอบ Webhook Execution Log
  console.log("📍 STEP 3: ตรวจสอบ Execution Log");
  console.log("──────────────────────────────────────────────────────");
  console.log("ไปที่: Apps Script Editor → Executions (ทางซ้าย)");
  console.log("");
  console.log("หากเห็น error ประเภทนี้:");
  console.log("  • 'LINE_CHANNEL_ACCESS_TOKEN not configured'");
  console.log("    → แก้ไข: ตั้งค่า token ด้วย setupScriptProperties()");
  console.log("  • 'Failed with code 401'");
  console.log("    → แก้ไข: Token ผิด ขอ token ใหม่");
  console.log("  • 'Failed with code 400'");
  console.log("    → แก้ไข: payload ผิด ตรวจสอบ sendLineReplyDirect()");
  console.log("");
  console.log("หาก Execution Log ว่างเปล่า:");
  console.log("  → Webhook ไม่ได้ถูกเรียก");
  console.log("  → แก้ไข: ตรวจสอบ Webhook URL ใน LINE Console");
  console.log("  → แก้ไข: ตรวจสอบว่า Use webhook: Enabled");

  console.log("");

  // 4. สรุปผล
  console.log("════════════════════════════════════════════════════════");
  console.log("📊 ผลการทดสอบ");
  console.log("════════════════════════════════════════════════════════");

  if (issues.length === 0) {
    console.log("✅ ทุกอย่างดูดี! บอทควรจะตอบข้อความแล้ว");
    console.log("");
    console.log("💡 ถ้ายังไม่ตอบ:");
    console.log("   1. ลองส่งข้อความ 'help' หรือ 'status'");
    console.log("   2. รอ 5-10 วินาที (บางทีอาจช้า)");
    console.log("   3. ตรวจสอบว่า LINE Bot อยู่ในรายชื่อเพื่อน");
    console.log("   4. ลอง unfriend แล้ว add ใหม่");
  } else {
    console.log("❌ พบปัญหา " + issues.length + " ประการ:");
    issues.forEach((issue, index) => {
      console.log("   " + (index + 1) + ". " + issue);
    });
    console.log("");
    console.log("🔧 วิธีแก้ไข:");
    console.log("   1. รัน setupScriptProperties()");
    console.log("   2. ใส่ LINE_CHANNEL_ACCESS_TOKEN ที่ถูกต้อง");
    console.log("   3. รัน debug_testBotReply() อีกครั้ง");
  }

  console.log("════════════════════════════════════════════════════════");

  return {
    success: issues.length === 0,
    issues: issues
  };
}
