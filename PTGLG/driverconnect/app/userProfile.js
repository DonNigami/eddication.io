/********************************
 * Helper: userprofile status helper (อ่านจาก header)
 ********************************/
function getUserStatus(userId) {
  if (!userId) return null;

  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_USER_PROFILE);
    if (!sheet) {
      Logger.log('getUserStatus: sheet not found');
      return null;
    }

    const values = sheet.getDataRange().getValues();
    if (!values || values.length < 2) {
      Logger.log('getUserStatus: no data rows');
      return null;
    }

    const header = values[0].map(h => String(h || '').toLowerCase().trim());

    let idxUserId = header.findIndex(h =>
      h === 'userid' || h === 'user_id' || h === 'user id'
    );
    let idxStatus = header.findIndex(h => h === 'status');

    if (idxUserId === -1) idxUserId = COL_USER_ID - 1;
    if (idxStatus === -1) idxStatus = COL_STATUS   - 1;

    Logger.log('getUserStatus: idxUserId=' + idxUserId + ', idxStatus=' + idxStatus);

    const targetId = String(userId).trim();

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowUserId = String(row[idxUserId] || '').trim();
      if (rowUserId === targetId) {
        const status = row[idxStatus];
        Logger.log('getUserStatus: found userId=' + targetId + ', status=' + status);
        return status || null;
      }
    }

    Logger.log('getUserStatus: userId not found = ' + targetId);
    return null;
  } catch (err) {
    Logger.log('getUserStatus ERROR: ' + err);
    return null;
  }
}

/********************************
 * Helper: ตรวจว่า userId นี้เป็น Admin หรือไม่
 ********************************/
function isAdminUser(userId) {
  if (!userId) return false;

  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_USER_PROFILE);
    if (!sheet) {
      Logger.log('isAdminUser: sheet not found');
      return false;
    }

    const values = sheet.getDataRange().getValues();
    if (!values || values.length < 2) {
      Logger.log('isAdminUser: no data rows');
      return false;
    }

    const header = values[0].map(h => String(h || '').toLowerCase().trim());

    let idxUserId   = header.findIndex(h =>
      h === 'userid' || h === 'user_id' || h === 'user id'
    );
    let idxStatus   = header.findIndex(h => h === 'status');
    let idxUserType = header.findIndex(h =>
      h === 'usertype' || h === 'user_type' || h === 'role'
    );

    if (idxUserId   === -1) idxUserId   = COL_USER_ID   - 1;
    if (idxStatus   === -1) idxStatus   = COL_STATUS    - 1;
    if (idxUserType === -1) idxUserType = COL_USERTYPE  - 1;

    Logger.log(
      'isAdminUser: idxUserId=' + idxUserId +
      ', idxStatus=' + idxStatus +
      ', idxUserType=' + idxUserType
    );

    const targetId = String(userId).trim();

    for (let i = 1; i < values.length; i++) {
      const row      = values[i];
      const rowUserId= String(row[idxUserId]   || '').trim();
      const rawStatus= String(row[idxStatus]   || '').trim();
      const rawType  = String(row[idxUserType] || '').trim();

      if (rowUserId !== targetId) continue;

      const status   = rawStatus.toUpperCase();
      const userType = rawType.toLowerCase();

      Logger.log(
        'isAdminUser: found row for ' + targetId +
        ' -> status=' + status + ', userType=' + userType
      );

      if (status === 'APPROVED' && userType === 'admin') {
        return true;
      }
      return false;
    }

    Logger.log('isAdminUser: userId not found = ' + targetId);
    return false;
  } catch (err) {
    Logger.log('isAdminUser ERROR: ' + err);
    return false;
  }
}

/********************************
 * follow → เก็บ userprofile
 ********************************/
function handleFollowEvent(event) {
  const userId = event.source.userId;

  const profile = getLineUserProfile(userId);
  const displayName = profile.displayName || '';
  const pictureUrl  = profile.pictureUrl  || '';

  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_USER_PROFILE);

  const lastRow = sheet.getLastRow();
  const data = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, COL_UPDATED_AT).getValues()
    : [];

  const now = new Date();
  const idx = data.findIndex(r => r[COL_USER_ID - 1] === userId);

  if (idx === -1) {
    sheet.appendRow([
      userId,
      displayName,
      pictureUrl,
      'PENDING',
      now,
      now
    ]);
  } else {
    const row = idx + 2;
    sheet.getRange(row, COL_DISPLAY_NAME).setValue(displayName);
    sheet.getRange(row, COL_PICTURE_URL).setValue(pictureUrl);
    sheet.getRange(row, COL_UPDATED_AT).setValue(now);
  }

  const msg =
    'ขอบคุณที่แอดไลน์ครับ 🙏\n' +
    'ระบบได้รับข้อมูลแล้ว กรุณารอแอดมินอนุมัติการใช้งานแอปคนขับ.';
  sendLineReply(CHANNEL_ACCESS_TOKEN, event.replyToken, msg);
}

/********************************
 * message event
 ********************************/
function handleMessageEvent(event) {
  const text  = (event.message.text || '').trim();
  const userId = event.source.userId;

  if (text === 'status') {
    const status = getUserStatus(userId);
    const reply = 'สถานะของคุณ: ' + (status || 'ไม่พบข้อมูล / ยังไม่ลงทะเบียน');
    sendLineReply(CHANNEL_ACCESS_TOKEN, event.replyToken, reply);
  } else {
    const reply = 'หากคุณเป็นคนขับงานนี้ ให้กดเมนูด้านล่างเพื่อเข้าแอปรับงานครับ';
    sendLineReply(CHANNEL_ACCESS_TOKEN, event.replyToken, reply);
  }
}

/********************************
 * onEdit: แอดมินอนุมัติแล้ว → ผูก Rich Menu
 ********************************/
function onEdit(e) {
  try {
    if (!e || !e.range) {
      Logger.log('onEdit called without event object.');
      return;
    }

    const editedSheet = e.range.getSheet();
    const editedSheetName = editedSheet.getName();
    const ssId = e.source && e.source.getId ? e.source.getId() : 'unknown';

    Logger.log(
      'onEdit fired on spreadsheetId=' + ssId + ', sheet=' + editedSheetName +
      ', row=' + e.range.getRow() + ', col=' + e.range.getColumn()
    );

    if (ssId !== SHEET_ID) {
      Logger.log('onEdit: edited spreadsheet is not main SHEET_ID, skip.');
      return;
    }
    if (editedSheetName !== SHEET_USER_PROFILE) {
      Logger.log('onEdit: edited sheet is not userprofile, skip.');
      return;
    }

    const row = e.range.getRow();
    const col = e.range.getColumn();

    if (row === 1) {
      Logger.log('onEdit: header row, skip.');
      return;
    }

    if (col === COL_STATUS) {
      const rawStatus = e.range.getValue();
      const newStatus = String(rawStatus).trim().toUpperCase();
      const userId    = editedSheet.getRange(row, COL_USER_ID).getValue();
      const now       = new Date();

      Logger.log(
        'onEdit status change at row=' + row +
        ', rawStatus="' + rawStatus + '", normalized="' + newStatus + '", userId=' + userId
      );

      editedSheet.getRange(row, COL_UPDATED_AT).setValue(now);

      if (newStatus === 'APPROVED' && userId) {
        Logger.log('onEdit: calling linkRichMenuToUser for userId=' + userId);
        const result = linkRichMenuToUser(userId, RICH_MENU_ID_MENU1);
        Logger.log('onEdit: linkRichMenuToUser result=' + JSON.stringify(result));
      } else {
        Logger.log('onEdit: status is not APPROVED or userId empty, skip linking.');
      }
    } else {
      Logger.log('onEdit: edited column is not COL_STATUS, skip.');
    }
  } catch (error) {
    Logger.log('🔥 onEdit error: ' + error);
  }
}
