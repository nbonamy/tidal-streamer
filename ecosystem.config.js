module.exports = {
  apps : [{
    name   : "tidal-streamer",
    script : "./index.js",
    watch: true,
		watch_delay: 1000,
		ignore_watch : ["config.yml"],
    log_date_format: "“YYYY-MM-DD HH:mm:ss"
  }]
}
