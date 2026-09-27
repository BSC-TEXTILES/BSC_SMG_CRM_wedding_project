import { Auth, API } from './api';
import defaultDetector, { DevtoolsDetectorListener } from 'devtools-detector';

export interface DevToolsDetectionState {
  isOpen: boolean;
  confidence: 'High' | 'Moderate' | 'None';
  source: string;
  lastChecked: string;
  lastDetection: {
    time: string;
    source: string;
    confidence: 'High' | 'Moderate';
    page: string;
  } | null;
  armed: boolean;
}

type Listener = (state: DevToolsDetectionState) => void;

class DevToolsDetectorService {
  private armed: boolean = false;
  private isOpen: boolean = false;
  private confidence: 'High' | 'Moderate' | 'None' = 'None';
  private source: string = 'None';
  private lastChecked: string = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  private lastDetection: DevToolsDetectionState['lastDetection'] = null;

  private listeners: Set<Listener> = new Set();
  private timer: number | null = null;
  private clockTimer: number | null = null;
  private consecutiveCleanChecks: number = 0;
  private lastReportedState: 'OPEN' | 'CLOSED' | null = null;
  private lastReportTime: number = 0;
  private checking: boolean = false; // Mutex to prevent concurrent check() calls

  // Track library detector state
  private libraryDetected: boolean = false;
  private libraryCheckerName: string = '';

  constructor() {
    this.initLibraryDetector();
  }

  private initLibraryDetector() {
    try {
      const listener: DevtoolsDetectorListener = (open, detail) => {
        this.libraryDetected = open;
        this.libraryCheckerName = (detail && detail.checkerName) || 'Browser DevTools Inspector';
        if (this.armed) {
          this.check();
        }
      };
      defaultDetector.addListener(listener);
    } catch {
      // Safe fallback if detector fails to load in non-browser env
    }
  }

  public getState(): DevToolsDetectionState {
    return {
      isOpen: this.isOpen,
      confidence: this.confidence,
      source: this.source,
      lastChecked: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
      lastDetection: this.lastDetection,
      armed: this.armed
    };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try { fn(state); } catch {}
    });
  }

  public arm(enable: boolean) {
    if (this.armed === enable) return;
    this.armed = enable;

    if (enable) {
      this.startMonitoring();
    } else {
      this.stopMonitoring();
      this.isOpen = false;
      this.confidence = 'None';
      this.source = 'None';
      this.lastReportedState = null;
      this.notify();
    }
  }

  private startMonitoring() {
    try {
      defaultDetector.setDetectDelay(800);
      defaultDetector.launch();
    } catch {}

    if (this.timer === null && typeof window !== 'undefined') {
      this.check();
      this.timer = window.setInterval(() => {
        this.check();
      }, 500);

      window.addEventListener('resize', this.handleWindowChange);
      window.addEventListener('focus', this.handleWindowChange);
      window.addEventListener('blur', this.handleWindowChange);
    }
  }

  private stopMonitoring() {
    try {
      defaultDetector.stop();
    } catch {}

    if (this.timer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.timer);
      this.timer = null;
      window.removeEventListener('resize', this.handleWindowChange);
      window.removeEventListener('focus', this.handleWindowChange);
      window.removeEventListener('blur', this.handleWindowChange);
    }
  }

  private handleWindowChange = () => {
    if (this.armed) {
      this.check();
    }
  };

  /**
   * Evaluates supported browser developer inspection signals.
   * Completely ignores background operating system applications (VS Code, CMD, PowerShell, etc.).
   */
  public check() {
    // Mutex: prevent concurrent check() calls from creating duplicate events
    if (this.checking) return;
    this.checking = true;

    try {
      this.lastChecked = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      if (!this.armed) {
        this.notify();
        return;
      }

      let detected = false;
      let detectedSource = 'None';
      let detectedConfidence: 'High' | 'Moderate' = 'High';

      // ── Signal 1: Standard Viewport Differential (Docked Panels) ──
      if (typeof window !== 'undefined') {
        const threshold = 160;
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        const widthThreshold = widthDiff > threshold;
        const heightThreshold = heightDiff > threshold;

        const isDocked = !(heightThreshold && widthThreshold) && (widthThreshold || heightThreshold);

        if (isDocked) {
          detected = true;
          detectedSource = widthThreshold
            ? 'Docked Browser Inspector (Side Panel)'
            : 'Docked Browser Inspector (Bottom Panel)';
          detectedConfidence = 'High';
        }
      }

      // ── Signal 2: devtools-detector Multi-Heuristic Engine (Undocked & Debuggers) ──
      if (!detected && this.libraryDetected) {
        detected = true;
        detectedSource = this.libraryCheckerName
          ? `Browser DevTools (${this.libraryCheckerName})`
          : 'Browser Developer Inspection Tool';
        detectedConfidence = 'High';
      }

      // ── Signal 3: In-Page Mobile Inspection Tools (Eruda, vConsole) ──
      if (!detected && typeof window !== 'undefined') {
        const w = window as any;
        if (w.eruda || w.__eruda || w.vConsole || w.__vconsole) {
          detected = true;
          detectedSource = 'In-Page Mobile Inspector (Browser-based)';
          detectedConfidence = 'High';
        } else if (typeof document !== 'undefined') {
          if (document.getElementById('eruda') || document.getElementById('__vconsole')) {
            detected = true;
            detectedSource = 'In-Page Mobile Inspector (Browser-based)';
            detectedConfidence = 'High';
          }
        }
      }

      // ── State Transition Logic ──
      if (detected) {
        this.consecutiveCleanChecks = 0;
        const wasClosed = !this.isOpen;

        this.isOpen = true;
        this.confidence = detectedConfidence;
        this.source = detectedSource;
        this.lastDetection = {
          time: this.lastChecked,
          source: detectedSource,
          confidence: detectedConfidence,
          page: typeof window !== 'undefined' ? window.location.pathname : '/'
        };

        this.notify();

        // Only report transition to server once (cooldown enforced)
        if (wasClosed || this.lastReportedState !== 'OPEN') {
          const now = Date.now();
          if (now - this.lastReportTime > 3000) {
            this.lastReportTime = now;
            this.lastReportedState = 'OPEN';
            this.reportToServer('DEVTOOLS_DETECTED', {
              source: detectedSource,
              confidence: detectedConfidence,
              page: typeof window !== 'undefined' ? window.location.pathname : '/'
            });
          }
        }
      } else {
        this.consecutiveCleanChecks++;
        // Require 2 consecutive clean checks (1 second) to avoid transient flicker
        if (this.consecutiveCleanChecks >= 2) {
          const wasOpen = this.isOpen;
          this.isOpen = false;
          this.confidence = 'None';
          this.source = 'None';

          this.notify();

          if (wasOpen && this.lastReportedState !== 'CLOSED') {
            this.lastReportedState = 'CLOSED';
            this.reportToServer('DEVTOOLS_CLOSED', {
              source: 'Browser Developer Tools Closed',
              page: typeof window !== 'undefined' ? window.location.pathname : '/'
            });
          }
        } else {
          this.notify();
        }
      }
    } finally {
      this.checking = false;
    }
  }

  private async reportToServer(event: 'DEVTOOLS_DETECTED' | 'DEVTOOLS_CLOSED', details: any) {
    try {
      const session = Auth.get();
      if (!session) return; // Only log for authenticated sessions

      await API.logSecurityEvent(event, {
        ...details,
        timestamp: new Date().toISOString(),
        userId: session.id ?? session.username,
        username: session.username,
        role: session.role
      }).catch(() => {});
    } catch {
      // Non-blocking
    }
  }
}

export const DevToolsDetector = new DevToolsDetectorService();
