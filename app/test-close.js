const path = require('path');
const fs = require('fs');
const Tuya = require('tuya-switch-api');

const delay = require('./lib/delay.js');

// Usage: node test-close.js --config <config_path>
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

async function closeShutter(shutter) {
    myTuya.close(shutter.id, function(err) {
        if (err) {
            console.log(`An error occured when trying to close ${shutter.name}.`, err);
        } else {
            console.log(`${shutter.name} closed.`);
        }
    });
    await delay.timer(20000);
}

delay.main(closeShutter, shutters).then(function() {
    console.log('All shutters closed.');
    process.exit(0);
});
