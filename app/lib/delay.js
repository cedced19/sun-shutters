function timer(ms) { return new Promise(res => setTimeout(res, ms)); }

async function main(task, list) {
    for (let i in list) {
        await task(list[i]);
    }
}

module.exports = { main, timer }