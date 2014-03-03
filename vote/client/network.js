//client side network module
function Network(socket){
	this.socket = socket;
	this.networkObjects = {}
	this.events = new EventEmitter();

	var that = this;
	this.socket.on('objectlist', function(data){ that.receiveObjectList(data); } );
	this.socket.on('objectupdate', function(data){ that.receiveObjectUpdate(data); } );
}

Network.prototype.resolveNetIDs = function(obj){
	//for each property of this object, check it for netid, if so, reference the net id in the world
	//results in reference based structure
	var networkObjects = this.networkObjects;

	for(var prop in obj){
		var pobj = obj[prop];
		try {
		if(pobj._netid_ptr !== undefined){
			//console.log(obj[prop])
			obj[prop] = networkObjects[pobj._netid_ptr];
			//console.log(obj[prop])
		} 
	} catch (errx){}
		// else if(typeof(pobj) == "object" && pobj !== null){
		// 	//console.log("rni: "+prop)
		// 	//console.log(pobj)
		// 	this.resolveNetIDs(pobj);
		// } 
	}
}

Network.prototype.receiveObjectList = function(data){
    //console.log("object list:");
    //console.log(data);
    var networkObjects = this.networkObjects;

    for(d in data){
      networkObjects[data[d].name] = data[d].data;
    }
    
    //resolve any netid pointers
    for(d in networkObjects){
      this.resolveNetIDs(networkObjects[d]);
    }

    this.events.emit("init", networkObjects);
}

Network.prototype.receiveObjectUpdate = function(data){
	//console.log("object update");
	//console.log(data);
	var networkObjects = this.networkObjects;

	//send ping back immediately since we'll block processing and we can use it to measure how long this takes
	//d = new Date();
	//lastPing = d.getTime()
	//this.world.socket.emit('ping', { time: lastPing });
	//this.world.socket.emit('ping', { time: (new Date()).getTime() });

	//update loop
	for(d in data){
		//WorldData[data[d].netid] = data[d].data
		var netid = data[d].name;

		if(networkObjects[netid] === undefined){ //new object received
			networkObjects[netid] = data[d].data;
		} else {
			//update to existing object
			var obj = data[d].data;
			for(prop in obj){
				networkObjects[netid][prop] = obj[prop];
				//console.log("updating prop: "+prop+" = "+obj[prop]);
			}
		}
	}

	//fix up any pointers
	for(d in networkObjects){
		this.resolveNetIDs(networkObjects[d]);	
	}

	this.events.emit("update", networkObjects);
}