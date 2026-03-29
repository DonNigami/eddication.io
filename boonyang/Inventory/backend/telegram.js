function sendTelegramNotificationWithImage(msg , img , caption) {
  const spreadsheet = SpreadsheetApp.openById("1izokvbl6DQMg81JdTzRDr3Vk6evTgIir5pBU-HHUZOk");
  var settingBot = spreadsheet.getSheetByName("setting");
  var telegramApiToken = settingBot.getRange("B7").getValues() ;
  var botchatId = settingBot.getRange("B8").getValues() ;
  var textUrl = 'https://api.telegram.org/bot' + telegramApiToken + '/sendMessage';
  var photoUrl = 'https://api.telegram.org/bot' + telegramApiToken + '/sendPhoto';
  var buttontelegram = settingBot.getRange("B9").getValues();
 
  
  // ส่งข้อความ
  var textPayload = {
    'chat_id': JSON.parse(botchatId),
    'text': msg
  };
  
  var textOptions = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(textPayload)
  };
  
  UrlFetchApp.fetch(textUrl, textOptions);
 

  // ส่งรูปภาพ
  var photoPayload = {
    'chat_id': JSON.parse(botchatId),
    'photo': img, 
    'caption': caption ,
    'reply_markup': {
      'inline_keyboard':  JSON.parse(buttontelegram)
      
    }
  };
  
  var photoOptions = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(photoPayload)
  };
  
 UrlFetchApp.fetch(photoUrl, photoOptions);

}