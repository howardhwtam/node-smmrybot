const express = require('express');
const request = require('request');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

const pageToken = process.env.PAGE_ACCESS_TOKEN;
const verifyToken = process.env.HUB_VERIFY_TOKEN;

const helpMessage = "Simply paste the URL of an online article here, and I will return a five-sentence summary.";
const bsMessage = "I do not have time for chit-chat, human. If you are unsure what my purpose is, type 'help'.";
const smmryTextTooShortMessage = "Your article is too short to be summarized. Please try another article.";
const smmryTextNotReckonMessage = "Sorry - I could not recognize the webpage's format. Please try another article.";
const smmryErrorMessage = "Please try again later or try another article.";
const smmrySucessMessage = "Got another article? Send me the link!";

const router = express.Router();


router.get('/', function (req, res) {
  if (req.query['hub.verify_token'] === verifyToken) {
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
    
    if (isLegitURL(text)) {
      sendSmmry(sender, urlTrimmer(text));
    } else if (text.trim().toLowerCase() === 'help') {
      sendTextMessage(sender, helpMessage);
    } else {
      sendTextMessage(sender, bsMessage);
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
      access_token: pageToken
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
    smmryArr.push(smmrySucessMessage);
    // smmryArr.unshift(title);
    return smmryArr;
    
  } else if (jsonRes['sm_api_error']) {
    console.log('[ERROR]', jsonRes['sm_api_error'], jsonRes['sm_api_message']);
    
    if (jsonRes['sm_api_message'] === 'TEXT IS TOO SHORT') {
      return [smmryTextTooShortMessage];
    } else if (jsonRes['sm_api_message'] === 'THE PAGE IS IN AN UNRECOGNISABLE FORMAT') {
      return [smmryTextNotReckonMessage];
    } else {
      return [smmryErrorMessage];
    }
  }
};


function asyncArrayLoop(sender, arr, i) {
  if (i < arr.length) {
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: { access_token: pageToken },
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


function isLegitURL(text) {
  let t = text.trim();
  if (!t.includes(' ') && t.includes('.') && t.includes('/')) {
    return true;
  }
};


function urlTrimmer(url) {
  return url
    .replace(/https:\/\/l\.messenger\.com\/l\.php\?u=/, '')
    .replace(/https:\/\/l\.facebook\.com\/l\.php\?u=/, '')
    .replace(/&h=.+/, '');
};


module.exports = router;
