function setLineWebhook() {
  const spreadsheet = SpreadsheetApp.openById("1izokvbl6DQMg81JdTzRDr3Vk6evTgIir5pBU-HHUZOk");
  var settingBot = spreadsheet.getSheetByName("setting");
  var channelAccessToken = settingBot.getRange("B1").getValue() ; 
  var webhookUrl = settingBot.getRange("B10").getValue() ;

  var url = 'https://api.line.me/v2/bot/channel/webhook/endpoint';
  var options = {
    method: 'put',
    headers: {
      'Authorization': 'Bearer ' + channelAccessToken,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      endpoint: webhookUrl
    }),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());
  settingBot.getRange("C10").setValue(response.getContentText()) ;
}
