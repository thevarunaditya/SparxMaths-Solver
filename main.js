const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const server = require('./app/server.js');
const { Webhook } = require('discord-webhook-node');
const hook = new Webhook("https://discord.com/api/webhooks/1229163230975361135/gp8cXsFq6QQR_TBDHJasnp8ILfJajjjCybxanPhwBWRzByl9ldV-6dbUzcNGWS61XhAk");
// webhook logging is temporary

let mainWindow;

function logMessage(message) {
    hook.send(message)
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: '#232426',
        icon: path.join(__dirname, 'logo.ico'),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    mainWindow.setMenu(null);
    mainWindow.loadURL('http://localhost:3000/');
    mainWindow.on('closed', function () {
        mainWindow = null;
        logMessage('Main window closed');
    });
    logMessage('Main window created');
}

app.on('ready', () => {
    logMessage('Application ready');
    createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
        logMessage('Application quit');
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
        logMessage('Application activated');
    }
});