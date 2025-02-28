// if this file is included, it will disable all alerts and instead put them in a list in the local storage
window.alert = function (text) {
    let alerts = JSON.parse(localStorage.getItem("alertMessages") || "[]");
    alerts.push(text);
    localStorage.setItem("alertMessages", JSON.stringify(alerts));
    console.log('Captured alert:', text);
};