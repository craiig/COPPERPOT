
//basic GameServer model
//increments the GameServerTime whenever it is updated

//todo: GameServer model is basically an event-emitter as described in the node.js documentation
//http://nodejs.org/api/events.html#events_class_events_eventemitter
// if GameServer model was made to be an event emitter, game objects could attach actions to the GameServer update event easily

var network = require('./network.js');
var Player = require('./player.js');
var fs = require('fs');
var events = require('events');

exports = module.exports = GameServer;

function GameServer(network) {
	this.GameServerTime = 0;
	this.lastUpdate = (new Date()).getTime(); //last update time
	this.playerList = new Array();	

	//register some callbacks - this is annoying to do this way, but our other options are way worse: http://www.dustindiaz.com/scoping-anonymous-functions/
	var that = this;
	setInterval( function(){that.update()}, 1000); //1 fps

	this.network = network; //network object
	this.network.registerObject("GameServer", this);
	this.network.on('connection', function(socket){ that.newConnection(socket) });
};


GameServer.prototype.getSyncProps = function(){
	//list of properties that the network object syncs
	return ['GameServerTime', 'playerList'];
};

//inherit from event emitter so we can dispatch events
GameServer.prototype.__proto__ = events.EventEmitter.prototype; 

GameServer.prototype.newConnection = function(socket){
	//create new player object and fire event
	player = new Player(this, socket);
	this.playerList.push(player);
};

GameServer.prototype.update = function(){
	this.GameServerTime++;

	var newTime = (new Date()).getTime()
	var timeDiff = newTime - this.lastUpdate;
	this.lastUpdate = newTime;

	var sTimeDiff = timeDiff / 1000; //convert to seconds
	
	this.emit("update", sTimeDiff); //fire an event
	
	//update our network channel
	this.network.update();
};
