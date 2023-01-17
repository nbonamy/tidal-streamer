
const express = require('express')
const TidalApi = require('./api')
const { json_status } = require('./utils')

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
      cb?.(null, {
        ...info,
        ...tracks
      })

    } catch (e) {
      console.error(e)
      cb?.(e)
    }

  }
  
  async getPlaylistInfo(playlistId, cb) {

    try {

      // do it
      let api = new TidalApi(this._settings)
      let tracks = await api.fetchPlaylistTracks(playlistId)
      cb?.(null, tracks)

    } catch (e) {
      console.error(e)
      cb?.(e)
    }

  }

}
