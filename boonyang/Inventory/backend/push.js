function pushMessageToAllUsers() {
  const spreadsheet = SpreadsheetApp.openById("1izokvbl6DQMg81JdTzRDr3Vk6evTgIir5pBU-HHUZOk");
  var settingBot = spreadsheet.getSheetByName("setting");
  var LINE_ACCESS_TOKEN = settingBot.getRange("B1").getValue(); 
  var sheet = spreadsheet.getSheetByName("push");
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues(); 

  const results = [];

  data.forEach(function(row) {
    const userId = row[0];
    const altText = row[1];
    const message = row[2];
    let status = '';

    if (userId && message) {
      try {
        const response = sendPushMessage(userId, altText, message, LINE_ACCESS_TOKEN);
        const result = JSON.parse(response.getContentText());

        if (response.getResponseCode() === 200) {
          status = 'ส่งสำเร็จ';
        } else {
          status = 'ล้มเหลว: ' + JSON.stringify(result);
        }
      } catch (e) {
        status = 'ล้มเหลว: ' + e.toString();
      }
    }

    results.push([status]);
  });

  
  sheet.getRange(2, 4, results.length, 1).setValues(results);
}

function sendPushMessage(userId, altText, message, LINE_ACCESS_TOKEN) {
  const url = "https://api.line.me/v2/bot/message/push";

  const payload = {
    to: userId,
    messages: [
      {
        type: "flex",
        altText: altText,
        contents: JSON.parse(message)
      }
    ]
  };

  const options = {
    method: "post",
    headers: {
      "Authorization": "Bearer " + LINE_ACCESS_TOKEN,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true 
  };

  
  return UrlFetchApp.fetch(url, options);
}
