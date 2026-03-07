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
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

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
      default:
        throw new Error("Invalid action specified.");
    }
  } catch (error) {
    console.error("doPost Error: " + error.toString());
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
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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
  const useProvider = requestData.provider || "zai"; // "zai" or "openai"

  try {
    // 1. Search knowledge base (keyword matching)
    const knowledge = searchKnowledgeBase(query);

    // 2. Search points rules
    const pointsInfo = searchPointsRules(query);

    // 3. Search PDF documents (if available)
    const pdfInfo = searchPDFDocuments(query);

    // 4. Build context for AI
    const contextText = buildContext(knowledge, pointsInfo, pdfInfo, context);

    // 5. Call AI API (Z.AI as primary, OpenAI as fallback)
    let aiResponse;
    try {
      if (useProvider === "zai") {
        aiResponse = callGLM(query, contextText);
      } else {
        aiResponse = callOpenAI(query, contextText);
      }
    } catch (glmError) {
      console.warn("Z.AI API failed, trying OpenAI fallback: " + glmError.toString());
      aiResponse = callOpenAI(query, contextText);
      aiResponse.fallback = "Used OpenAI after Z.AI failure";
    }

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
        fallback: aiResponse.fallback || null
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
 */
function searchPDFDocuments(query) {
  try {
    // รับ PDF folder ID จาก ScriptProperties
    const pdfFolderId = ScriptProperties.getProperty("PDF_FOLDER_ID");

    if (!pdfFolderId) {
      console.log("PDF_FOLDER_ID not found, skipping PDF search");
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
    return [];
  }
}

/**
 * ดึงข้อความจาก PDF (ใช้ Google Drive OCR)
 */
function extractTextFromPDF(blob) {
  try {
    // แปลง PDF เป็นรูปภาพแล้ว OCR
    // หรือใช้วิธีอ่าน PDF โดยตรง (Google Apps Script อาจไม่รองรับโดยตรง)

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
 * เรียก Z.AI API (z.ai - รุ่น glm-5)
 * Z.AI API เป็น OpenAI-compatible API ที่รองรับภาษาไทยได้ดี และราคาถูก
 */
function callGLM(query, context) {
  const apiKey = ScriptProperties.getProperty("ZAI_API_KEY");

  if (!apiKey) {
    throw new Error("ZAI_API_KEY not found in ScriptProperties");
  }

  const apiUrl = "https://api.z.ai/api/paas/v4/chat/completions";

  const prompt = `
คุณคือผู้ช่วย AI สำหรับระบบ SCORDS (SMART CHECK-IN)
ตอบคำถามเกี่ยวกับ SCOR framework, ระบบแต้มสะสม, และกิจกรรมต่างๆ

ความรู้ที่เกี่ยวข้อง:
${context}

คำถาม: ${query}

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
      model: "glm-5",
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
      max_tokens: 500,
      temperature: 0.7
    }),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode !== 200) {
    console.error("Z.AI API Error: " + responseBody);
    throw new Error("Z.AI API request failed with code " + responseCode);
  }

  const result = JSON.parse(responseBody);
  const answer = result.choices[0].message.content;

  // Z.AI GLM-5 pricing: ~0.5 THB/M input tokens, ~2 THB/M output tokens
  const inputTokens = result.usage.prompt_tokens;
  const outputTokens = result.usage.completion_tokens;
  const costTHB = (inputTokens * 0.0000005) + (outputTokens * 0.000002);
  const costUSD = costTHB * 0.028; // Convert to USD (1 THB ≈ 0.028 USD)

  return {
    answer,
    cost: costUSD,
    costTHB: costTHB,
    tokens: { input: inputTokens, output: outputTokens },
    model: "glm-5 (z.ai)"
  };
}

/**
 * เรียก OpenAI API (GPT-4o mini) - Fallback option
 */
function callOpenAI(query, context) {
  const apiKey = ScriptProperties.getProperty("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not found in ScriptProperties");
  }

  const apiUrl = "https://api.openai.com/v1/chat/completions";

  const prompt = `
คุณคือผู้ช่วย AI สำหรับระบบ SCORDS (SMART CHECK-IN)
ตอบคำถามเกี่ยวกับ SCOR framework, ระบบแต้มสะสม, และกิจกรรมต่างๆ

ความรู้ที่เกี่ยวข้อง:
${context}

คำถาม: ${query}

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
      model: "gpt-4o-mini",
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
      max_tokens: 500,
      temperature: 0.7
    }),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode !== 200) {
    console.error("OpenAI API Error: " + responseBody);
    throw new Error("OpenAI API request failed with code " + responseCode);
  }

  const result = JSON.parse(responseBody);
  const answer = result.choices[0].message.content;

  // Calculate cost
  const inputTokens = result.usage.prompt_tokens;
  const outputTokens = result.usage.completion_tokens;
  const cost = (inputTokens * 0.00000015) + (outputTokens * 0.00000060);

  return {
    answer,
    cost,
    tokens: { input: inputTokens, output: outputTokens }
  };
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
 */
function setupScriptProperties() {
  // Z.AI API Key (หลัก - ถูกกว่า OpenAI)
  // รับจาก: https://z.ai/
  ScriptProperties.setProperty("ZAI_API_KEY", "your-zai-api-key-here");

  // OpenAI API Key (สำรอง)
  // รับจาก: https://platform.openai.com/api-keys
  ScriptProperties.setProperty("OPENAI_API_KEY", "your-openai-api-key-here");

  // Google Drive Folder ID สำหรับเก็บ PDF documents
  // Folder URL: https://drive.google.com/drive/folders/1qvA0sMG024kezPynLHidvpCFUtkj-TjS
  ScriptProperties.setProperty("PDF_FOLDER_ID", "1qvA0sMG024kezPynLHidvpCFUtkj-TjS");

  console.log("✅ Script Properties setup complete!");
  console.log("PDF Folder ID: " + ScriptProperties.getProperty("PDF_FOLDER_ID"));
  console.log("ZAI API Key: " + (ScriptProperties.getProperty("ZAI_API_KEY") ? "✅ Set" : "❌ Not set"));
  console.log("OpenAI API Key: " + (ScriptProperties.getProperty("OPENAI_API_KEY") ? "✅ Set" : "❌ Not set"));
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

    // ตรวจสอบ API Keys
    const zaiKey = ScriptProperties.getProperty("ZAI_API_KEY");
    const openaiKey = ScriptProperties.getProperty("OPENAI_API_KEY");

    if (!zaiKey && !openaiKey) {
      console.log("❌ No API keys found. Please run setupScriptProperties() first.");
      return { success: false, error: "No API keys found" };
    }

    // ทดสอบ askAI function
    const result = askAI({
      query: testQuery,
      context: { userId: "test_user", group: "IT" },
      provider: zaiKey ? "zai" : "openai"
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