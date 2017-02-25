// Default settings
const settings = {
  /** Whether this instance should log debug messages. */
  debug: false,
  /** Whether or not the websocket should attempt to connect immediately upon instantiation. */
  automaticOpen: false,
  /** The number of milliseconds to delay before attempting to reconnect. */
  reconnectInterval: 1000,
  /** The maximum number of milliseconds to delay a reconnection attempt. */
  maxReconnectInterval: 30000,
  /** The rate of increase of the reconnect delay. Allows reconnect attempts to back off when problems persist. */
  reconnectDecay: 1.5,
  /** The maximum time in milliseconds to wait for a connection to succeed before closing and retrying. */
  timeoutInterval: 2000,
  /** The maximum number of reconnection attempts to make. Unlimited if null. */
  maxReconnectAttempts: null,
  /** The binary type, possible values 'blob' or 'arraybuffer', default 'blob'. */
  binaryType: 'blob',
};

// private stuff
let forcedClose = false;
let timedOut = false;
let ws = null;

// util functions
const warnMissingOnMethod = (event, data, debug) => debug ? console.debug(`ReconnectingWebSocket -- on${event} not implemented`, data) : null;

class ReconnectingWebSocket {
  constructor(url, options = {}) {
    if (!window || !('WebSocket' in window)) {
      throw new Error('ReconnectingWebSocket currently only supports browsers who have native WebSocket support.');
    }
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.reconnectAttempts = 0;
    this.options = Object.assign({}, settings, options);

    this.CONNECTING = WebSocket.CONNECTING;
    this.OPEN = WebSocket.OPEN;
    this.CLOSING = WebSocket.CLOSING;
    this.CLOSED = WebSocket.CLOSED;


    // do the automatic open?
    if (this.options.automaticOpen) {
      this.open();
    }
  }

  open(reconnectAttempt) {
    ws = new WebSocket(this.url);
    ws.binaryType = this.options.binaryType;
    timedOut = false;

    if (reconnectAttempt && this.maxReconnectAttempts && this.reconnectAttempts > this.maxReconnectAttempts) {
      return this.on('maxretry');
    }
    this.on('connecting');

    const connectionTimeout = setTimeout(() => {
      this.on('connect-timeout');
      timedOut = true;
      ws.close();
    }, this.options.timeoutInterval);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      this.protocol = ws.protocol;
      this.readyState = WebSocket.OPEN;
      this.reconnectAttempts = 0;
      this.on('open', { url: this.url, reconnectAttempt });
    };

    ws.onclose = event => {
      clearTimeout(connectionTimeout);
      ws = null;
      if (forcedClose) {
        this.readyState = WebSocket.CLOSED;
        this.on('close');
      } else {
        this.readyState = WebSocket.CONNECTING;
        const randTimeout = this.options.reconnectInterval * Math.pow(this.options.reconnectDecay, this.reconnectAttempts);
        const retryTimeout = randTimeout > this.options.maxReconnectInterval ? this.options.maxReconnectInterval : randTimeout;
        const { code, reason, wasClean } = event;
        this.on('connecting', { code, reason, wasClean, retryTimeout, reconnectAttempts: this.reconnectAttempts });

        if (!reconnectAttempt && !timedOut) {
          this.on('close', { url: this.url });
        }

        setTimeout(() => {
          this.reconnectAttempts++;
          this.open(true);
        }, retryTimeout);
      }
    };

    ws.onmessage = event => {
      const { data } = event;
      this.on('message', { data });
    };

    ws.onerror = event => {
      this.on('error', { event });
    };
    return null;
  }

  send(data) {
    if (ws) {
      this.on('send', { url: this.url, data });
      return ws.send(data);
    }
    throw new Error('INVALID_STATE_ERR : Pausing to reconnect websocket');
  }

  close(code = 1000, reason = '') {
    forcedClose = true;
    if (ws) {
      this.readyState = WebSocket.CLOSING;
      this.on('closing');
      ws.close(code, reason);
    }
  }

  refresh() {
    if (ws) {
      this.readyState = WebSocket.CLOSING;
      this.on('closing');
      ws.close();
    }
  }


  // "on" method
  on(event, data = {}) {
    const sendData = Object.assign({}, data, { event });
    const debug = this.options.debug;
    switch (event) {
      case 'maxretry':
        return this.onMaxRetry ? this.onMaxRetry(sendData) : warnMissingOnMethod(event, sendData, debug);
      case 'connecting':
        return this.onConnecting ? this.onConnecting(sendData) : warnMissingOnMethod(event, sendData, debug);
      case 'connect-timeout':
        return this.onConnectTimeout ? this.onConnectTimeout(sendData) : warnMissingOnMethod(event, sendData, debug);
      case 'open':
        return this.onOpen ? this.onOpen(sendData) : warnMissingOnMethod(event, sendData, debug);
      case 'close':
        return this.onClose ? this.onClose(sendData) : warnMissingOnMethod(event, sendData, debug);
      case 'message':
        return this.onMessage ? this.onMessage(sendData) : warnMissingOnMethod(event, sendData, debug);
      case 'send':
        return this.onSend ? this.onSend(sendData) : warnMissingOnMethod(event, sendData, debug);
      case 'closing':
        return this.onClosing ? this.onClosing(sendData) : warnMissingOnMethod(event, sendData, debug);
      case 'error':
        return this.onError ? this.onError(sendData) : warnMissingOnMethod(event, sendData, true);
      default:
        return warnMissingOnMethod(event, sendData, debug);
    }
  }
}


export default ReconnectingWebSocket;
