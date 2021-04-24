const delay = require('./lib/delay.js')
async function task(obj) {
    await delay.timer(1000);
    console.log(`Task ${obj} done!`);
}
delay.main(task, [1, 2, 3, "4a"]);