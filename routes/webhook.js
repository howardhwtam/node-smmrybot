const express = require('express');
const request = require('request');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

const PAGE_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.HUB_VERIFY_TOKEN;

const HELP_MSG = "Simply paste the URL of an online article here, and I will return a five-sentence summary.";
const BS_MSG = "I do not have time for chit-chat, human. If you are unsure what my purpose is, type 'help'.";
const S_TOO_SHORT_MSG = "Your article is too short to be summarized. Please try another article.";
const S_NOT_RECKON_MSG = "Sorry - I could not recognize the webpage's format. Please try another article.";
const S_ERROR_MSG = "Please try again later or try another article.";
const S_SUCCESS_MSG = "Got another article? Send me the link!";

const router = express.Router();


router.get('/', function (req, res) {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  }
  res.send('Verify token error');
});


router.post('/', function (req, res) {
  let messagingEvents = req.body.entry[0].messaging;

  for (let i = 0; i < messagingEvents.length; i++) {
    let event = req.body.entry[0].messaging[i];
    let sender = event.sender.id;
    let text = eventUnpacker(event);

    if (urlDetector(text)) {
      let url = urlDetector(text)
      sendSmmry(sender, urlTrimmer(url));
    } else if (text.trim().toLowerCase() === 'help') {
      sendTextMessage(sender, HELP_MSG);
    } else {
      sendTextMessage(sender, BS_MSG);
    }
  }
  res.sendStatus(200);
});


function eventUnpacker(event) {
  if (event.message) {
    if (event.message.text) {
      return event.message.text;
    } else if (event.message.attachments[0].url) {
      return event.message.attachments[0].url;
    }
  } else if (event.postback) {
    return 'help';
  } else {
    return 'USER_SENT_GIBBERSIH'; // like gif or a pic lol
  }
};


function sendTextMessage(sender, text) {
  let messageData = {
    text: text
  }
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {
      access_token: PAGE_TOKEN
    },
    method: 'POST',
    json: {
      recipient: { id: sender },
      message: messageData
    }
  }, function(error, response, body) {
    if (error) {
      console.log('ERROR sending message: ', error);
    } else if (response.body.error) {
      console.log('ERROR: ', response.body.error);
    }
  });
};


function getSmmryArray(url, n) {
  let xhr = new XMLHttpRequest();
  let smmryURL = "http://api.smmry.com/&SM_API_KEY=C3DE141F43&SM_WITH_BREAK&SM_LENGTH=" + n + "&SM_URL=" + url;

  console.log('Making a request to: ', smmryURL);

  xhr.open('GET', smmryURL, false);
  xhr.send();

  let jsonRes = JSON.parse(xhr.responseText);
  if (jsonRes['sm_api_content']) {
    let title = jsonRes['sm_api_title'].replace('\\', '').toUpperCase();
    let smmryArr = jsonRes['sm_api_content'].trim().split('[BREAK]');

    console.log('[SMMRY API]', jsonRes['sm_api_limitation']);

    smmryArr.pop();
    smmryArr.push(S_SUCCESS_MSG);
    // smmryArr.unshift(title);
    return smmryArr;

  } else if (jsonRes['sm_api_error']) {
    console.log('[ERROR]', jsonRes['sm_api_error'], jsonRes['sm_api_message']);

    if (jsonRes['sm_api_message'] === 'TEXT IS TOO SHORT') {
      return [S_TOO_SHORT_MSG];
    } else if (jsonRes['sm_api_message'] === 'THE PAGE IS IN AN UNRECOGNISABLE FORMAT') {
      return [S_NOT_RECKON_MSG];
    } else {
      return [S_ERROR_MSG];
    }
  }
};


function asyncArrayLoop(sender, arr, i) {
  if (i < arr.length) {
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: { access_token: PAGE_TOKEN },
      method: 'POST',
      json: {
        recipient: { id: sender },
        message: { text: arr[i] }
      }
    }, function (error, response, body) {
      if (error) {
	console.log ('ERROR SENDING MESSAGE: ', error);
      } else if (response.body.error) {
	console.log ('ERROR: ', response.body.error);
      }
      asyncArrayLoop(sender, arr, i + 1)
    });
  }
};


function sendSmmry(sender, articleURL) {
  let smmryArr = getSmmryArray(articleURL, 5);
  asyncArrayLoop(sender, smmryArr, 0);
};


function urlTrimmer(url) {
  return url
    .replace(/https:\/\/l\.messenger\.com\/l\.php\?u=/, '')
    .replace(/https:\/\/l\.facebook\.com\/l\.php\?u=/, '')
    .replace(/&h=.+/, '');
};


function urlDetector(text) {
  let re = /(http:\/\/|https:\/\/|www)\S+/g;
  let result = re.exec(text);

  if (result) {
    return result[0];
  }
};

module.exports = router;
