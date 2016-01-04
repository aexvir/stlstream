$(document).on('ready',function(){
	var url = "http://dashas.castlabs.com/videos/files/bbb/Manifest.mpd";
	//var url = "http://localhost:8181/files/outputfile_dash.mpd";
	var context = new Dash.di.DashContext();
	var player = new MediaPlayer(context);
	player.startup();
	player.attachView(document.querySelector("#player"));
	player.attachSource(url);
});