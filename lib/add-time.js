function addMinutes(date, minutes) {
    date.setTime(date.getTime() + minutes * 60000)
    return date;
}

function addSeconds(date, seconds) {
    date.setTime(date.getTime() + seconds * 1000)
    return date
}
module.exports = { seconds: addSeconds, minutes: addMinutes }