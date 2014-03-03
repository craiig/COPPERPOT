
var fs = require('fs')
var express = require('express')
var http = require('http');
var world = require('./gameServer.js');
var network = require('./network.js')

var app = express()

//setup the app & socketio in this weird way thanks to express and socket.io
var io = require('socket.io').listen(app.listen(7009));
//io.set('log level', 1);

app.use('/static', express.static(__dirname + '/static'));
app.use('/', express.static(__dirname + '/client'));

//instantiate the world object - which includes a network channel
var world = new world(new network(io));