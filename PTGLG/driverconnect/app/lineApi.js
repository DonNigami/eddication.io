/********************************
 * LINE API Helper
 ********************************/
function getLineUserProfile(userId) {
  const url = 'https://api.line.me/v2/bot/profile/' + userId;
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
    },
    muteHttpExceptions: true
  });
  return JSON.parse(res.getContentText() || '{}');
}

function sendLineReply(token, replyToken, messageText) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    replyToken: replyToken,
    messages: [{ type: 'text', text: messageText }]
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/********************************
 * Rich Menu helper
 ********************************/
function linkRichMenuToUser(userId, richMenuId) {
  const url = 'https://api.line.me/v2/bot/user/' + userId + '/richmenu/' + richMenuId;
  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
    },
    muteHttpExceptions: true
  };

  let res, code, body;
  try {
    res  = UrlFetchApp.fetch(url, options);
    code = res.getResponseCode();
    body = res.getContentText();
  } catch (err) {
    Logger.log('linkRichMenuToUser ERROR: ' + err);
    return { code: 0, body: String(err) };
  }

  Logger.log('linkRichMenuToUser: code=' + code + ', body=' + body);
  return { code: code, body: body };
}
