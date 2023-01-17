
// some constants
const AUTH_BASE_URL = 'https://auth.tidal.com/v1/oauth2'
const API_BASE_URL = 'https://api.tidal.com/v1'
const QUEUE_BASE_URL = 'https://connectqueue.tidal.com/v1'
const COUNTRY_CODE = 'US'
const LIMIT = 100

// we need fetch
if (typeof fetch == 'undefined') {
  fetch = require('node-fetch')
}

module.exports = class {

  constructor(settings) {
    this._settings = settings
    this._countryCode = settings.countryCode || COUNTRY_CODE
    this._access_token = settings.auth.access_token
    this._refresh_token = settings.auth.refresh_token
  }

  getApiBaseUrl() {
    return API_BASE_URL
  }

  getQueueBaseUrl() {
    return QUEUE_BASE_URL
  }

  async fetchAlbumInfo(albumId) {
    return this._callApi(`/albums/${albumId}`)
  }

  async fetchAlbumTracks(albumId) {
    return this._callApi(`/albums/${albumId}/items`, { limit: LIMIT })
  }

  async fetchPlaylistTracks(playlistId) {
    return this._callApi(`/playlists/${playlistId}/items`, { limit: LIMIT })
  }

  async fetchArtistAlbums(artistId) {
    return this._callApi(`/artists/${artistId}/albums`)
  }
  
  async search(type, query) {
    return this._callApi(`/search/${type}`, { query: query, limit: LIMIT })
  }
  
  queueTracks(tracks, position) {

    let payload = {
      properties: {
        position: position
      },
      repeat_mode: 'off',
      shuffled: false,
      items: tracks.map((t) => {
        return {
          type: t.type,
          media_id: t.item.id,
          properties: {
            active: false,
            original_order: 0,
            sourceId: t.item.id,
            sourceType: 'album'
          },
        }
      })
    }

    return fetch(`${QUEUE_BASE_URL}/queues?countryCode=${this._countryCode}`, {
      method: 'POST',
      headers: new Headers({
        'Authorization': `Bearer ${this._access_token}`,
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(payload)
    })

  }

  async _callApi(path, params) {
    let url = this._getUrl(path, params)
    console.log(url)
    let response = await fetch(url, this._getFetchOptions())
    return response.json()
  }

  getAuthInfo() {
    return {
      'oauthServerInfo': {
        'serverUrl': `${AUTH_BASE_URL}/token`,
        'authInfo': {
          'headerAuth': `Bearer ${this._access_token}`,
          'oauthParameters': {
            'accessToken': this._access_token,
            'refreshToken': this._refresh_token,
          }
        },
        'httpHeaderFields': [],
        'formParameters': {
          'scope': 'r_usr',
          'grant_type': 'switch_client'
        }
      }
    }
  }

  _getUrl(path, params) {
    let url = `${API_BASE_URL}${path}?countryCode=${this._countryCode}`
    for (let key in params) {
      url += `&${key}=${encodeURIComponent(params[key])}`
    }
    return url
  }

  _getFetchOptions() {
    return {
      headers: new Headers({
        'Authorization': `Bearer ${this._access_token}`
      })
    }
  }

}