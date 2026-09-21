import { showToast } from '../components/Toast';

class ToastManager {
  private activeRateLimitToast = false;
  private dedupeKeys = new Set<string>();

  error(category: string, message: string, options: { dedupe?: boolean; maxCount?: number; duration?: number } = {}) {
    if (category === 'rate-limit') {
      if (this.activeRateLimitToast) {
        return; // Suppress duplicate rate limit errors
      }
      this.activeRateLimitToast = true;
      showToast(message, 'error');
      
      setTimeout(() => {
        this.activeRateLimitToast = false;
      }, options.duration || 5000);
      return;
    }

    if (options.dedupe) {
      if (this.dedupeKeys.has(category)) return;
      this.dedupeKeys.add(category);
      showToast(message, 'error');
      setTimeout(() => {
        this.dedupeKeys.delete(category);
      }, options.duration || 5000);
      return;
    }
    
    showToast(message, 'error');
  }

  success(message: string) {
    showToast(message, 'success');
  }

  info(message: string) {
    showToast(message, 'info');
  }
}

export const toastManager = new ToastManager();
