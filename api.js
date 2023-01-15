
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

  async fetchTracks(albumId) {
    return fetch(`${API_BASE_URL}/albums/${albumId}/items?limit=100&countryCode=${this._countryCode}`, {
      headers: new Headers({
        'Authorization': `Bearer ${this._access_token}`
      })
    })
  }

  async queueTracks(tracks) {

    let payload = {
      properties: {
        position: 0
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

  getAlbumCovers(albumId) {
    const baseUrl = `https://resources.tidal.com/images/${albumId.replace(/-/g, '/')}`;
    return {
      high: {
        url: `${baseUrl}/1280x1280.jpg`,
        width: 1280, height: 1280,
      },
      medium: {
        url: `${baseUrl}/640x640.jpg`,
        width: 640, height: 640,
      },
      low: {
        url: `${baseUrl}/320x320.jpg`,
        width: 320, height: 320,
      }
    }
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