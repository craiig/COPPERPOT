//world.js for client

function World(socket){
	this.socket = socket;
	this.network = new Network(socket);

	var that = this
	this.network.events.on("init", function(objects){
		//that.world = that.WorldData[0]; //assign world for convenience
		console.log(objects);
	})

	this.network.events.on("update", function(objects){ //handle the update to the shiplist
		console.log(objects);
	})
}