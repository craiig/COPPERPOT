//network module
// world objects register with this system for their state to be synchronized with the client
// employs delta compression to only send changes
// one network module per world
// so we need to instantiate a network object and pass it back

var events = require('events')

//init
exports = module.exports = Network;

function Network(socketio) {
	
	//create a network object
	//just import some of our functions below - better IMO than having a large list of nested functions
	this.objectList = new Array(),
	this.socketList = new Array(),
	this.nextObjectID = 0;
	this.io = socketio
	this.clients = 0

	var that = this;

	//world.on('newplayer', function(player){that.onNewPlayer(player) })
	this.io.sockets.on('connection', function(socket){ that.newConnection(socket) });
}

//inherit from event emitter thingy?
Network.prototype.__proto__ = events.EventEmitter.prototype;

Network.prototype.newConnection = function(socket){
	this.clients++;

	this.socketList.push(socket);
	this.emit("connection", socket);

	//setup low-level events, ping, disconnect
	// todo: rpc?
	var that = this;
	socket.on("ping", function(data){ //handle ping events from clients
		socket.emit("ping", data);
	})

	//setup any other notifications
	var that = this;
	socket.on('disconnect', function(socket){ that.clients--; });

	fullUpdate = this.calcFullUpdate();
	socket.emit("objectlist", fullUpdate);
};

/*Network.prototype.onNewPlayer = function(player){ //event registered with socket.io
	//new connection!
	//add ref to socket somewhere
	//

	var that = this;

	//setup an event dispatch so we can directly fire events on specific object instances
	player.on("network_objrpc", function(player, data){
										var objid = data.objid;

										if( objid >= that.objectList.length ){
											console.log("bad object id call, objid:"+objid);
											return;
										}

										var object = that.objectList[objid].obj

										if(object.objectRPC instanceof events.EventEmitter){
											object.objectRPC.emit(data.eventname, player, data.eventdata);
										} else {
											console.log("no objectRPC on objid: "+objid)
										}
									})


	fullUpdate = this.calcFullUpdate();
	socket.emit("objectlist", fullUpdate);
}*/

//register an object to be synchronized between client/server
Network.prototype.registerObject = function(name, obj){
	//add a new sync object to the list
	if(this.objectList[name] !== undefined){
		console.error("network error: attempting to register object when name is already registered: "+name);
		console.trace();
		return;
	}

	if(obj.getSyncProps !== undefined){
		o = { obj: obj, id: this.nextObjectID++, syncedProps: {} }
		obj.netid = o.id;
		this.objectList[name] = o;
	} else {
		console.error("error: attempting to register object without getSyncProps");
		console.trace();
	}
}

//called by the world
Network.prototype.update = function(){
	messages = this.calcPartialUpdate();

	if(messages.length > 0){
		//send the message down all known sockets
		for (var i = this.socketList.length - 1; i >= 0; i--) {
			socket = this.socketList[i];
			socket.emit("objectupdate", messages);
		};
	}

	return messages;
}

//transfers a given value into one suitable to be passed across the network
Network.prototype.generateNetworkValue = function(val){
	var newval = val;

	if( val !== null && typeof(val) == "object"){
		
		if(typeof(val.netid) == "number"){
			//object is already going to be serialized, so we just need to set up a pointer for it
			newval = {_netid_ptr : val.netid}; //just set the netid for the object
		} else if (val instanceof Array){
			//need to something recursive here...
			newval = new Array();
			for(var i=0; i<val.length; i++){
				newval.push(this.generateNetworkValue(val[i]));
			}
		} else if(val.getSyncProps instanceof Function){
			//object has sync props, so we can turn those into values to send down the wire
			var syncprops = val.getSyncProps();
			newval = {}

			for (var j = 0; j < syncprops.length; j++) {
				var prop = syncprops[j]
				newval[prop] = this.generateNetworkValue(val[prop]);
			}
		} else {
			console.log('warning: serializing an object with no netid - did you register it? probably gonna crash now');
			console.log(newval);
		}
	}
	//console.log("GNV returning: "+newval)
	return newval;
}

Network.prototype.calcFullUpdate = function(){
	//iterate over objects and their registered properties to find all properties to send to a new client
	var updateMsgs = [];


	//for (var i = 0; i < this.objectList.length ; i++) {
	for( i in this.objectList ){
		var syncobj = this.objectList[i];

		var syncprops = syncobj.obj.getSyncProps(); //returns name of properties to sync, assured to be here by register

		var msg = {}
		var msgUpdated = 0;

		for (var j = 0; j < syncprops.length; j++) {
			var prop = syncprops[j];
			var val = this.generateNetworkValue(syncobj.obj[prop]);
			
			//add property to outgoing buffer
			msg[prop] = val;
		}

		//msg['id'] = syncobj.id; //always include id
		//updateMsgs.push(msg); //queue object for update
		updateMsgs.push({ 'name': i, 'data': msg, 'netid' : syncobj.id }); //queue object for update
	}

	return updateMsgs;
}

Network.prototype.calcPartialUpdate = function(){
	//iterate over objects and their registered properties to find changed properties since last time
	var updateMsgs = [];

	//for (var i = 0; i < this.objectList.length; i++) {
	for( i in this.objectList ){
		var syncobj = this.objectList[i];

		var syncprops = syncobj.obj.getSyncProps(); //returns name of properties to sync, assured to be here by register

		var msg = {}
		var msgUpdated = 0;

		for (var j = 0; j < syncprops.length; j++) {
			var prop = syncprops[j];

			/*
			if(cur_propval !== null && typeof(cur_propval) == "object"){
				//if(cur_propval.network_id !== undefined){
					cur_propval = curpropval.network_id;
				//}
			}*/
			var val = this.generateNetworkValue(syncobj.obj[prop]);
			var jsonval = JSON.stringify(val);
			//if(syncobj.syncedProps[prop] === undefined || syncobj.syncedProps[prop] != val){
				//stringify added here to be able to compare arrays
			if(syncobj.syncedProps[prop] === undefined || syncobj.syncedProps[prop] != jsonval){
				//update if we haven't seen this prop before, or if it's not what we expected
				//var val = this.generateNetworkValue(syncobj.obj[prop]);

				//add property to outgoing buffer
				msg[prop] = val;
				msgUpdated = 1;

				//copy property to our synced objects
				//todo, be pickier about the objects that we stringify
				syncobj.syncedProps[prop] = jsonval;
			}
		}

		//console.log(msg.length)
		if(msgUpdated){
			//msg['id'] = syncobj.id; //always include id
			updateMsgs.push({ 'name': i, 'data': msg, 'netid' : syncobj.id }); //queue object for update
		}
	}

	return updateMsgs;
}