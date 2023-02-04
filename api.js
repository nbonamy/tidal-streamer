
// some constants
const AUTH_BASE_URL = 'https://auth.tidal.com/v1/oauth2'
const API_BASE_URL = 'https://api.tidal.com/v1'
const QUEUE_BASE_URL = 'https://connectqueue.tidal.com/v1'
const COUNTRY_CODE = 'US'
const LIMIT = 100
const LIMIT_QUEUE_CONTENT = 50

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

  async fetchTrackInfo(trackId) {
    return this._callApi(`/tracks/${trackId}`)
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
    return this._callApi(`/artists/${artistId}/albums`, { limit: LIMIT })
  }
  
  async search(type, query) {
    return this._callApi(`/search/${type}`, { query: query, limit: LIMIT })
  }

  async fetchQueue(queueId) {

    // queue info and items
    let info = await this._callQueue(`/queues/${queueId}`)
    let items = await this._callQueue(`/queues/${queueId}/items`, { offset: 0, limit: LIMIT })

    // return
    return {
      id: queueId,
      ...await items.json(),
      etag: info.headers.get('etag')
    }
  }

  async fetchQueueContent(queue) {

    // /content has a limit of LIMIT_QUEUE_CONTENT
    try {
      if (queue.total <= LIMIT_QUEUE_CONTENT) {
        let response = await this._callQueue(`/content/${queue.id}`, { offset: 0, limit: LIMIT_QUEUE_CONTENT })
        let content = await response.json()
        return content.items
      }
    } catch {

    }

    // we need to fetch one by one
    let tracks = []
    for (let item of queue.items) {
      let item_id = item.media_id
      let track = await this.fetchTrackInfo(item_id)
      tracks.push({
        item: track,
        type: 'track'
      })
    }

    // done
    return tracks
  }

  async deleteFromQueue(queue, trackId) {
    let response = await this._callQueue(`/queues/${queue.id}/items/${trackId}`, null, {
      method: 'DELETE',
      ...this._getFetchOptions()
    })
    queue.etag = response.headers.get('etag')
    return response;
  }

  async reorderQueue(queue, moveId, afterId) {
    let response = await this._callQueue(`/queues/${queue.id}/items`, null, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this._access_token}`,
        'Content-Type': 'application/json',
        'If-Match': queue.etag,
      },
      body: JSON.stringify({
        ids: [ moveId ],
        after: afterId
      })
    })
    queue.etag = response.headers.get('etag')
    return response;
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

    return this._callQueue(`/queues`, null, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this._access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

  }

  async _callApi(path, params) {
    let url = this._getUrl(API_BASE_URL, path, params)
    console.log(`GET ${url}`)
    let response = await fetch(url, this._getFetchOptions())
    return response.json()
  }

  async _callQueue(path, params, options) {
    let url = this._getUrl(QUEUE_BASE_URL, path, params)
    console.log(`${options?.method || 'GET'} ${url}`)
    return fetch(url, options || this._getFetchOptions())
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

  _getUrl(baseUrl, path, params) {
    let url = `${baseUrl}${path}?countryCode=${this._countryCode}`
    for (let key in params) {
      url += `&${key}=${encodeURIComponent(params[key])}`
    }
    return url
  }

  _getFetchOptions() {
    return {
      headers: {
        'Authorization': `Bearer ${this._access_token}`
      }
    }
  }

}