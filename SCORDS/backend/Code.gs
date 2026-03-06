const SPREADSHEET_ID = "1nvNFkeUUU7tTnTlE0UkKt0tZqxYe4fxOI7crTtiEsrM";
const SHEET_NAMES = {
  USERS: "Users",
  ACTIVITIES: "Activities",
  LOG: "Checkin_Log",
  GROUPS: "Groups"
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
  const headers = values.shift() || [];
  return values.map(row => {
    return headers.reduce((obj, header, index) => {
      obj[header] = row[index];
      return obj;
    }, {});
  });
}

/**
 * ค้นหาแถวใน Sheet ตาม column และค่าที่ต้องการ
 */
function findRow(sheet, columnName, value) {
  const data = getSheetData(sheet);
  return data.find(row => row[columnName] == value) || null;
}
