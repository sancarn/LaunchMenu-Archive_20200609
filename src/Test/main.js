//this is merely some test code
import {app as app, BrowserWindow as BrowserWindow} from "electron";
import url from "url";
import path from "path";
import IPC from "../core/communication/IPC";
import Registry from "../core/registry/registry";

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
	IPC._registerWindow(mainWindow);
});

// Module registry
Registry.loadModule("testModule");

// IPC testing
IPC.on("ping", (event)=>{
	console.log(event);
	IPC.send("pong", {data:2}, 1);
	// IPC.send("module", TestModule, 1);
});
IPC.on("moduleInstanceTransfer", (event)=>{
    console.log(event);
});
