import { API, Auth, UserSession } from './api';
import type { Socket } from 'socket.io-client';
import { realtimeClient } from './realtimeClient';
import { showToast } from '../components/Toast';

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
  toastDuration: number;
  showPreview: boolean;
  muteWorkingHours: boolean;
}

/**
 * NotificationAudioEngine
 * ───────────────────────
 * Professional, rich, full-volume enterprise audio synthesizer using the Web Audio API.
 * 1. Single reusable AudioContext with automatic resumption on user interaction.
 * 2. Multi-tone harmonic chime (clear, rich, bell-like presence).
 * 3. Dynamics compression ensuring loud, full, distortion-free sound.
 * 4. Autoplay restriction handling via global user interaction unlock listeners.
 * 5. Sound debouncing to prevent audio distortion on rapid bursts.
 */
class NotificationAudioEngine {
  private audioCtx: AudioContext | null = null;
  private isUnlocked = false;
  private lastSoundPlayedAt = 0;
  private readonly THROTTLE_MS = 350; // Debounce window for rapid successive notifications

  constructor() {
    this.setupAutoplayUnlock();
  }

  /**
   * Registers global user gesture listeners to safely unlock and resume AudioContext
   * in compliance with modern browser autoplay policies (Chrome, Safari, Edge, Mobile).
   */
  public setupAutoplayUnlock(): void {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.unlockAudio();
    };

    const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach((evt) => {
      window.addEventListener(evt, unlockHandler, { once: false, passive: true });
    });
  }

  public unlockAudio(): void {
    try {
      const ctx = this.getOrCreateAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => {
            this.isUnlocked = true;
          }).catch(() => {});
        } else if (ctx.state === 'running') {
          this.isUnlocked = true;
        }
      }
    } catch {
      // Silently continue
    }
  }

  private getOrCreateAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.audioCtx) return this.audioCtx;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    } catch {
      // AudioContext unavailable or restricted
    }
    return this.audioCtx;
  }

  /**
   * Plays a rich, full, resonant enterprise notification chime.
   * Multi-tone harmonic chime designed to be clearly audible and luxurious.
   */
  public playChime(volume: number = 1.0, priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'): void {
    const now = Date.now();
    if (now - this.lastSoundPlayedAt < this.THROTTLE_MS) {
      return;
    }
    this.lastSoundPlayedAt = now;

    try {
      const ctx = this.getOrCreateAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.isUnlocked = true;
          this.synthesizeFullChime(ctx, volume, priority);
        }).catch(() => {});
      } else if (ctx.state === 'running') {
        this.isUnlocked = true;
        this.synthesizeFullChime(ctx, volume, priority);
      }
    } catch {
      // Audio playback must never disrupt notification processing
    }
  }

  private synthesizeFullChime(
    ctx: AudioContext,
    volume: number,
    priority: 'low' | 'normal' | 'high' | 'critical'
  ): void {
    try {
      const startTime = ctx.currentTime;
      const clampedVol = Math.max(0.15, Math.min(1.0, volume));
      const peakGain = clampedVol * 0.75; // Rich, full, clearly audible volume

      // Master compressor to ensure full presence without digital clipping
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, startTime);
      compressor.knee.setValueAtTime(10, startTime);
      compressor.ratio.setValueAtTime(4, startTime);
      compressor.attack.setValueAtTime(0.003, startTime);
      compressor.release.setValueAtTime(0.25, startTime);
      compressor.connect(ctx.destination);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(peakGain, startTime);
      masterGain.connect(compressor);

      // Helper to synthesize individual harmonic musical chime notes
      const playTone = (freq: number, startOffset: number, toneDuration: number, toneGain = 0.5) => {
        const noteStart = startTime + startOffset;
        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2, noteStart);

        // Bell envelope: rapid attack (8ms) followed by musical exponential release
        noteGain.gain.setValueAtTime(0.0001, noteStart);
        noteGain.gain.linearRampToValueAtTime(toneGain, noteStart + 0.008);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + toneDuration);

        osc.connect(noteGain);
        overtone.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(noteStart);
        overtone.start(noteStart);
        osc.stop(noteStart + toneDuration);
        overtone.stop(noteStart + toneDuration);
      };

      if (priority === 'critical') {
        // Double-strike urgent high alert (A5 -> E6 -> A5 -> E6)
        playTone(880.00, 0.00, 0.18, 0.6);
        playTone(1318.51, 0.04, 0.22, 0.5);
        playTone(880.00, 0.18, 0.22, 0.6);
        playTone(1318.51, 0.22, 0.45, 0.7);
      } else if (priority === 'high') {
        // 4-Tone ascending executive alert (F#5 -> A#5 -> C#6 -> F#6)
        playTone(739.99, 0.00, 0.35, 0.5);
        playTone(932.33, 0.11, 0.40, 0.55);
        playTone(1108.73, 0.22, 0.45, 0.6);
        playTone(1479.98, 0.33, 0.60, 0.65);
      } else if (priority === 'low') {
        // Gentle mellow two-tone (D5 -> A5)
        playTone(587.33, 0.00, 0.35, 0.45);
        playTone(880.00, 0.10, 0.45, 0.5);
      } else {
        // Normal: Resonant, luxury 4-tone chime (E5 -> G#5 -> B5 -> E6 sustain)
        playTone(659.25, 0.00, 0.40, 0.5);
        playTone(830.61, 0.11, 0.45, 0.55);
        playTone(987.77, 0.22, 0.50, 0.6);
        playTone(1318.51, 0.33, 0.65, 0.65);
      }
    } catch {
      // Audio playback must never crash the service
    }
  }
}

/**
 * NotificationEngine
 * ──────────────────
 * Central enterprise notification state manager:
 * - Real-time Socket.IO + background polling synchronization.
 * - Enforces:
 *   1. Pop-up messages (Toasts) and full sound alerts for genuinely NEW targeted messages.
 *   2. Rich professional multi-tone chime played with full volume presence.
 *   3. Audio Alerts ON/OFF and Popups ON/OFF toggles strictly respected.
 *   4. Zero sound on page loads, refreshes, tab focuses, drawer opens, or read toggles.
 *   5. Duplicate sound protection via unique notification ID tracking.
 */
class NotificationEngine {
  private listeners: ((notifications: SystemNotification[]) => void)[] = [];
  private dmListeners: ((messages: DirectMessage[]) => void)[] = [];
  private notifications: SystemNotification[] = [];
  private directMessages: DirectMessage[] = [];
  private settings: NotificationSettings = {
    soundEnabled: true,
    volume: 1.0,
    desktopToastEnabled: true, // Popups allowed & enabled per user requirement
    toastDuration: 6,
    showPreview: true,
    muteWorkingHours: false
  };

  private socket: Socket | null = null;
  private initialized = false;
  private initialLoadCompleted = false;
  private seenNotificationIds = new Set<string>();
  private readonly audioEngine = new NotificationAudioEngine();
  private pollIntervalTimer: any = null;

  // Live subscribers for Developer Tools shield & security events
  private shieldListeners = new Set<(enabled: boolean) => void>();
  private securityEventListeners = new Set<(event: any) => void>();
  private securityClearedListeners = new Set<() => void>();

  constructor() {
    this.loadSettings();
    this.loadSeenNotificationIds();

    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const isPublicPath = pathname === '/' || pathname.startsWith('/madt') || pathname.startsWith('/feedback') || pathname === '/login' || pathname === '/apply';
      if (!isPublicPath) {
        this.initSocket();
      }
      this.initAuthListener();
      this.startBackgroundSync();
    }
  }

  private loadSeenNotificationIds(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem('bsc_seen_notification_ids');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => this.seenNotificationIds.add(String(id)));
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveSeenNotificationIds(): void {
    if (typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.seenNotificationIds).slice(-500); // Retain latest 500 IDs
      sessionStorage.setItem('bsc_seen_notification_ids', JSON.stringify(arr));
    } catch {
      // Ignore storage errors
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
      try {
        if (Auth.check()) {
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

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Auth.check()) {
        realtimeClient.resume();
      }
    });
  }

  private initSocket() {
    if (this.initialized) return;
    this.initialized = true;

    realtimeClient.onSocket((socket) => this.wireSocket(socket));
    realtimeClient.connect();
  }

  private startBackgroundSync() {
    if (typeof window === 'undefined') return;
    if (this.pollIntervalTimer) clearInterval(this.pollIntervalTimer);

    // Fallback sync every 30 seconds for polling/failover environments
    this.pollIntervalTimer = setInterval(() => {
      if (Auth.check() && this.initialLoadCompleted) {
        this.syncBroadcastsQuietly().catch(() => {});
      }
    }, 30000);
  }

  private wireSocket(socket: Socket) {
    if (this.socket === socket) return;
    this.socket = socket;

    // 1. Broadcast announcements
    socket.on('NEW_BROADCAST', (broadcast: any) => {
      this.handleIncomingBroadcast(broadcast);
    });

    // 2. Direct system alerts
    socket.on('notification:new', (notifData: any) => {
      if (!notifData) return;
      const notifId = String(notifData.id || 'notif-' + Date.now());

      const notif: SystemNotification = {
        id: notifId,
        title: notifData.title || 'System Notification',
        subject: notifData.subject || '',
        message: notifData.message || '',
        timestamp: notifData.timestamp || new Date().toISOString(),
        priority: notifData.priority || 'normal',
        category: notifData.category || 'General',
        targetRole: notifData.targetRole || 'Everyone',
        targetUserIds: notifData.targetUserIds,
        senderName: notifData.senderName || 'System',
        read: false,
        type: notifData.type,
        actionData: notifData.action_data || notifData.actionData
      };

      this.processGenuinelyNewNotification(notif);
    });

    // 3. Employee access requests (Admin notifications)
    socket.on('employee:access_request', (reqData: any) => {
      if (!reqData) return;
      const session = Auth.get();
      const isAdmin = session && ['admin', 'super admin', 'system administrator'].includes(String(session.role || '').toLowerCase());
      if (!isAdmin) return;

      const notifId = `access-req-${reqData.id}`;
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

      this.processGenuinelyNewNotification(notif);
    });

    socket.on('employee:access_request_resolved', (data: any) => {
      if (!data || !data.id) return;
      const notifId = `access-req-${data.id}`;
      this.notifications = this.notifications.map((n) => {
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

    // 4. Negative customer feedback escalation
    socket.on('feedback:negative', (data: any) => {
      const notif: SystemNotification = {
        id: 'fb-' + (data?.id || Date.now()),
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
      this.processGenuinelyNewNotification(notif);
    });

    // 5. Urgent divert requests
    socket.on('divert:created', (data: any) => {
      const notif: SystemNotification = {
        id: 'div-' + (data?.id || Date.now()),
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
      this.processGenuinelyNewNotification(notif);
    });

    socket.on('DELETE_BROADCAST', ({ id }: { id: string }) => {
      this.notifications = this.notifications.filter((n) => n.id !== id.toString());
      this.notifyListeners();
    });

    // 6. Developer Tools shield toggle
    socket.on('security:shield_changed', (payload: { enabled?: boolean } | undefined) => {
      const enabled = !!(payload && payload.enabled);
      this.shieldListeners.forEach((fn) => {
        try { fn(enabled); } catch {}
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

    if (Auth.check()) {
      this.fetchInitialBroadcasts();
    }
  }

  /**
   * Validates whether a notification is targeted to the logged-in user.
   */
  private isNotificationTargeted(notif: SystemNotification, session: UserSession | null): boolean {
    if (!session) return false;

    const role = (session.role || '').trim();
    const roleLower = role.toLowerCase();
    const isAdmin = ['admin', 'super admin', 'system administrator'].includes(roleLower);

    // Target by specific user ID
    if (Array.isArray(notif.targetUserIds) && notif.targetUserIds.length > 0) {
      if (notif.targetUserIds.some((uid) => String(uid) === String(session.id))) {
        return true;
      }
    }

    const t = (notif.targetRole || '').trim();
    if (!t || t === 'Everyone') return true;
    if (t === role) return true;
    if (t === 'HR Team' && (roleLower === 'hr' || isAdmin)) return true;
    if (t === 'Store Managers' && (roleLower === 'manager' || roleLower === 'store manager' || isAdmin)) return true;
    if (t === 'Admins' && isAdmin) return true;
    if (notif.senderName && notif.senderName === session.fullName) return true;

    return false;
  }

  /**
   * Processes a genuinely new incoming notification:
   * 1. Verifies recipient targeting.
   * 2. Checks duplicate ID.
   * 3. Adds to notification drawer list at the top.
   * 4. Updates unread badge count in Topbar.
   * 5. Plays notification sound once (if Audio Alerts = ON and session initialized).
   * 6. Strictly NO popups/toasts.
   */
  private processGenuinelyNewNotification(notif: SystemNotification): void {
    const session = Auth.get();
    if (!session || !this.isNotificationTargeted(notif, session)) {
      return;
    }

    const notifId = String(notif.id);

    // Duplicate protection: if already seen/processed, never play sound
    if (this.seenNotificationIds.has(notifId)) {
      if (!this.notifications.some((n) => n.id === notifId)) {
        this.notifications = [notif, ...this.notifications];
        this.notifyListeners();
      }
      return;
    }

    // Genuinely new notification arrived
    this.seenNotificationIds.add(notifId);
    this.saveSeenNotificationIds();

    this.notifications = [notif, ...this.notifications.filter((n) => n.id !== notifId)];
    this.notifyListeners();

    // 1. Trigger Pop-up Toast Message for targeted notifications
    if (this.initialLoadCompleted && this.settings.desktopToastEnabled) {
      const toastType =
        notif.priority === 'critical' ? 'error' :
        notif.priority === 'high' ? 'warn' :
        'info';
      showToast(
        notif.message || notif.subject || 'New notification received',
        toastType,
        notif.title || 'Notification'
      );
    }

    // 2. Play full resonant sound ONLY if initial session load has completed and sound is enabled
    if (this.initialLoadCompleted && this.settings.soundEnabled) {
      this.audioEngine.playChime(this.settings.volume, notif.priority);
    }
  }

  /**
   * Initial fetch on login / page boot.
   * Marks ALL existing DB notifications as seen so NO sound ever plays on load/refresh.
   */
  public async fetchInitialBroadcasts(): Promise<void> {
    if (!Auth.check()) return;

    try {
      const res = await API.getBroadcasts();
      if (res && res.broadcasts) {
        const session = Auth.get();
        const mapped = res.broadcasts.map(this.mapDbBroadcastToNotification);

        if (session) {
          this.notifications = mapped.filter((notif: SystemNotification) =>
            this.isNotificationTargeted(notif, session)
          );
        } else {
          this.notifications = mapped;
        }

        // Mark all existing historical notifications as seen
        this.notifications.forEach((n) => {
          this.seenNotificationIds.add(String(n.id));
        });
        this.saveSeenNotificationIds();

        this.restoreReadStates();
        this.notifyListeners();
      }
    } catch (e: any) {
      if (e?.status === 401) return;
      console.warn('[NotificationService] Broadcasts fetch notice:', e?.message || e);
    } finally {
      // Mark initial load complete after DB items are safely recorded
      this.initialLoadCompleted = true;
    }
  }

  /**
   * Periodic background polling to sync new broadcasts in non-websocket environments.
   */
  private async syncBroadcastsQuietly(): Promise<void> {
    if (!Auth.check()) return;

    try {
      const res = await API.getBroadcasts();
      if (!res || !res.broadcasts) return;

      const session = Auth.get();
      const mapped = res.broadcasts.map(this.mapDbBroadcastToNotification);
      const targeted = mapped.filter((n: SystemNotification) => this.isNotificationTargeted(n, session));

      let hasNew = false;
      targeted.forEach((notif: SystemNotification) => {
        const id = String(notif.id);
        if (!this.seenNotificationIds.has(id)) {
          hasNew = true;
          this.seenNotificationIds.add(id);
          this.notifications = [notif, ...this.notifications.filter((n) => n.id !== id)];
        }
      });

      if (hasNew) {
        this.saveSeenNotificationIds();
        this.restoreReadStates();
        this.notifyListeners();

        if (this.initialLoadCompleted && this.settings.soundEnabled) {
          this.audioEngine.playChime(this.settings.volume, 'normal');
        }
      }
    } catch {
      // Silent catch
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
  };

  private handleIncomingBroadcast(broadcast: any): void {
    const notif = this.mapDbBroadcastToNotification(broadcast);
    this.processGenuinelyNewNotification(notif);
  }

  private loadSettings(): void {
    try {
      const storedSettings = localStorage.getItem('bsc_enterprise_notification_settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        this.settings = {
          ...this.settings,
          ...parsed,
          desktopToastEnabled: parsed.desktopToastEnabled !== undefined ? Boolean(parsed.desktopToastEnabled) : true,
          soundEnabled: parsed.soundEnabled !== undefined ? Boolean(parsed.soundEnabled) : true,
          volume: typeof parsed.volume === 'number' ? parsed.volume : 1.0
        };
      }
    } catch {}
  }

  private restoreReadStates(): void {
    try {
      const readStates = JSON.parse(localStorage.getItem('bsc_enterprise_read_broadcasts') || '{}');
      this.notifications = this.notifications.map((n) => ({
        ...n,
        read: !!readStates[n.id]
      }));
    } catch {}
  }

  private persistReadStates(): void {
    try {
      const readStates = this.notifications.reduce((acc, n) => {
        if (n.read) acc[n.id] = true;
        return acc;
      }, {} as Record<string, boolean>);
      localStorage.setItem('bsc_enterprise_read_broadcasts', JSON.stringify(readStates));
    } catch {}
  }

  public saveSettings(newSettings: NotificationSettings): void {
    this.settings = { ...newSettings };
    try {
      localStorage.setItem('bsc_enterprise_notification_settings', JSON.stringify(this.settings));
    } catch {}
  }

  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  public isSoundEnabled(): boolean {
    return !!this.settings.soundEnabled;
  }

  public isToastEnabled(): boolean {
    return !!this.settings.desktopToastEnabled;
  }

  public toggleSound(enable?: boolean): boolean {
    const next = enable !== undefined ? enable : !this.settings.soundEnabled;
    this.saveSettings({ ...this.settings, soundEnabled: next });
    return next;
  }

  public toggleToast(enable?: boolean): boolean {
    const next = enable !== undefined ? enable : !this.settings.desktopToastEnabled;
    this.saveSettings({ ...this.settings, desktopToastEnabled: next });
    return next;
  }

  public unlockAudio(): void {
    this.audioEngine.unlockAudio();
  }

  public getUnreadCount(): number {
    const session = Auth.get();
    if (!session) return 0;

    return this.notifications.filter((n) => {
      if (n.read) return false;
      return this.isNotificationTargeted(n, session);
    }).length;
  }

  public getUnreadDirectCount(username?: string): number {
    return this.directMessages.filter((m) => !m.read && (!username || m.recipientUsername === username)).length;
  }

  /**
   * Reading or acknowledging a notification updates state without triggering any audio.
   */
  public markAsRead(id: string): void {
    let found = false;
    this.notifications = this.notifications.map((n) => {
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

  public markAllAsRead(): void {
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.persistReadStates();
    this.notifyListeners();
  }

  public acknowledgeNotification(id: string, username: string): void {
    this.markAsRead(id);
  }

  public acknowledgeRead(id: string, username: string): void {
    this.markAsRead(id);
  }

  public togglePin(id: string): void {
    const item = this.notifications.find((n) => n.id === id);
    if (item) {
      item.pinned = !item.pinned;
      this.notifyListeners();
    }
  }

  /**
   * Archive / restore a notification. The drawer's Archive tab filters on
   * `archived`, which nothing used to set, so that tab was always empty and the
   * row button called a method that did not exist.
   */
  public archive(id: string): void {
    const item = this.notifications.find((n) => n.id === id);
    if (!item || item.archived) return;
    item.archived = true;
    item.read = true;
    this.notifyListeners();
  }

  public unarchive(id: string): void {
    const item = this.notifications.find((n) => n.id === id);
    if (!item || !item.archived) return;
    item.archived = false;
    this.notifyListeners();
  }

  public toggleArchive(id: string): void {
    const item = this.notifications.find((n) => n.id === id);
    if (!item) return;
    if (item.archived) this.unarchive(id);
    else this.archive(id);
  }

  public sendDirectMessage(toUserId: string, recipientName?: string, content?: string, senderId?: string, senderName?: string) {
    return this.sendDM(toUserId, content || recipientName || '');
  }

  /**
   * Explicit audio test trigger (e.g. from NotificationPreferencesModal or Test Sound buttons).
   */
  public playSound(priority: 'low' | 'normal' | 'high' | 'critical' = 'normal', volume?: number): void {
    this.audioEngine.playChime(volume ?? this.settings.volume, priority);
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
    } catch (err) {
      console.error('[NotificationService] Add failed', err);
    }
  }

  public async deleteNotification(id: string) {
    try {
      await API.deleteBroadcast(id);
    } catch (err) {
      console.error('[NotificationService] Delete failed', err);
    }
  }

  public getNotifications(): SystemNotification[] {
    return [...this.notifications];
  }

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
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    const list = [...this.notifications];
    this.listeners.forEach((l) => l(list));
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
}

export const NotificationService = new NotificationEngine();
