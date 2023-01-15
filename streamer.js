
const express = require('express')
const Discoverer = require('./discoverer');
const TidalApi = require('./api')
const TidalConnect = require('./connect')

const json_status = function(res, err, result) {
  try {
    if (err) {
      res.status(err.code||500).json({ status: 'error', error: err.message||err })
    } else {
      res.json({ status: 'ok', result: result||'' })
    }
  } catch (err) {
    console.error(err)
    try {
      res.json({ status: 'error', error: err })
    } catch {}
  }
}

module.exports = class {

  constructor(settings) {
    this._settings = settings
    this._discover_devices()
  }

  routes() {

    const router = express.Router()

    router.get('/album/:id', (req, res) => {
      this.streamAlbum(req.params.id, (err, result) => {
        json_status(res, err, result)
      })
    })

    return router

  }

  async streamAlbum(albumId, cb) {

    try {

      // we need a device
      let device = this._get_device()
      if (device == null) {
        if (cb)  cb('No streaming device found')
        return
      }

      // and we need to connect
      let connect = new TidalConnect({}, device)
      try {
        await connect.connect()
      } catch (e) {
        if (cb) cb(`Unable to connect to ${device.ip}`)
        return
      }
    
      // log
      console.log(`Streaming album: ${albumId}`)
      
      // do it
      let api = new TidalApi(this._settings)

      // get tracks
      let response1 = await api.fetchTracks(albumId)
      let tracks = await response1.json()

      // some info
      let title = tracks.items[0].item.album.title
      let artist = tracks.items[0].item.artists[0].name
      let count = tracks.totalNumberOfItems
      console.log(`  Device: ${device.name}`)
      console.log(`  Title: ${title}`)
      console.log(`  Artist: ${artist}`)
      console.log(`  Tracks: ${count}`)

      // queue
      let response2 = await api.queueTracks(tracks.items)
      let queue = await response2.json()

      // now we can queue!
      await connect.loadQueue(api, queue, tracks)
      connect.shutdown()

      // done
      if (cb) cb(null, {
        title: title,
        artist: artist,
        device: device
      })

    } catch (e) {
      console.log(e)
      if (cb) {
        cb(e)
      }
    }

  }

  _discover_devices() {
    this._devices = {}
    new Discoverer((device) => {
      this._devices[device.ip] = device
    }, (name) => {
      for (let ip of Object.keys(this._devices)) {
        if (this._devices[ip].name == name) {
          delete this._devices[ip]
          break
        }
      }
    })
  }

  _get_device() {

    let ips = Object.keys(this._devices)
    if (ips.length == 1) {
      return this._devices[ips[0]]
    } else if (ips.includes(this._settings.device)) {
      return this._devices[this._settings.device]
    } else {
      return null
    }

  }
  
}
