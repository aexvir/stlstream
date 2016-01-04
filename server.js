/* Streaming server               */
/* Alexandru Constantin Viscreanu */
/* FSM UPV 2015                   */

// Server requirements
var express  = require('express'),
	http     = require('http'),
	net      = require('net'),
	child    = require('child_process'),
	i18n     = require('i18n'),
	i18nRes  = require('i18n-node-angular'),
	stylus   = require('stylus'),
	nib      = require('nib'),
	monk     = require('monk'),
	shelljs  = require('shelljs/global');

// Database connection
var db = monk('mongodb://localhost/stlstream');
// Database collection access
var collection = db.get('videos');
// Espress.js instance
var stlStream = express();
// Http server over express.js instance
var httpServer = http.createServer(stlStream);
// Clients hastable which stores the viewers of each video. Live viewers initially 0
var clients = {live:0};
// I89n partial support
i18n.configure({
	locales:['en', 'es'],
	directory: __dirname + '/locale',
	defaultLocale: 'en',
	objectNotation: true,
	cookie: 'locale'
});
// Views directory
stlStream.set('views',__dirname + '/public');
// View rendering engine
stlStream.set('view engine', 'jade');
// Stylus compiling function using nib mixins
function compile(str,path){
	return stylus(str).set('filename',path).use(nib());
}
// Express.js set to use stylus
stlStream.use(stylus.middleware({
	src: __dirname + '/public/css',
	compile: compile
}));
// Express.js set to use i18n
stlStream.use(i18n.init);
stlStream.use(i18nRes.getLocale);
// Express.js static files folder
stlStream.use(express.static(__dirname + '/public'));

console.log('Server running on port 8181...');
// White noise video until the live emission starts
livevideo = {source:'files/live/graph.ogv',title:'La emisión no ha empezado'};
// Server response to live request
stlStream.get('/live',function(request,response){
	clients.live++;
	response.render('live.jade',{video:livevideo});
});
// Startlive request enables live streaming 
stlStream.get('/startlive',function(request,response){
	clients.live++;
	console.log('Transcoding and streaming live file...')
	// Unix commandline order to make vlc transcode on the fly the video file and stream it to an .ogv file
	// This is not live streaming using MPEG-DASH. The correct way would be using dashcast
	// TODO: make dashcast work
	exec("vlc -I 'dummy' "+__dirname+"/public/files/live/verge.mp4 --sout='#transcode{vcodec=theo,vb=2100,scale=0.75,acodec=aac}:http{dst=localhost:8585/verge.ogv}'",{async:true,silent:true});
	// Live video source swap
	livevideo = {source:'http://127.0.0.1:8585/verge.ogv',title:'The Verge - Making of | En vivo'};
	response.render('live.jade',{video:livevideo});
});
// Main request
stlStream.get('/',function(request,response){
	// Gets all the videos from the collection and renders the main view
	collection.find({},function(e,result){
		response.render('main.jade',{videos:result});
	});
});
// Watch request. It reads the id received on the request URL
stlStream.get('/watch',function(request,response){
	// Tries to find the video id in the collection...
	collection.find({_id:request.query.id},function(e,result){
		// ... if it exsists, all fine, the video is rendered
		if(result.length > 0){
			// If video already in clients counter, the number is increased, otherways is set to 1
			var clientId = request.query.id;
			if(!clients.hasOwnProperty(clientId))
				clients[clientId] = 1;
			else
				clients[clientId]++;
			response.render('watch.jade',{video:result[0]});
		// ... if not, better luck next time. Error view is rendered
		} else {
			response.render('error.jade');
		}
	});
});
// Http server listening on port 8181
httpServer.listen(8181);
// Socket.io used for real time client counter
var io = require('socket.io')(httpServer);
// Event triggered on each connection
io.on('connection', function (socket) {
	// Different console message depending on video accessed
	if(socket.request.headers.referer.indexOf('live') > 0){
		console.log('New client on live session'/*: '+socket.request.connection.remoteAddress.substring(7)*/);
	} else {
		console.log('New client on video '+socket.request.headers.referer.substring(31)/*+': '+socket.request.connection.remoteAddress.substring(7)*/);
	}
	// It emits to all the sockets the client counter
	io.sockets.emit('beat',{clientnumber: clients});
	// On client disconnection from the socket
	socket.on('disconnect', function () {
		// Client number is decreased and is logged into the standard output
		if(socket.request.headers.referer.indexOf('live') > 0){
			console.log('Client logged out from live session'/*: '+socket.request.connection.remoteAddress.substring(7)*/);
			clients.live--;
		} else {
			console.log('Client logged out from video '+socket.request.headers.referer.substring(31)/*+': '+socket.request.connection.remoteAddress.substring(7)*/);
			clients[socket.request.headers.referer.substring(31)]--;
		}
		// The new client hastable is emitted to all the sockets
		io.sockets.emit('beat',{clientnumber: clients});
	});
});