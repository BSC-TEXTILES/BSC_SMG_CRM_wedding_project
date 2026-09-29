import { io, Socket } from 'socket.io-client';
import { API, Auth } from './api';
import { permissionsCache } from '../context/PermissionsCache';

export type RealtimeEntity =
  | 'user'
  | 'employee'
  | 'candidate'
  | 'wedding'
  | 'wedding_reg'
  | 'feedback'
  | 'callqueue'
  | 'footfall'
  | 'divert'
  | 'qr'
  | 'permissions'
  | 'vm';

type SocketListener = (socket: Socket) => void;

/**
 * Consecutive failed handshakes tolerated before the client goes quiet. The
 * browser logs an ERR_CONNECTION_REFUSED for every attempt, so an unbounded
 * retry loop against a stopped backend floods the console; this caps it.
 */
const MAX_CONNECT_FAILURES = 3;
const RETRY_BASE_DELAY = 2000;

class RealtimeClient {
  private socket: Socket | null = null;
  private isConnected = false;
  private connectFailures = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private gaveUp = false;
  private socketListeners = new Set<SocketListener>();

  /**
   * Single shared connection for the whole app. Resolves to the page origin so
   * it follows the same rule as the REST base ('/api'): in development the Vite
   * proxy forwards /socket.io to the local backend, and in production it
   * resolves to the deployed host. No backend URL is ever baked into the bundle.
   */
  public connect(): void {
    if (this.socket?.connected) return;
    if (typeof window === 'undefined') return;
    if (this.gaveUp) return;
    if (!this.socket) this.open();
  }

  private open(): void {
    this.clearRetry();

    this.socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      // Reconnection is driven by `scheduleRetry` below so that a backend that
      // is down produces a bounded number of handshake attempts.
      reconnection: false,
      timeout: 10000,
      query: { locationId: Auth.get()?.locationId ?? '' }
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.connectFailures = 0;
      const session = Auth.get();
      if (session?.locationId) {
        this.socket?.emit('join_location', session.locationId);
      }
      this.socketListeners.forEach((cb) => {
        try { if (this.socket) cb(this.socket); } catch { /* a broken listener must not kill the socket */ }
      });
      this.wireEntityEvents();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.scheduleRetry();
    });

    this.socket.on('connect_error', () => {
      this.isConnected = false;
      this.connectFailures += 1;
      if (this.connectFailures >= MAX_CONNECT_FAILURES) {
        this.stop();
      } else {
        this.scheduleRetry();
      }
    });

    // Hand the socket to consumers that registered before the first connect.
    // `isConnected` is only true here once the handshake succeeded, and the
    // connect handler above already notified listeners for this socket
    // instance, so a consumer attached after connecting is served exactly once.
    if (this.isConnected) {
      this.socketListeners.forEach((cb) => {
        try { if (this.socket) cb(this.socket); } catch { /* ignore */ }
      });
    }
  }

  private scheduleRetry(): void {
    if (this.gaveUp || this.retryTimer) return;
    const delay = RETRY_BASE_DELAY * (this.connectFailures + 1);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.teardown();
      this.open();
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private teardown(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /** Stop retrying until an explicit wake-up (login, tab focus, page change). */
  private stop(): void {
    this.gaveUp = true;
    this.clearRetry();
    this.teardown();
  }

  /**
   * Re-arm after `stop()` gave up on an unreachable backend. Called on auth
   * changes and when the tab regains focus so a restarted server is picked up
   * without a page reload.
   */
  public resume(): void {
    this.gaveUp = false;
    this.connectFailures = 0;
    this.clearRetry();
    if (this.socket?.connected) return;
    this.teardown();
    this.open();
  }

  /**
   * Register a consumer of the shared socket (used by NotificationService so
   * the app keeps exactly one connection). The callback also runs on every
   * reconnection, so handlers never have to be re-attached by hand.
   * Returns an unsubscribe function.
   */
  public onSocket(cb: SocketListener): () => void {
    this.socketListeners.add(cb);
    if (this.socket && this.isConnected) {
      try { cb(this.socket); } catch { /* ignore */ }
    }
    return () => { this.socketListeners.delete(cb); };
  }

  public refreshConnection(): void {
    this.resume();
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  private wireEntityEvents(): void {
    if (!this.socket) return;

    const handlePermissionsUpdate = (payload: any) => {
      permissionsCache.invalidate();
      window.dispatchEvent(new CustomEvent('permissions-updated', { detail: payload }));
      window.dispatchEvent(new CustomEvent('realtime:permissions', { detail: payload }));

      const current = Auth.get();
      const targetUserId = payload?.userId || payload?.id;
      if (current && targetUserId && Number(current.id) === Number(targetUserId)) {
        API.getMyPermissions().then((res: any) => {
          if (res?.data?.modules) {
            const updated = { ...current, modules: res.data.modules };
            localStorage.setItem('bsc_user_session', JSON.stringify(updated));
            localStorage.setItem('user', JSON.stringify(updated));
            window.dispatchEvent(new Event('bsc_auth_changed'));
          }
        }).catch(() => {});
      }
    };

    this.socket.on('permissions:update', handlePermissionsUpdate);

    const handleUserEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:user', { detail: payload }));
    };
    this.socket.on('user:create', handleUserEvent);
    this.socket.on('user:update', handleUserEvent);
    this.socket.on('user:delete', handleUserEvent);
    this.socket.on('user:status', handleUserEvent);
    this.socket.on('user:permissions', handlePermissionsUpdate);

    const handleEmployeeEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:employee', { detail: payload }));
    };
    this.socket.on('employee:create', handleEmployeeEvent);
    this.socket.on('employee:update', handleEmployeeEvent);
    this.socket.on('employee:delete', handleEmployeeEvent);

    const handleCandidateEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:candidate', { detail: payload }));
    };
    this.socket.on('candidate:create', handleCandidateEvent);
    this.socket.on('candidate:update', handleCandidateEvent);

    const handleWeddingEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:wedding', { detail: payload }));
    };
    this.socket.on('wedding:create', handleWeddingEvent);
    this.socket.on('wedding:update', handleWeddingEvent);
    this.socket.on('wedding:call_logged', handleWeddingEvent);

    const handleWeddingRegEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:wedding_reg', { detail: payload }));
      window.dispatchEvent(new CustomEvent('realtime:wedding', { detail: payload }));
    };
    this.socket.on('wedding_reg:create', handleWeddingRegEvent);
    this.socket.on('wedding_reg:update', handleWeddingRegEvent);

    const handleFeedbackEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:feedback', { detail: payload }));
    };
    this.socket.on('feedback:create', handleFeedbackEvent);
    this.socket.on('feedback:submitted', handleFeedbackEvent);
    this.socket.on('feedback:deleted', handleFeedbackEvent);
    this.socket.on('feedback:cleared', handleFeedbackEvent);

    const handleCallQueueEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:callqueue', { detail: payload }));
      window.dispatchEvent(new CustomEvent('realtime:feedback', { detail: payload }));
    };
    this.socket.on('callqueue:update', handleCallQueueEvent);
    this.socket.on('callqueue:updated', handleCallQueueEvent);

    const handleFootfallEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:footfall', { detail: payload }));
    };
    this.socket.on('footfall:create', handleFootfallEvent);
    this.socket.on('footfall:update', handleFootfallEvent);
    this.socket.on('footfall:updated', handleFootfallEvent);

    const handleDivertEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:divert', { detail: payload }));
    };
    this.socket.on('divert:create', handleDivertEvent);
    this.socket.on('divert:update', handleDivertEvent);

    const handleQrEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:qr', { detail: payload }));
    };
    this.socket.on('qr:create', handleQrEvent);
    this.socket.on('qr:scan', handleQrEvent);
    this.socket.on('qr:scanned', handleQrEvent);

    const handleVmEvent = (payload: any) => {
      window.dispatchEvent(new CustomEvent('realtime:vm', { detail: payload }));
    };
    this.socket.on('vm:create', handleVmEvent);
    this.socket.on('vm:update', handleVmEvent);
    this.socket.on('vm:delete', handleVmEvent);
    this.socket.on('vm:audit_submitted', handleVmEvent);
    this.socket.on('vm:photo_uploaded', handleVmEvent);
    this.socket.on('vm:photo_deleted', handleVmEvent);
    this.socket.on('vm:updated', handleVmEvent);
  }
}

export const realtimeClient = new RealtimeClient();
