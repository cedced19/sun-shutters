const Tuya = require('tuya-switch-api');

const suncalc = require('suncalc');
const schedule = require('node-schedule');

const delay = require('./lib/delay.js');
const addTime = require('./lib/add-time.js')

const shutters = require('./shutters.json');
const config = require('./config.json');

const myTuya = new Tuya(config.email, config.password, "eu", "33", "smart_life");

// ================================================
// Open each day at 6:30 am
// ================================================
async function openTask(obj) {
    myTuya.open(obj.id, function(err) {
        if (err) {
            console.log(`An error occured when trying to open ${obj.name}.`);
        }
    });
    await delay.timer(20000);
}

schedule.scheduleJob('0 30 6 * * *', function() {
    delay.main(openTask, shutters);
});


// ================================================
// Calculate when to close
// ================================================
function getDates() {
    const dates = [];
    const sunset = suncalc.getTimes(new Date(), config.lat, config.long).sunset;
    shutters.forEach(function(shutter, i) {
        let date = new Date(sunset.valueOf())
        date = addTime.minutes(date, shutter.after_sunset);
        date = addTime.seconds(date, i * 20);
        console.log(`${shutter.name} will be closed at ${date.getHours()} hours and ${date.getMinutes()} minutes.`);
        dates.push({ date, ...shutter });
    });
    return dates;
}


// ================================================
// Schedule close job
// ================================================
schedule.scheduleJob('0 0 16 * * *', function() {
    const dates = getDates();
    dates.forEach(function(shutter) {
        schedule.scheduleJob(shutter.date, function() {
            myTuya.close(shutter.id, function(err) {
                if (err) {
                    console.log(`An error occured when trying to close ${obj.name}.`);
                }
            });
        });
    });
});

// ================================================
// Sun Shutter
// ================================================
console.log('Sun Shutter started.');