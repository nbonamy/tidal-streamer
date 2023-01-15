
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
    this._discoverDevices()
  }

  routes() {

    const router = express.Router()

    router.get('/album/:id', (req, res) => {
      this.streamAlbum(req.params.id, (err, result) => {
        json_status(res, err, result)
      })
    })

    router.get('/playlist/:id', (req, res) => {
      this.streamPlaylist(req.params.id, (err, result) => {
        json_status(res, err, result)
      })
    })

    return router

  }

  async streamAlbum(albumId, cb) {

    try {

      // we need a device
      let connect = await this._connectToDevice()
    
      // log
      console.log(`Streaming album: ${albumId}`)
      
      // do it
      let api = new TidalApi(this._settings)

      // get tracks
      let tracks = await api.fetchAlbumTracks(albumId)

      // some info
      let title = tracks.items[0].item.album.title
      let artist = tracks.items[0].item.artists[0].name
      let count = tracks.totalNumberOfItems
      console.log(`  Device: ${connect.getDevice().name}`)
      console.log(`  Title: ${title}`)
      console.log(`  Artist: ${artist}`)
      console.log(`  Tracks: ${count}`)

      // stream
      this._streamTracks(api, connect, tracks)

      // done
      if (cb) cb(null, {
        id: albumId,
        title: title,
        artist: artist,
        device: connect.getDevice()
      })

    } catch (e) {
      console.log(e)
      if (cb) {
        cb(e)
      }
    }

  }

  async streamPlaylist(playlistId, cb) {

    try {

      // we need a device
      let connect = await this._connectToDevice()
    
      // log
      console.log(`Streaming playlist: ${playlistId}`)
      
      // do it
      let api = new TidalApi(this._settings)

      // get tracks
      let tracks = await api.fetchPlaylistTracks(playlistId)

      // some info
      let count = tracks.totalNumberOfItems
      console.log(`  Device: ${connect.getDevice().name}`)
      console.log(`  Tracks: ${count}`)

      // stream
      this._streamTracks(api, connect, tracks)

      // done
      if (cb) cb(null, {
        id: playlistId,
        device: connect.getDevice()
      })

    } catch (e) {
      console.log(e)
      if (cb) {
        cb(e)
      }
    }

  }

  async _connectToDevice() {
    
    // we need a device
    let device = this._getDevice()
    if (device == null) {
      throw new Error('No streaming device found')
    }

    // and we need to connect
    let connect = new TidalConnect(this._settings, device)
    try {
      await connect.connect()
    } catch (e) {
      throw new Error(`Unable to connect to ${device.ip}`)
    }

    // done
    return connect

  }

  async _streamTracks(api, connect, tracks) {

    // queue
    let response = await api.queueTracks(tracks.items)
    let queue = await response.json()

    // now we can queue!
    await connect.loadQueue(api, queue, tracks)
    connect.shutdown()

    // done
    return queue

  }

  _discoverDevices() {
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

  _getDevice() {

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
