// 함께 보기 서버 연결
// 서버가 없거나 끊기면 "혼자 보기" 모드로 계속 동작합니다. (GitHub Pages 같은 정적 호스팅에서도 OK)

function serverUrl() {
  const custom = window.HAEDOTI_CONFIG && window.HAEDOTI_CONFIG.server;
  if (custom) return custom.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
  if (location.protocol === 'file:') return null;
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
}

function visitorId() {
  try {
    let v = localStorage.getItem('haedoti.visitor');
    if (!v) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('');
      localStorage.setItem('haedoti.visitor', v);
    }
    return v;
  } catch {
    return null;
  }
}

export class Net {
  constructor(handlers) {
    this.h = handlers; // { onStatus, onRoom, onSeat, onQueue, onFx }
    this.ws = null;
    this.connected = false;
    this.want = null; // { room, char, color }
    this.retry = 0;
    this.url = serverUrl();
    this.visitor = visitorId();
  }

  connect() {
    if (!this.url) {
      this.h.onStatus('solo');
      return;
    }
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.h.onStatus('solo');
      return;
    }
    this.ws = ws;
    const giveUp = setTimeout(() => {
      if (!this.connected) ws.close();
    }, 5000);
    ws.onopen = () => {
      clearTimeout(giveUp);
      this.connected = true;
      this.retry = 0;
      this.h.onStatus('online');
      this.send({ t: 'hello', visitor: this.visitor });
      if (this.want) this.send({ t: 'join', ...this.want, visitor: this.visitor });
    };
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.t === 'welcome') {
        this.myId = m.id;
        // 처음 받은 버전과 다르면 서버가 새로 배포된 것
        if (!this.version) this.version = m.version;
        else if (m.version && m.version !== this.version && this.h.onNewVersion) this.h.onNewVersion();
      }
      else if (m.t === 'room') this.h.onRoom(m);
      else if (m.t === 'seat') this.h.onSeat(m.seat);
      else if (m.t === 'queue') this.h.onQueue(m.pos);
      else if (m.t === 'fx') this.h.onFx(m.list);
      else if (m.t === 'full') this.h.onStatus('full');
      else if (m.t === 'wallet' && this.h.onWallet) this.h.onWallet(m.wallet);
      else if (m.t === 'need' && this.h.onNeed) this.h.onNeed(m.item);
    };
    ws.onclose = () => {
      clearTimeout(giveUp);
      const wasConnected = this.connected;
      this.connected = false;
      this.ws = null;
      this.myId = null;
      this.h.onStatus(wasConnected ? 'reconnecting' : 'solo');
      // 다시 연결을 시도합니다 (최대 30초 간격).
      this.retry++;
      const delay = Math.min(30000, 1500 * 2 ** Math.min(this.retry, 5));
      setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => {};
  }

  send(msg) {
    if (this.ws && this.connected) this.ws.send(JSON.stringify(msg));
  }

  join(room, char, color, hair = 0, pet = 0) {
    this.want = { room, char, color, hair, pet };
    this.send({ t: 'join', ...this.want, visitor: this.visitor });
  }

  stat(k) {
    this.send({ t: 'stat', k });
  }

  use(item, on) {
    this.send({ t: 'use', item, on });
  }

  wish(i) {
    this.send({ t: 'wish', i });
  }

  // 복구 코드로 다른 기기의 구매 내역을 가져오면 기기 번호를 바꿉니다.
  adoptVisitor(v) {
    try {
      localStorage.setItem('haedoti.visitor', v);
    } catch {
      /* 저장 불가 */
    }
    this.visitor = v;
    if (this.ws) this.ws.close();
  }

  move(x, y) {
    this.send({ t: 'move', x, y });
  }

  wood() {
    this.send({ t: 'wood' });
  }

  say(i) {
    this.send({ t: 'say', i });
  }

  cheer() {
    this.send({ t: 'cheer' });
  }

  ritual(i = null) {
    this.send(i == null ? { t: 'ritual' } : { t: 'ritual', i });
  }
}
