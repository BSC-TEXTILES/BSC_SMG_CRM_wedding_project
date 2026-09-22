import { io, Socket } from 'socket.io-client';
import { Auth } from './api';
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
  | 'permissions';

class RealtimeClient {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectTimer: any = null;

  constructor() {
    this.connect();
  }

  public connect(): void {
    if (this.socket && this.socket.connected) return;

    try {
      // @ts-ignore
      const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
        ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') 
        : window.location.origin;

      const session = Auth.get();
      const token = session?.token;

      this.socket = io(apiBase, {
        autoConnect: true,
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 10000,
        auth: {
          token
        },
        query: {
          locationId: session?.locationId || ''
        }
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        // If session has location, join location room
        if (session?.locationId) {
          this.socket?.emit('join_location', session.locationId);
        }
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });

      this.socket.on('connect_error', () => {
        this.isConnected = false;
      });

      // ── Wire Entity Event Dispatches to window Events ───────────────────────

      // Permissions Updates
      const handlePermissionsUpdate = (payload: any) => {
        permissionsCache.invalidate();
        window.dispatchEvent(new CustomEvent('permissions-updated', { detail: payload }));
        window.dispatchEvent(new CustomEvent('realtime:permissions', { detail: payload }));
      };

      this.socket.on('permissions:update', handlePermissionsUpdate);

      // User Accounts
      const handleUserEvent = (payload: any) => {
        window.dispatchEvent(new CustomEvent('realtime:user', { detail: payload }));
      };
      this.socket.on('user:create', handleUserEvent);
      this.socket.on('user:update', handleUserEvent);
      this.socket.on('user:delete', handleUserEvent);
      this.socket.on('user:status', handleUserEvent);
      this.socket.on('user:permissions', handlePermissionsUpdate);

      // Employees
      const handleEmployeeEvent = (payload: any) => {
        window.dispatchEvent(new CustomEvent('realtime:employee', { detail: payload }));
      };
      this.socket.on('employee:create', handleEmployeeEvent);
      this.socket.on('employee:update', handleEmployeeEvent);
      this.socket.on('employee:delete', handleEmployeeEvent);

      // Candidates
      const handleCandidateEvent = (payload: any) => {
        window.dispatchEvent(new CustomEvent('realtime:candidate', { detail: payload }));
      };
      this.socket.on('candidate:create', handleCandidateEvent);
      this.socket.on('candidate:update', handleCandidateEvent);

      // Wedding Follow-ups & CRM
      const handleWeddingEvent = (payload: any) => {
        window.dispatchEvent(new CustomEvent('realtime:wedding', { detail: payload }));
      };
      this.socket.on('wedding:create', handleWeddingEvent);
      this.socket.on('wedding:update', handleWeddingEvent);
      this.socket.on('wedding:call_logged', handleWeddingEvent);

      // Wedding Customer Registrations
      const handleWeddingRegEvent = (payload: any) => {
        window.dispatchEvent(new CustomEvent('realtime:wedding_reg', { detail: payload }));
        window.dispatchEvent(new CustomEvent('realtime:wedding', { detail: payload }));
      };
      this.socket.on('wedding_reg:create', handleWeddingRegEvent);
      this.socket.on('wedding_reg:update', handleWeddingRegEvent);

      // Customer Feedback
      const handleFeedbackEvent = (payload: any) => {
        window.dispatchEvent(new CustomEvent('realtime:feedback', { detail: payload }));
      };
      this.socket.on('feedback:create', handleFeedbackEvent);
      this.socket.on('feedback:submitted', handleFeedbackEvent);
      this.socket.on('feedback:deleted', handleFeedbackEvent);
      this.socket.on('feedback:cleared', handleFeedbackEvent);

      // Feedback Call Queue
      const handleCallQueueEvent = (payload: any) => {
        window.dispatchEvent(new CustomEvent('realtime:callqueue', { detail: payload }));
        window.dispatchEvent(new CustomEvent('realtime:feedback', { detail: payload }));
      };
      this.socket.on('callqueue:update', handleCallQueueEvent);
      this.socket.on('callqueue:updated', handleCallQueueEvent);

      // Hourly Footfall
      const handleFootfallEvent = (payload: any) => {
        window.dispatchEvent(new CustomEvent('realtime:footfall', { detail: payload }));
      };
      this.socket.on('footfall:create', handleFootfallEvent);
      this.socket.on('footfall:update', handleFootfallEvent);
      this.socket.on('footfall:updated', handleFootfallEvent);

      // Diverts
      const handleDivertEvent = (payload: any) => {
        window.dispatchEvent(new CustomEvent('realtime:divert', { detail: payload }));
      };
      this.socket.on('divert:create', handleDivertEvent);
      this.socket.on('divert:update', handleDivertEvent);

      // QR Portals & Scans
      const handleQrEvent = (payload: any) => {
        window.dispatchEvent(new CustomEvent('realtime:qr', { detail: payload }));
      };
      this.socket.on('qr:create', handleQrEvent);
      this.socket.on('qr:scan', handleQrEvent);
      this.socket.on('qr:scanned', handleQrEvent);

    } catch (e) {
      console.warn('[RealtimeClient] Initialization notice:', e);
    }
  }

  public refreshConnection(): void {
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch {}
      this.socket = null;
    }
    this.connect();
  }

  public getSocket(): Socket | null {
    return this.socket;
  }
}

export const realtimeClient = new RealtimeClient();
