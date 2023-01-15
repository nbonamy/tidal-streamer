const WebSocket = require('ws')

module.exports = class {

  constructor(settings, device) {
    this._settings = settings
    this._device = device
    this._reqid = 0
  }

  shutdown() {
    try {
      //console.log(`Websocket disconnected from ${this._device.name}`)
      clearInterval(this._heartbeat)
      this._ws.close()
    } catch {}
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
        //console.log(`Websocket connected to ${this._device.name}`)
        resolve()
      })
      this._ws.on('error', () => {
        reject()
      })
      this._ws.on('message', (message) => {
        this._process_mg(JSON.parse(message.toString()))
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

    // big payload!
    let params = {
      autoplay: true,
      position: parseInt(queue.properties?.position || 0),
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
        audiomode: tracks.items[0].item.audioModes[0],
        audioquality: tracks.items[0].item.audioQuality,
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
      itemId: queue.items[0].id,
      mediaId: queue.items[0].media_id,
      mediaType: 0,
      metadata: {
        title: tracks.items[0].item.title,
        artists: tracks.items[0].item.artists.map((a) => a.name),
        albumTitle: tracks.items[0].item.album.title,
        duration: tracks.items[0].item.duration * 1000,
        images: api.getAlbumCovers(tracks.items[0].item.album.cover)
      }
    }

    // do it
    await this.send_command('loadCloudQueue', params)
    this.send_command('refreshQueue', { queueId: queue.id })

  }

  send_command(command, params) {
    this._send_msg(JSON.stringify({
      'command': command,
      'requestId': this._reqid++,
      ...params
    }))
  }

  _send_msg(message) {
    //console.log(message)
    this._ws.send(message)
  }

  _process_mg(message) {
    //console.log(message)
    if (message.command == 'notifySessionEnded') {
      this.shutdown()
      this._connect()
    }
  }

}
