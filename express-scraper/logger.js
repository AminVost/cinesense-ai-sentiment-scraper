const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'scraper_trace.log');

function writeLog(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] - ${message}\n`;
    
    if (level === 'error') {
        console.error(logMessage.trim());
    } else {
        console.log(logMessage.trim());
    }

    fs.appendFileSync(logFile, logMessage, 'utf8');
}

module.exports = {
    info: (msg) => writeLog('info', msg),
    error: (msg) => writeLog('error', msg),
    warn: (msg) => writeLog('warn', msg)
};