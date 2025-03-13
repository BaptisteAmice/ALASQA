// if this file is included, it will disable all alerts and instead put them in a list in the local storage
window.alert = function (text) {
    let alerts = JSON.parse(localStorage.getItem("alertMessages") || "[]");
    alerts.push(text);
    localStorage.setItem("alertMessages", JSON.stringify(alerts));
    console.log('Captured alert:', text);
};

/**
 * (Because the file in which this function is included override alerts and put their messages in it)
 * Get alerts message from the field "alertMessages" of the local storage.
 * @returns
 */
function getAlerts() {
    return JSON.parse(localStorage.getItem("alertMessages") || "[]");
}

/**
 * (Because the file in which this function is included override alerts and put their messages in it)
 * Remove all alerts from the field "alertMessages" of the local storage.
 */
function clearAlerts() {
    localStorage.setItem("alertMessages", "[]");
}