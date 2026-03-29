function replyFromSheet(data) {
  try {
    Logger.log("📖 replyFromSheet() called with text: " + data.message.text);

    const spreadsheet = SpreadsheetApp.openById("1izokvbl6DQMg81JdTzRDr3Vk6evTgIir5pBU-HHUZOk");
    const settingBot = spreadsheet.getSheetByName("setting");
    const LINE_CHANNEL_TOKEN = settingBot.getRange("B1").getValue();
    const sh = spreadsheet.getSheetByName("reply");
    var replyUrl = "https://api.line.me/v2/bot/message/reply";

    var lastRow = sh.getLastRow();
    Logger.log("📋 Reply sheet last row: " + lastRow);

    var wordList = sh.getRange(1, 1, lastRow, 11).getValues();

    var userId = data.source.userId;
    var reply_token = data.replyToken;
    var text = data.message.text.trim().toLowerCase(); // 🔧 Convert to lowercase
    var username = getUserName(data.source.userId).displayName;
    var userprof = getUserName(data.source.userId).pictureUrl;

    Logger.log("👤 User: " + username + " (" + userId + ")");
    Logger.log("💬 Searching for: \"" + text + "\" (Exact Match + Lowercase)");

    var replyType = [];
    var replyList = [];

    // 🔧 Exact Match with Lowercase
    for (var i = 1; i < wordList.length; i++) {
      var keyword = String(wordList[i][0]).toLowerCase().trim(); // Convert keyword to lowercase
      if (keyword === text) {
        replyType.push(wordList[i][1]);
        replyList.push(wordList[i]);
        Logger.log("✅ Exact match found at row " + (i + 1) + ", type: " + wordList[i][1]);
      }
    }

    if (replyType.length < 1) {
      Logger.log("⚠️ No exact matches found for \"" + text + "\"");
      return;
    } else if (replyType.length > 5) {
      var messageLength = 5;
    } else {
      var messageLength = replyType.length;
    }

    Logger.log("📦 Preparing " + messageLength + " messages");

    var messageArray = [];

    for (var j = 0; j < messageLength; j++) {
      switch (replyType[j]) {
         case "text":
          messageArray.push({ type: replyType[j], text: replyList[j][2], quoteToken: data.message.quoteToken });
          Logger.log("📝 text: " + replyList[j][2].substring(0, 50));
          break;
          case "textv2":
          messageArray.push({ type: "textV2", text: "{user1} " + replyList[j][2], "substitution": {
                            "user1": {
                            "type": "mention",
                            "mentionee": {
                            "type": "user",
                             "userId": userId
                                   }
                                }
                          } });
          Logger.log("💬 textv2");
          break;
             case "flex":
          messageArray.push({
            type: replyType[j],
            altText: "this is a FlexMessage",
            contents: JSON.parse(replyList[j][2])
          });
          Logger.log("🎨 flex");
          break;

        case "template":
          messageArray.push(JSON.parse(replyList[j][2]));
          Logger.log("📋 template");
          break;

        case "telegram":
          messageArray.push({ type: "text", text: replyList[j][2], quoteToken: data.message.quoteToken });
          var msg = replyList[j][3]
          var img = userprof
          var caption = username
          sendTelegramNotificationWithImage(msg , img , caption)
          Logger.log("📤 telegram");
          break

      }
    }

    var headers = {
      "Content-Type": "application/json; charset=UTF-8",
      Authorization: "Bearer " + LINE_CHANNEL_TOKEN
    };

    var postData = {
      replyToken: reply_token,
      messages: messageArray
    };

    var options = {
      method: "post",
      headers: headers,
      payload: JSON.stringify(postData)
    };

    Logger.log("🚀 Sending reply...");
    UrlFetchApp.fetch(replyUrl, options);
    Logger.log("✅ replyFromSheet completed successfully");

  } catch (e) {
    Logger.log("❌ ERROR @ replyFromSheet: " + e + "\n" + e.stack);
  }
}