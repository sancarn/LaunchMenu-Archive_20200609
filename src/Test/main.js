//this is merely some test code
import {app as app, BrowserWindow as BrowserWindow} from "electron";
import url from "url";
import path from "path";
import IPC from "../core/communication/IPC";
import Registry from "../core/registry/registry";
import Channel from "../core/communication/channel";
import RequestPath from "../core/registry/requestPath";

// var {app, BrowserWindow} = require('electron');
var mainWindow;
app.on('window-all-closed', function() {
  	if (process.platform != 'darwin') {
    	app.quit();
  	}
});
app.on('ready', function() {
	mainWindow = new BrowserWindow({width: 1360, height: 800});
	// mainWindow.loadURL(url.format({
	//   pathname: "www.google.com",
	//   protocol: 'https:',
	//   slashes: true
	// }));
	mainWindow.loadURL(url.format({
		pathname: path.join(process.cwd(), "dist", "Test", "index.html"),
		protocol: 'file:',
		slashes: true
	}))
	mainWindow.openDevTools();
	mainWindow.on('closed', function() {
		mainWindow = null;
	});

	// Register window
	IPC._registerWindow(mainWindow);
});


IPC.once("loaded", (event)=>{
	// Module registry
	Registry.loadModule("testModule");

	IPC.on("pong", event=>{
		return 3;
	})

	// IPC testing
	IPC.on("ping", (event)=>{
		console.log("ping", event);
		IPC.send("pong", {data:2}, 1).then(data=>{
	        console.log("response", data);
	    });
		// IPC.send("module", TestModule, 1);
	});
	IPC.on("moduleInstanceTransfer", (event)=>{
	    console.log(event);
	});

	// Channel testing
	var channel = Channel.createReceiver("TestName", {
		doSomething: event=>{
			console.log("smth", event);
		},
		doSomethingElse: event=>{
			console.log("smthElse", event);
		}
	});
	channel.createSubChannel("getColor", {
		onColor: event=>{
			console.log("color", event);
		},
		doSomethingElse: function(event){
			console.log("smthElse Overwritten", event, event.senderID);
			Channel.createSender(event.senderID, "", this.getID()).then(channel=>{
				console.log("establish connection");
				channel.smth("stuff");
			});
		}
	});

    //RequestPath testing
	const rootRequestPath = new RequestPath("root");
	rootRequestPath.augmentPath("test").then(requestPath=>{
		console.log(requestPath.toString(true));
		requestPath._attachModuleInstance("shit");
	});
});
