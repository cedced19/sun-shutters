const path = require('path');
const fs = require('fs');
const Tuya = require('./lib/tuya-switch-api');

const delay = require('./lib/delay.js');

// Usage: node test-open.js --config <config_path>
// <config_path> must contain config.json and shutters.json
const args = process.argv.slice(2);
let configPath = '.';
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
        configPath = args[i + 1];
    }
}

function load(name) {
    const file = path.resolve(configPath, name);
    if (!fs.existsSync(file)) {
        console.error(`Missing config file: ${file}`);
        process.exit(1);
    }
    return require(file);
}

const config = load('config.json');
const shutters = load('shutters.json');

const myTuya = new Tuya(config.email, config.password, "eu", "33", "smart_life");

const maxAttempts = 10;

function openWithRetry(shutter) {
    return new Promise(function(resolve) {
        let attempt = 0;
        function go() {
            myTuya.open(shutter.id, function(err) {
                if (err) {
                    attempt++;
                    if (attempt < maxAttempts) {
                        const wait = Math.min(60, 10 + attempt * 10);
                        console.log(`Retrying to open ${shutter.name} (attempt ${attempt}/${maxAttempts}) in ${wait}s:`, err.message || err);
                        setTimeout(go, wait * 1000);
                    } else {
                        console.log(`An error occured when trying to open ${shutter.name} after ${maxAttempts} attempts.`, err);
                        resolve();
                    }
                } else {
                    console.log(`${shutter.name} opened.`);
                    resolve();
                }
            });
        }
        go();
    });
}

async function openShutter(shutter) {
    await openWithRetry(shutter);
    await delay.timer(20000);
}

delay.main(openShutter, shutters).then(function() {
    console.log('All shutters opened.');
    process.exit(0);
});
