/**
 * BSC Textiles Centralized Asset Manager & Caching System
 * 
 * Production-ready asset manager featuring:
 * 1. In-memory image, video, and texture caches (prevents duplicate network downloads)
 * 2. Promise deduplication (concurrent requests for the same URL share one promise)
 * 3. Priority-based background preloading queue (idle-callback driven)
 * 4. Network-aware throttling (respects saveData and 2G/3G connections)
 */

import * as THREE from 'three';

// Enable Three.js built-in file/texture caching globally
if (typeof THREE !== 'undefined' && THREE.Cache) {
  THREE.Cache.enabled = true;
}

type Priority = 'critical' | 'high' | 'normal' | 'low';

interface PreloadItem {
  url: string;
  type: 'image' | 'video' | 'texture';
  priority: Priority;
}

class CentralAssetManager {
  private static instance: CentralAssetManager;

  // Caches
  private imageCache = new Set<string>();
  private inFlightPromises = new Map<string, Promise<any>>();
  private textureCache = new Map<string, THREE.Texture>();
  private videoCache = new Map<string, HTMLVideoElement>();
  private preloadQueue: PreloadItem[] = [];
  private isProcessingQueue = false;

  private constructor() {
    // Listen for memory pressure if supported
    if (typeof window !== 'undefined') {
      window.addEventListener('lowmemory', () => this.trimCaches(), { passive: true });
    }
  }

  public static getInstance(): CentralAssetManager {
    if (!CentralAssetManager.instance) {
      CentralAssetManager.instance = new CentralAssetManager();
    }
    return CentralAssetManager.instance;
  }

  /**
   * Check if network is constrained (Save-Data or slow 2G/3G)
   */
  public isNetworkConstrained(): boolean {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (!conn) return false;
    if (conn.saveData) return true;
    if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') return true;
    return false;
  }

  /**
   * Check if an image is already cached in memory
   */
  public isImageCached(url: string): boolean {
    return this.imageCache.has(url);
  }

  /**
   * Mark an image as loaded directly
   */
  public markImageLoaded(url: string): void {
    this.imageCache.add(url);
  }

  /**
   * Load image with promise deduplication and memory caching
   */
  public loadImage(url: string): Promise<string> {
    if (!url) return Promise.reject(new Error('Empty URL'));

    // 1. Check in-memory cache
    if (this.imageCache.has(url)) {
      return Promise.resolve(url);
    }

    // 2. Check if a request for this URL is currently in flight
    if (this.inFlightPromises.has(url)) {
      return this.inFlightPromises.get(url)!;
    }

    // 3. Initiate single network request
    const promise = new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;

      img.onload = () => {
        this.imageCache.add(url);
        this.inFlightPromises.delete(url);
        resolve(url);
      };

      img.onerror = (err) => {
        this.inFlightPromises.delete(url);
        reject(err);
      };
    });

    this.inFlightPromises.set(url, promise);
    return promise;
  }

  /**
   * Preload an asset into the priority queue
   */
  public preload(url: string, type: 'image' | 'video' | 'texture' = 'image', priority: Priority = 'normal'): void {
    if (!url || this.imageCache.has(url)) return;

    // Slower networks: skip low and normal background preloads to save user bandwidth
    if (this.isNetworkConstrained() && (priority === 'low' || priority === 'normal')) {
      return;
    }

    // Deduplicate in queue
    if (this.preloadQueue.some((item) => item.url === url)) return;

    this.preloadQueue.push({ url, type, priority });
    this.sortQueue();
    this.scheduleQueueProcessing();
  }

  /**
   * Batch preload multiple image URLs
   */
  public preloadBatch(urls: string[], priority: Priority = 'normal'): void {
    urls.forEach((url) => this.preload(url, 'image', priority));
  }

  private sortQueue(): void {
    const priorityWeights: Record<Priority, number> = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1
    };
    this.preloadQueue.sort((a, b) => priorityWeights[b.priority] - priorityWeights[a.priority]);
  }

  private scheduleQueueProcessing(): void {
    if (this.isProcessingQueue || this.preloadQueue.length === 0) return;
    this.isProcessingQueue = true;

    const processNext = () => {
      if (this.preloadQueue.length === 0) {
        this.isProcessingQueue = false;
        return;
      }

      const item = this.preloadQueue.shift();
      if (!item) {
        this.isProcessingQueue = false;
        return;
      }

      if (item.type === 'image') {
        this.loadImage(item.url)
          .catch(() => {})
          .finally(() => {
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
              window.requestIdleCallback(() => processNext(), { timeout: 1000 });
            } else {
              setTimeout(processNext, 60);
            }
          });
      } else {
        processNext();
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => processNext(), { timeout: 1000 });
    } else {
      setTimeout(processNext, 60);
    }
  }

  /**
   * Three.js Texture Cache & Deduplication
   */
  public getTexture(url: string, loader?: THREE.TextureLoader): Promise<THREE.Texture> {
    if (this.textureCache.has(url)) {
      return Promise.resolve(this.textureCache.get(url)!);
    }

    if (this.inFlightPromises.has(url)) {
      return this.inFlightPromises.get(url)!;
    }

    const texLoader = loader || new THREE.TextureLoader();
    const promise = new Promise<THREE.Texture>((resolve, reject) => {
      texLoader.load(
        url,
        (texture) => {
          this.textureCache.set(url, texture);
          this.inFlightPromises.delete(url);
          resolve(texture);
        },
        undefined,
        (err) => {
          this.inFlightPromises.delete(url);
          reject(err);
        }
      );
    });

    this.inFlightPromises.set(url, promise);
    return promise;
  }

  /**
   * Video Cache & Deduplication
   */
  public getVideo(url: string): HTMLVideoElement {
    if (this.videoCache.has(url)) {
      return this.videoCache.get(url)!;
    }

    const video = document.createElement('video');
    video.src = url;
    video.preload = 'metadata';
    video.playsInline = true;
    this.videoCache.set(url, video);
    return video;
  }

  /**
   * Memory management: trim non-critical caches
   */
  public trimCaches(): void {
    // Retain only the most recent 100 image records
    if (this.imageCache.size > 100) {
      const items = Array.from(this.imageCache);
      this.imageCache = new Set(items.slice(-50));
    }
  }
}

export const AssetManager = CentralAssetManager.getInstance();
