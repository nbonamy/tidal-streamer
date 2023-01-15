
const express = require('express')
const TidalApi = require('./api')

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
  }

  routes() {

    const router = express.Router()

    router.get('/album/:id', (req, res) => {
      this.getAlbumInfo(req.params.id, (err, result) => {
        json_status(res, err, result)
      })
    })

    router.get('/playlist/:id', (req, res) => {
      this.getPlaylistInfo(req.params.id, (err, result) => {
        json_status(res, err, result)
      })
    })

    return router

  }

  async getAlbumInfo(albumId, cb) {

    try {

      // do it
      let api = new TidalApi(this._settings)
      let info = await api.fetchAlbumInfo(albumId)
      let tracks = await api.fetchAlbumTracks(albumId)
      if (cb) {
        cb(null, {
          ...info,
          ...tracks
        })
      }

    } catch (e) {
      console.log(e)
      if (cb) {
        cb(e)
      }
    }

  }
  
  async getPlaylistInfo(playlistId, cb) {

    try {

      // do it
      let api = new TidalApi(this._settings)
      let tracks = await api.fetchPlaylistTracks(playlistId)
      if (cb) {
        cb(null, tracks)
      }

    } catch (e) {
      console.log(e)
      if (cb) {
        cb(e)
      }
    }

  }

}
