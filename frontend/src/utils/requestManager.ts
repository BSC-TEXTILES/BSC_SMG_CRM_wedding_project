/**
 * Request Deduplication and Retry Manager
 * - Prevents identical API requests from firing simultaneously
 * - Implements exponential backoff for retries
 */

interface RequestOptions extends RequestInit {
  retryCount?: number;
  maxRetries?: number;
  baseDelayMs?: number;
}

class RequestManager {
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  /**
   * Generates a unique key for the request based on URL, method, and body.
   */
  private generateKey(url: string, options: RequestInit): string {
    const method = options.method || 'GET';
    const bodyStr = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${bodyStr}`;
  }

  /**
   * Waits for a specified number of milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Executes a fetch request with deduplication and exponential backoff retry logic.
   */
  async fetchWithRetry(url: string, options: RequestOptions = {}): Promise<any> {
    const { maxRetries = 3, baseDelayMs = 1000, ...fetchOptions } = options;
    const requestKey = this.generateKey(url, fetchOptions);

    // If an identical request is already in flight, return its promise
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey);
    }

    const executeRequest = async (currentRetry: number = 0): Promise<any> => {
      try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          // If we hit a 429 Too Many Requests or 5xx Server Error, we should retry
          if ((response.status === 429 || response.status >= 500) && currentRetry < maxRetries) {
            const delayMs = baseDelayMs * Math.pow(2, currentRetry);
            
            // Respect Retry-After header if provided
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delayMs;
            
            console.warn(`[RequestManager] Request failed (${response.status}). Retrying in ${waitTime}ms... (${currentRetry + 1}/${maxRetries})`);
            await this.delay(waitTime);
            return executeRequest(currentRetry + 1);
          }

          // Throw an error for other status codes or if max retries reached
          const errorData = await response.json().catch(() => ({}));
          const error: any = new Error(errorData.message || `Request failed with status ${response.status}`);
          error.status = response.status;
          throw error;
        }

        return await response.json();
      } catch (err: any) {
        // Network errors might not have a status, retry them as well
        if (!err.status && currentRetry < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, currentRetry);
          console.warn(`[RequestManager] Network error. Retrying in ${delayMs}ms... (${currentRetry + 1}/${maxRetries})`);
          await this.delay(delayMs);
          return executeRequest(currentRetry + 1);
        }
        throw err;
      }
    };

    // Store the promise in the map
    const promise = executeRequest(0)
      .finally(() => {
        // Remove from flight map once resolved or rejected
        this.inFlightRequests.delete(requestKey);
      });

    this.inFlightRequests.set(requestKey, promise);

    return promise;
  }
}

export const requestManager = new RequestManager();
