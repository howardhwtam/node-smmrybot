'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();

const home = require('./routes/index');
const webhook = require('./routes/webhook');

app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use('/', home);
app.use('/w', webhook);

app.listen(app.get('port'), function() {
    console.log('Running on port', app.get('port'));
});
