
const md5 = require('md5')
const express = require('express')
const Discoverer = require('./discoverer');
const TidalApi = require('./api')
const TidalConnect = require('./connect')
const { json_status } = require('./utils');

module.exports = class {

  constructor(settings) {
    this._settings = settings
    this._discoverDevices()
  }

  routes() {

    const router = express.Router()

    router.use((req, res, next) => {
      if (req.url != '/list') {
        req.device = this._getDevice(req.query.uuid)
        if (req.device == null) {
          json_status(res, 'Device not found')
          return
        }
      }
      next()
    })

    router.get('/ping', (req, res) => {
      res.json('pong')
    })

    router.get('/list', (req, res) => {
      res.json(Object.values(this._devices).map((d) => d.info()))
    })

    router.get('/status', (req, res) => {
      res.json(req.device.connect?.status())
    })

    router.post('/play/tracks', (req, res) => {
      this.streamTracks(req.device.connect, req.body, req.query.position, (err, result) => {
        json_status(res, err, result)
      })
    })

    router.get('/play/album/:id', (req, res) => {
      this.streamAlbum(req.device.connect, req.params.id, req.query.position, (err, result) => {
        json_status(res, err, result)
      })
    })

    router.get('/play/playlist/:id', (req, res) => {
      this.streamPlaylist(req.device.connect, req.params.id, req.query.position, (err, result) => {
        json_status(res, err, result)
      })
    })

    router.post('/play', async (req, res) => {
      await req.device.connect.sendCommand('play');
      json_status(res, null, 'ok')
    })

    router.post('/pause', async (req, res) => {
      await req.device.connect.sendCommand('pause');
      json_status(res, null, 'ok')
    })

    router.post('/stop', async (req, res) => {
      await req.device.connect.stop();
      json_status(res, null, 'ok')
    })

    router.post('/next', async (req, res) => {
      await req.device.connect.sendCommand('next');
      json_status(res, null, 'ok')
    })

    router.post('/prev', async (req, res) => {
      await req.device.connect.sendCommand('previous');
      json_status(res, null, 'ok')
    })

    router.post('/trackseek/:position', async (req, res) => {
      try {
        await req.device.connect.goto(parseInt(req.params.position))
        json_status(res, null, 'ok')
      } catch (e) {
        json_status(res, e)
      }
    })

    router.post('/timeseek/:progress', async (req, res) => {
      await req.device.connect.sendCommand('seek', { position: req.params.progress * 1000 });
      json_status(res, null, 'ok')
    })

    return router

  }

  async streamTracks(connect, tracks, position, cb) {

    try {

      // log
      console.log(`Streaming ${tracks.items.length} tracks`)
      
      // do it
      let api = new TidalApi(this._settings)

      // some info
      console.log(`  Device: ${connect.device().name}`)

      // stream
      this._streamTracks(api, connect, tracks.items.map((t) => {
        if (typeof t == 'string') t = JSON.parse(t)
        return {
          type: 'track',
          item: {
            id: t.id,
            duration: t.duration,
            allowStreaming: true,
            editbale: false,
            streamReady: true,
            audioModes: [
              'STEREO'
            ]
          }
        }
      }), position || 0)

      // done
      cb?.(null, {
        device: connect.device().info(),
      })

    } catch (e) {
      console.error(e)
      cb?.(e)
    }
  
  }

  async streamAlbum(connect, albumId, position, cb) {

    try {

      // log
      console.log(`Streaming album: ${albumId}`)
      
      // do it
      let api = new TidalApi(this._settings)

      // get tracks
      let tracks = await api.fetchAlbumTracks(albumId)

      // some info
      position = position || 0
      let title = tracks.items[position].item.album.title
      let artist = tracks.items[position].item.artists[0].name
      let count = tracks.totalNumberOfItems
      console.log(`  Device: ${connect.device().name}`)
      console.log(`  Title: ${title}`)
      console.log(`  Artist: ${artist}`)
      console.log(`  Tracks: ${count}`)

      // stream
      await this._streamTracks(api, connect, tracks.items, position)

      // done
      cb?.(null, {
        id: albumId,
        title: title,
        artist: artist,
        device: connect.device().info(),
      })

    } catch (e) {
      console.error(e)
      cb?.(e)
    }

  }

  async streamPlaylist(connect, playlistId, position, cb) {

    try {

      // log
      console.log(`Streaming playlist: ${playlistId}`)
      
      // do it
      let api = new TidalApi(this._settings)

      // get tracks
      let tracks = await api.fetchPlaylistTracks(playlistId)

      // some info
      let count = tracks.totalNumberOfItems
      console.log(`  Device: ${connect.device().name}`)
      console.log(`  Tracks: ${count}`)

      // stream
      await this._streamTracks(api, connect, tracks.items, position || 0)

      // done
      cb?.(null, {
        id: playlistId,
        device: connect.device().info(),
      })

    } catch (e) {
      console.error(e)
      cb?.(e)
    }

  }

  async _streamTracks(api, connect, tracks, position) {

    // queue
    let response = await api.queueTracks(tracks, position)
    let queue = await response.json()

    // check
    if (queue.error != null) {
      throw new Error(JSON.stringify(queue))
    }
    
    // now we can queue!
    await connect.loadQueue(api, queue, tracks)

    // done
    return queue

  }

  _discoverDevices() {
    this._devices = {}
    new Discoverer(async (device) => {

      // first clean up
      let current = this._devices[device.name]
      if (current == null) {
        this._devices[device.name] = {} // reserve
      } else if (current.connect == null) {
        return // reserved
      } else {
        this._disconnectFromDevice(current)
        delete this._devices[device.name]
      }

      // now connect
      try {
      
        await this._connectToDevice(device)
        device.uuid = md5(`${device.name}-${device.ip}`)
        device.info = function() { return { uuid: this.uuid, name: this.name }}
        this._devices[device.name] = device
      
      } catch (e) {
        throw new Error(`Unable to connect to ${device.name}@${device.ip}: ${e}`)
      }

    }, (name) => {
      let current = this._devices[name]
      this._disconnectFromDevice(current)
      delete this._devices[name]
    })
  
  }

  async _connectToDevice(device) {
    let connect = new TidalConnect(this._settings, device)
    await connect.connect()
    device.connect = connect
  }

  async _disconnectFromDevice(device) {
    if (device != null && device.connect != null) {
      device.connect?.shutdown()
      device.connect = null      
    }
  }

  _getDevice(uuid) {

    // we need this
    let names = Object.keys(this._devices)
    let devices = Object.values(this._devices)

    // if we have a uuid then find it
    if (uuid != null) {
      let matches = devices.find((d) => d.uuid == uuid)
      if (matches.length == 1) return matches[0]
      else return null
    }

    // if we have only one device then good
    if (devices.length == 1) {
      return devices[0]
    }

    // do we have a default
    let name = this._settings.device
    if (names.includes(name)) {
      return this._devices[name]
    }

    // too bad
    return null

  }
  
}
