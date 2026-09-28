import { API, Auth } from './api';
import type { Socket } from 'socket.io-client';
import { realtimeClient } from './realtimeClient';

export interface SystemNotification {
  id: string;
  title: string;
  subject?: string;
  message: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  category: 'General' | 'HR' | 'Recruitment' | 'Interview' | 'Offer' | 'Joining' | 'Payroll' | 'System' | 'Emergency';
  targetRole?: string;
  targetUserIds?: string[];
  senderName?: string;
  read: boolean;
  pinned?: boolean;
  archived?: boolean;
  status?: 'Draft' | 'Scheduled' | 'Sent' | 'Expired' | 'Cancelled';
  requireAcknowledgement?: boolean;
  acknowledgedBy?: { username: string; readTime: string }[];
  expiryDate?: string;
  scheduledAt?: string;
  allowReplies?: boolean;
  replies?: { id: string; sender: string; text: string; time: string }[];
  type?: string;
  actionData?: any;
}

export interface DirectMessage {
  id: string;
  senderUsername: string;
  senderName: string;
  recipientUsername: string;
  recipientName: string;
  text: string;
  timestamp: string;
  read: boolean;
  delivered: boolean;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  volume: number; // 0 to 1
  desktopToastEnabled: boolean;
  toastDuration: number; // seconds
  showPreview: boolean;
  muteWorkingHours: boolean;
}

class NotificationEngine {
  private listeners: ((notifications: SystemNotification[]) => void)[] = [];
  private dmListeners: ((messages: DirectMessage[]) => void)[] = [];
  private notifications: SystemNotification[] = [];
  private directMessages: DirectMessage[] = [];
  private settings: NotificationSettings = {
    soundEnabled: true,
    volume: 0.8,
    desktopToastEnabled: true,
    toastDuration: 5,
    showPreview: true,
    muteWorkingHours: false
  };
  private socket: Socket | null = null;
  private initialized = false;
  // Live subscribers for the Developer Tools shield toggle (DevToolsGuard)
  private shieldListeners = new Set<(enabled: boolean) => void>();
  // Live subscribers for security detection events (Admin Dashboard)
  private securityEventListeners = new Set<(event: any) => void>();
  private securityClearedListeners = new Set<() => void>();

  constructor() {
    this.loadSettings();
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const isPublicPath = pathname === '/' || pathname.startsWith('/madt') || pathname.startsWith('/feedback') || pathname === '/login' || pathname === '/apply';
      if (!isPublicPath) {
        this.initSocket();
      }
      this.initAuthListener();
    }
  }

  public ensureSocket() {
    if (!this.initialized && typeof window !== 'undefined') {
      this.initSocket();
    }
  }

  private initAuthListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('bsc_auth_changed', () => {
      // Runs synchronously inside Auth.clear()/Auth.save(), so it must never
      // throw or re-trigger another auth event.
      try {
        if (Auth.check()) {
          // Login is a wake-up signal: the shared socket stops retrying after a
          // few failed handshakes, so re-arm it here rather than staying quiet.
          realtimeClient.resume();
          this.fetchInitialBroadcasts().catch(() => {});
        } else {
          this.notifications = [];
          this.notifyListeners();
        }
      } catch (e) {
        console.warn('[NotificationService] auth listener error:', e);
      }
    });

    // Returning to a backgrounded tab is the other natural moment to pick up a
    // backend that came back up in the meantime.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Auth.check()) {
        realtimeClient.resume();
      }
    });
  }

  private initSocket() {
    if (this.initialized) return;
    this.initialized = true;
    // Attach to the app's single shared Socket.IO connection rather than opening
    // a second one. This callback runs on every successful handshake, so the
    // handlers below are bound exactly once per socket instance and survive a
    // dropped-and-restarted backend.
    realtimeClient.onSocket((socket) => this.wireSocket(socket));
    realtimeClient.connect();
  }

  private wireSocket(socket: Socket) {
    if (this.socket === socket) return;
    this.socket = socket;

    socket.on('NEW_BROADCAST', (broadcast: any) => {
      this.handleIncomingBroadcast(broadcast);
    });

    socket.on('feedback:negative', (data: any) => {
      const notif: SystemNotification = {
        id: 'fb-' + Date.now(),
        title: '🚨 Negative Customer Feedback Alert',
        subject: 'Store Escalation',
        message: data.message || 'Negative feedback submitted by customer',
        timestamp: new Date().toISOString(),
        priority: 'critical',
        category: 'Emergency',
        targetRole: 'Everyone',
        senderName: 'Customer Tablet',
        read: false
      };
      this.notifications = [notif, ...this.notifications];
      this.notifyListeners();
      this.playNotificationSound('critical');
    });

    socket.on('divert:created', (data: any) => {
      const notif: SystemNotification = {
        id: 'div-' + Date.now(),
        title: '📦 Urgent Stock Divert Request',
        subject: 'Sourcing Alert',
        message: data.message || 'New stock divert request created',
        timestamp: new Date().toISOString(),
        priority: 'high',
        category: 'General',
        targetRole: 'Everyone',
        senderName: data.createdBy || 'Floor Staff',
        read: false
      };
      this.notifications = [notif, ...this.notifications];
      this.notifyListeners();
      this.playNotificationSound('high');
    });

    socket.on('DELETE_BROADCAST', ({ id }: { id: string }) => {
      this.notifications = this.notifications.filter(n => n.id !== id.toString());
      this.notifyListeners();
    });

    socket.on('notification:new', (notifData: any) => {
      if (!notifData) return;
      const notifId = String(notifData.id || 'notif-' + Date.now());
      if (this.notifications.some(n => n.id === notifId)) return;

      const notif: SystemNotification = {
        id: notifId,
        title: notifData.title || 'System Notification',
        subject: notifData.subject || '',
        message: notifData.message || '',
        timestamp: notifData.timestamp || new Date().toISOString(),
        priority: notifData.priority || 'normal',
        category: notifData.category || 'General',
        targetRole: notifData.targetRole || 'Everyone',
        senderName: notifData.senderName || 'System',
        read: false,
        type: notifData.type,
        actionData: notifData.action_data || notifData.actionData
      };
      this.notifications = [notif, ...this.notifications];
      this.notifyListeners();
      this.playNotificationSound(notif.priority);
    });

    socket.on('employee:access_request', (reqData: any) => {
      if (!reqData) return;
      const session = Auth.get();
      const isAdmin = session && ['admin', 'super admin', 'system administrator'].includes(String(session.role || '').toLowerCase());
      if (!isAdmin) return;

      const notifId = `access-req-${reqData.id}`;
      if (this.notifications.some(n => n.id === notifId)) return;

      const notif: SystemNotification = {
        id: notifId,
        title: '🛡️ Employee Profile Access Request',
        subject: 'Access Control',
        message: `${reqData.username || 'A user'} (${reqData.user_role || 'Staff'}) requested access to view ${reqData.employee_name || 'an employee'} (Reason: "${reqData.reason || 'Not specified'}").`,
        timestamp: reqData.created_at || new Date().toISOString(),
        priority: 'high',
        category: 'HR',
        targetRole: 'Admins',
        senderName: reqData.username || 'Staff',
        read: false,
        type: 'access_request',
        actionData: {
          requestId: reqData.id,
          employeeId: reqData.employee_id,
          employeeName: reqData.employee_name,
          username: reqData.username
        }
      };
      this.notifications = [notif, ...this.notifications];
      this.notifyListeners();
      this.playNotificationSound('high');
    });

    socket.on('employee:access_request_resolved', (data: any) => {
      if (!data || !data.id) return;
      const notifId = `access-req-${data.id}`;
      this.notifications = this.notifications.map(n => {
        if (n.id === notifId || (n.actionData && n.actionData.requestId === data.id)) {
          return {
            ...n,
            read: true,
            message: `${n.message} [Resolved: ${data.status.toUpperCase()} by ${data.resolved_by_name || 'Admin'}]`,
            actionData: { ...n.actionData, status: data.status, resolved: true }
          };
        }
        return n;
      });
      this.notifyListeners();
    });

    // Developer Tools shield live toggle (Admin → System Settings → Security).
    // The server broadcasts a single boolean when an Admin flips the switch so
    // every device re-arms the guard instantly. No user or security data is
    // carried in this event.
    socket.on('security:shield_changed', (payload: { enabled?: boolean } | undefined) => {
      const enabled = !!(payload && payload.enabled);
      this.shieldListeners.forEach((fn) => {
        try { fn(enabled); } catch { /* a broken listener must not kill the socket */ }
      });
    });

    socket.on('security:event_logged', (eventData: any) => {
      this.securityEventListeners.forEach((fn) => {
        try { fn(eventData); } catch {}
      });
    });

    socket.on('security:events_cleared', () => {
      this.securityClearedListeners.forEach((fn) => {
        try { fn(); } catch {}
      });
    });

    // The handshake already completed before this callback ran, so pull the
    // persisted broadcasts now instead of waiting for the next 'connect' event.
    if (Auth.check()) {
      this.fetchInitialBroadcasts();
    }
  }

  public async fetchInitialBroadcasts() {
    if (!Auth.check()) {
      return;
    }
    try {
      const res = await API.getBroadcasts();
      if (res && res.broadcasts) {
        const session = Auth.get();
        const mapped = res.broadcasts.map(this.mapDbBroadcastToNotification);
        
        if (session) {
          this.notifications = mapped.filter((notif: SystemNotification) => {
            return notif.targetRole === 'Everyone' || 
                   notif.targetRole === session.role || 
                   (notif.targetRole === 'HR Team' && (session.role === 'HR' || session.role === 'Admin')) ||
                   (notif.targetRole === 'Store Managers' && session.role === 'Manager') ||
                   (notif.targetRole === 'Admins' && session.role === 'Admin') ||
                   notif.senderName === session.fullName;
          });
        } else {
          this.notifications = mapped;
        }

        this.restoreReadStates();
        this.notifyListeners();
      }
    } catch (e: any) {
      if (e?.status === 401) {
        return; // Silently ignore expired or invalid session
      }
      console.warn('[NotificationService] Broadcasts fetch notice:', e?.message || e);
    }
  }

  private mapDbBroadcastToNotification = (dbItem: any): SystemNotification => {
    return {
      id: dbItem.id.toString(),
      title: dbItem.title,
      subject: dbItem.subject || '',
      message: dbItem.message,
      timestamp: dbItem.created_at,
      priority: dbItem.priority as any,
      category: dbItem.category as any,
      targetRole: dbItem.target_role,
      senderName: dbItem.sender_name,
      read: false,
      pinned: !!dbItem.pinned,
      status: dbItem.status as any,
      requireAcknowledgement: !!dbItem.require_ack,
    };
  }

  private handleIncomingBroadcast(broadcast: any) {
    const session = Auth.get();
    if (!session) return;

    const notif = this.mapDbBroadcastToNotification(broadcast);
    
    const isTarget = notif.targetRole === 'Everyone' || 
                    notif.targetRole === session.role || 
                    (notif.targetRole === 'HR Team' && (session.role === 'HR' || session.role === 'Admin')) ||
                    (notif.targetRole === 'Store Managers' && session.role === 'Manager') ||
                    (notif.targetRole === 'Admins' && session.role === 'Admin') ||
                    notif.senderName === session.fullName;

    if (isTarget) {
      if (!this.notifications.some(n => n.id === notif.id)) {
        this.notifications = [notif, ...this.notifications];
        this.notifyListeners();
        this.playNotificationSound(notif.priority);
      }
    }
  }

  private loadSettings() {
    try {
      const storedSettings = localStorage.getItem('bsc_enterprise_notification_settings');
      if (storedSettings) {
        this.settings = JSON.parse(storedSettings);
      }
    } catch (e) {}
  }

  private restoreReadStates() {
    try {
      const readStates = JSON.parse(localStorage.getItem('bsc_enterprise_read_broadcasts') || '{}');
      this.notifications = this.notifications.map(n => ({
        ...n,
        read: !!readStates[n.id]
      }));
    } catch(e) {}
  }

  private persistReadStates() {
    try {
      const readStates = this.notifications.reduce((acc, n) => {
        if (n.read) acc[n.id] = true;
        return acc;
      }, {} as Record<string, boolean>);
      localStorage.setItem('bsc_enterprise_read_broadcasts', JSON.stringify(readStates));
    } catch(e) {}
  }

  public saveSettings(newSettings: NotificationSettings) {
    this.settings = newSettings;
    try {
      localStorage.setItem('bsc_enterprise_notification_settings', JSON.stringify(newSettings));
    } catch (e) {}
  }

  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  public isSoundEnabled(): boolean {
    return !!this.settings.soundEnabled;
  }

  public toggleSound(enable?: boolean): boolean {
    const next = enable !== undefined ? enable : !this.settings.soundEnabled;
    this.saveSettings({ ...this.settings, soundEnabled: next });
    return next;
  }

  public getUnreadCount(): number {
    const session = Auth.get();
    if (!session) return 0;
    
    return this.notifications.filter(n => {
      if (n.read) return false;
      const t = n.targetRole;
      return t === 'Everyone' || t === session.role || 
             (t === 'HR Team' && (session.role === 'HR' || session.role === 'Admin')) ||
             (t === 'Store Managers' && session.role === 'Manager') ||
             (t === 'Admins' && session.role === 'Admin') ||
             n.senderName === session.fullName;
    }).length;
  }

  public getUnreadDirectCount(username?: string): number {
    return this.directMessages.filter(m => !m.read && (!username || m.recipientUsername === username)).length;
  }

  public markAsRead(id: string) {
    let found = false;
    this.notifications = this.notifications.map(n => {
      if (n.id === id) {
        found = true;
        return { ...n, read: true };
      }
      return n;
    });
    if (found) {
      this.persistReadStates();
      this.notifyListeners();
    }
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.persistReadStates();
    this.notifyListeners();
  }

  public acknowledgeNotification(id: string, username: string) {
    this.markAsRead(id);
  }

  public acknowledgeRead(id: string, username: string) {
    this.markAsRead(id);
  }

  public togglePin(id: string) {
    const item = this.notifications.find(n => n.id === id);
    if (item) {
      item.pinned = !item.pinned;
      this.notifyListeners();
    }
  }

  public toggleArchive(id: string) {
    this.markAsRead(id);
  }

  public sendDirectMessage(toUserId: string, recipientName?: string, content?: string, senderId?: string, senderName?: string) {
    return this.sendDM(toUserId, content || recipientName || '');
  }

  public playSound(priority: 'low' | 'normal' | 'high' | 'critical' = 'normal') {
    this.playNotificationSound(priority);
  }

  public async addNotification(data: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) {
    try {
      const payload = {
        title: data.title,
        subject: data.subject,
        message: data.message,
        priority: data.priority,
        category: data.category,
        target_role: data.targetRole,
        sender_name: data.senderName,
        status: data.status,
        require_ack: data.requireAcknowledgement,
        pinned: data.pinned
      };
      await API.createBroadcast(payload);
    } catch(err) {
      console.error('[NotificationService] Add failed', err);
    }
  }

  public async deleteNotification(id: string) {
    try {
      await API.deleteBroadcast(id);
    } catch(err) {
      console.error('[NotificationService] Delete failed', err);
    }
  }

  public getNotifications(): SystemNotification[] {
    return [...this.notifications];
  }

  /**
   * Subscribe to live Developer Tools shield toggles pushed by the server
   * (`security:shield_changed`). Used by DevToolsGuard so an Admin toggle in
   * System Settings takes effect on every device immediately. Returns an
   * unsubscribe function.
   */
  public onShieldChanged(listener: (enabled: boolean) => void): () => void {
    this.shieldListeners.add(listener);
    return () => {
      this.shieldListeners.delete(listener);
    };
  }

  public onSecurityEvent(listener: (event: any) => void): () => void {
    this.ensureSocket();
    this.securityEventListeners.add(listener);
    return () => {
      this.securityEventListeners.delete(listener);
    };
  }

  public onSecurityEventsCleared(listener: () => void): () => void {
    this.ensureSocket();
    this.securityClearedListeners.add(listener);
    return () => {
      this.securityClearedListeners.delete(listener);
    };
  }

  public subscribe(listener: (notifications: SystemNotification[]) => void) {
    this.ensureSocket();
    this.listeners.push(listener);
    listener([...this.notifications]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    const list = [...this.notifications];
    this.listeners.forEach(l => l(list));
  }

  public subscribeDMs(callback: (dms: DirectMessage[]) => void) {
    this.ensureSocket();
    this.dmListeners.push(callback);
    callback([...this.directMessages]);
    return () => {
      this.dmListeners = this.dmListeners.filter((cb) => cb !== callback);
    };
  }

  async sendDM(toUserId: string, content: string) {
    // Legacy stub or future implementation
  }

  public playNotificationSound(priority: 'low' | 'normal' | 'high' | 'critical' = 'normal') {
    if (!this.settings.soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      let freq1 = 440, freq2 = 880, duration = 0.1;
      
      switch(priority) {
        case 'high': freq1 = 880; freq2 = 1760; duration = 0.15; break;
        case 'critical': freq1 = 1200; freq2 = 2400; duration = 0.3; break;
        case 'low': freq1 = 300; freq2 = 600; duration = 0.05; break;
      }
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq1, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + duration);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.settings.volume * 0.1, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }
}

export const NotificationService = new NotificationEngine();
