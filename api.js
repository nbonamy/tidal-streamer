
// some constants
const AUTH_BASE_URL = 'https://auth.tidal.com/v1/oauth2'
const API_BASE_URL = 'https://api.tidal.com/v1'
const QUEUE_BASE_URL = 'https://connectqueue.tidal.com/v1'
const COUNTRY_CODE = 'US'

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
    let response = await fetch(`${API_BASE_URL}/albums/${albumId}?countryCode=${this._countryCode}`, {
      headers: new Headers({
        'Authorization': `Bearer ${this._access_token}`
      })
    })
    return response.json()
  }

  async fetchAlbumTracks(albumId) {
    let response = await fetch(`${API_BASE_URL}/albums/${albumId}/items?limit=100&countryCode=${this._countryCode}`, {
      headers: new Headers({
        'Authorization': `Bearer ${this._access_token}`
      })
    })
    return response.json()
  }

  async fetchPlaylistTracks(playlistId) {
    let response = await fetch(`${API_BASE_URL}/playlists/${playlistId}/items?limit=100&countryCode=${this._countryCode}`, {
      headers: new Headers({
        'Authorization': `Bearer ${this._access_token}`
      })
    })
    return response.json()
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

}