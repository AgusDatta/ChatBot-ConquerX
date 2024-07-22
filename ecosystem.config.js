module.exports = {
  apps : [{
    name   : "BOT",
    script : "./start.js",
    cron_restart: "0 0 */5 * *", // Restart every 5 days
  }]
}
