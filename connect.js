const WebSocket = require('ws')
const { getAlbumCovers } = require('./utils')

module.exports = class {

  constructor(settings, device) {
    this._settings = settings
    this._device = device
    this._reset()
  }

  _reset() {
    this._reqid = 0
    this._sessionId = 0
    this._resetStatus()
  }

  _resetStatus() {
    this._status = {
      state: 'STOPPED',
      queue: null,
      tracks: [],
      position: -1,
      progress: 0,
      volume: { level: null, mute: true },
    }
  }

  device() {
    return this._device
  }

  status() {
    return this._status
  }

  shutdown() {
    try {
      clearInterval(this._heartbeat)
      this._ws.close()
      this._ws.terminate()
      this._reset()
      console.log(`Websocket disconnected from ${this._device.name}`)
    } catch (e) {
      console.error(`Error while closing connection to ${this._device.ip}: ${e}`)
    }
  }

  connect() {

    return new Promise((resolve, reject) => {

      // open our websocket
      this._ws = new WebSocket(`wss://${this._device.ip}:${this._device.port}`, {
        rejectUnauthorized: false
      })
      this._ws.on('open', () => {
        this._ws.send(JSON.stringify({
          command: 'startSession',
          appId: 'tidal',
          appName: 'tidal',
          sessionCredential: '190108211'
        }))
        console.log(`Connected to ${this._device.name}@${this._device.ip}`)
        resolve()
      })
      this._ws.on('error', (e) => {
        reject(e)
        this.connect()
      })
      this._ws.on('message', (message) => {
        this._processMessage(JSON.parse(message.toString()))
      })

      // and ping
      this._heartbeat = setInterval(() => {
        try {
          this._ws.ping()
        } catch {}
      }, 1000)
    
    })

  }

  async loadQueue(api, queue, tracks) {

    // clear reset timer
    clearTimeout(this._resetTimer)
    this._resetTimer = null

    // get position
    let position = parseInt(queue.properties?.position || 0)

    // big payload!
    let params = {
      autoplay: true,
      position: position,
    }
    params.queueServerInfo = {
      serverUrl: `${api.getQueueBaseUrl()}/queues`,
      authInfo: api.getAuthInfo(),
      httpHeaderFields: [],
      queryParameters: {}      
    }
    params.contentServerInfo = {
      serverUrl: `${api.getApiBaseUrl()}`,
      authInfo: api.getAuthInfo(),
      httpHeaderFields: [],
      queryParameters: {
        audiomode: tracks[0].item.audioModes[0],
        audioquality: tracks[0].item.audioQuality,
      }     
    }
    params.queueInfo = {
      queueId: queue.id,
      repeatMode: queue.repeat_mode || false,
      shuffled: queue.shuffled || false,
      maxBeforeSize: 10,
      maxAfterSize: 10
    }
    params.currentMediaInfo = {
      itemId: queue.items[position].id,
      mediaId: queue.items[position].media_id,
      mediaType: 0,
      metadata: {
        title: tracks[position].item.title,
        artists: tracks[position].item.artists?.map((a) => a.name),
        albumTitle: tracks[position].item.album?.title,
        duration: tracks[position].item.duration * 1000,
        images: getAlbumCovers(tracks[position].item.album?.cover)
      }
    }

    // save
    this._status.progress = 0
    this._status.position = position
    this._status.tracks = tracks
    this._status.queue = queue
    
    // do it
    await this.sendCommand('loadCloudQueue', params)
    await this.sendCommand('refreshQueue', { queueId: queue.id })

  }

  goto(position) {

    // check
    if (position > this._status.tracks.length - 1) {
      throw new Error('index out of bounds')
    }

    // build payload
    let item = this._status.tracks[position].item
    let payload = {
      mediaInfo: {
        itemId: this._status.queue.items[position].id,
        mediaId: `${item.id}`,
        mediaType: 0,
        metadata: {
          title: item.title,
          albumTitle: item.album.title,
          artists: item.artists.map((a) => a.name),
          duration: item.duration * 1000,
          images: getAlbumCovers(item.album.cover),
        },
      },
      policy: {
        canNext: true,
        canPrevious: true,
      }
    }

    // save
    this._status.progress = 0
    this._status.position = position

    // do it
    this.sendCommand('selectQueueItem', payload)
  }

  stop() {
    this.sendCommand('stop')
    this._resetStatus();
  }

  sendCommand(command, params) {
    this._sendMessage(JSON.stringify({
      'command': command,
      'requestId': this._reqid++,
      ...params
    }))
  }

  _sendMessage(message) {
    //console.log(JSON.parse(message))
    this._ws.send(message)
  }

  _processMessage(message) {

    //
    if (message.command == 'notifySessionStarted') {
      //console.log(message)
      if (this._sessionId == 0) {
        this._sessionId = message.sessionId
      }
      return
    }

    //
    if (message.command == 'notifySessionEnded') {
      this.shutdown()
      this.connect()
      return
    }

    //
    if (message.command == 'notifyRequestResult') {
      return
    }

    //
    if (message.command == 'notifyDeviceStatusChanged') {
      this._status.volume = message.volume
      return
    }

    //
    if (message.command == 'notifyQueueChanged') {
      let queueId = message.queueInfo.queueId
      if (this._status.queue != null && this._status.queue.id != queueId) {
        this._resetStatus()
      }
      return
    }

    //
    if (message.command == 'notifyQueueItemsChanged') {
      //console.log(message)
      return
    }

    //
    if (message.command == 'notifyMediaChanged') {
      this._status.progress = 0
      if (this._status.tracks != null && this._status.tracks.length) {
        this._status.position = this._status.tracks.findIndex((t) => t.item.id == message.mediaInfo.mediaId)
        console.log(`Track updated: ${this._status.position}`)
      }
      return
    }

    //
    if (message.command == 'notifyPlayerStatusChanged') {
      this._status.state = message.playerState
      this._status.progress = message.progress
      return
    }

    //
    if (message.command.endsWith('Error')) {
      console.error(`[ERR] ${this._device.ip}: ${JSON.stringify(message)}`)
      return
    }

    // not processed
    console.log(`Unknow message received from device: ${message.command}`)
    
  }

}
