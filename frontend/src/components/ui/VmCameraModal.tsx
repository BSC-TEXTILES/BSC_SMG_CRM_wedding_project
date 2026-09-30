import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Camera,
  RotateCcw,
  Check,
  Zap,
  ZapOff,
  RefreshCw,
  AlertTriangle,
  UploadCloud,
  SwitchCamera
} from 'lucide-react';

interface VmCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (file: File) => void;
  floor?: string;
  section?: string;
}

export default function VmCameraModal({
  isOpen,
  onClose,
  onPhotoCaptured,
  floor = 'Store',
  section = 'Section'
}: VmCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputFallbackRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [cameraState, setCameraState] = useState<'loading' | 'active' | 'captured' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  // Stop all active camera tracks cleanly
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      } catch {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {}
    }
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  // Start the device camera stream
  const startCamera = useCallback(async () => {
    stopTracks();
    setCameraState('loading');
    setErrorMessage('');
    setCapturedDataUrl(null);
    setCapturedBlob(null);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setErrorMessage('Camera is not available on this device or browser. You can upload an image from your device instead.');
      return;
    }

    try {
      // Prefer environment (rear) camera on mobile, with fallback to any video
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        // Fallback constraint if environment facing failed
        if (facingMode === 'environment') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw err;
        }
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check torch / flash support
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities && videoTrack.getCapabilities()) as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      }

      setCameraState('active');
    } catch (err: any) {
      console.warn('[Camera Access Error]', err);
      setCameraState('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access was denied. Please allow camera access in your browser settings or upload an image from your device.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('Camera is not available on this device. You can upload an image from your device instead.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMessage('Camera is currently in use by another application. Please close other camera apps and try again.');
      } else {
        setErrorMessage(err.message || 'Unable to access camera on this device.');
      }
    }
  }, [facingMode, stopTracks]);

  // Handle open / close lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopTracks();
    }

    return () => {
      stopTracks();
    };
  }, [isOpen, startCamera, stopTracks]);

  // Toggle Torch/Flash
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0] as any;
    if (track && track.applyConstraints) {
      try {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn('Torch toggle failed:', err);
      }
    }
  };

  // Flip Front/Back Camera
  const switchFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture Frame from Video
  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontal if front camera
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setCapturedBlob(blob);
        setCapturedDataUrl(dataUrl);
        setCameraState('captured');
      },
      'image/jpeg',
      0.92
    );
  };

  // Retake Photo
  const handleRetake = () => {
    setCapturedDataUrl(null);
    setCapturedBlob(null);
    setCameraState('active');
    if (videoRef.current && streamRef.current) {
      videoRef.current.play().catch(() => {});
    } else {
      startCamera();
    }
  };

  // Use Captured Photo
  const handleUsePhoto = () => {
    if (!capturedBlob) return;
    const cleanFloor = floor.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanSection = section.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `vm_photo_${cleanFloor}_${cleanSection}_${Date.now()}.jpg`;

    const file = new File([capturedBlob], filename, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });

    stopTracks();
    onPhotoCaptured(file);
    onClose();
  };

  // Fallback file input handler
  const handleFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopTracks();
      onPhotoCaptured(file);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 text-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-white/15 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-neutral-950 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-accent/20 text-accent">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide text-white">
                Take VM Audit Photo
              </h3>
              <p className="text-[11px] text-white/60">
                {floor} — {section}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopTracks();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Camera Viewport.
            The tall black frame only makes sense when something is being shown in
            it. In the error state it left ~400px of empty black above a two-line
            message, so the height is now conditional and the modal hugs its content. */}
        <div
          className={`relative bg-black flex-1 flex items-center justify-center overflow-hidden ${
            cameraState === 'error' ? 'min-h-0 px-2 py-1' : 'min-h-[340px] sm:min-h-[420px]'
          }`}
        >
          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Hidden File Input for Fallback */}
          <input
            ref={fileInputFallbackRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            className="hidden"
            onChange={handleFallbackFileSelect}
          />

          {/* Live Video Feed */}
          {cameraState !== 'captured' && cameraState !== 'error' && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full max-h-[500px] object-cover transition-opacity duration-300 ${
                cameraState === 'active' ? 'opacity-100' : 'opacity-0'
              } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          )}

          {/* Captured Image Preview */}
          {cameraState === 'captured' && capturedDataUrl && (
            <div className="relative w-full h-full max-h-[500px] flex items-center justify-center p-2 animate-fade-in">
              <img
                src={capturedDataUrl}
                alt="Captured VM audit"
                className="max-h-[480px] w-auto max-w-full object-contain rounded-xl shadow-lg border border-white/20"
              />
              <div className="absolute top-4 left-4 bg-emerald-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow backdrop-blur-xs flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Captured Successfully</span>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {cameraState === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
              <RefreshCw className="w-8 h-8 text-accent animate-spin" />
              <span className="text-xs font-semibold text-white/80">
                Initializing camera feed...
              </span>
            </div>
          )}

          {/* Error & Fallback View */}
          {cameraState === 'error' && (
            <div className="p-6 text-center max-w-md space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Camera Unavailable</h4>
                <p className="text-xs text-white/70 leading-relaxed">{errorMessage}</p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputFallbackRef.current?.click()}
                  className="px-4 py-2 bg-accent text-primary font-bold text-xs rounded-xl flex items-center gap-1.5 shadow hover:opacity-90 transition-all cursor-pointer w-full sm:w-auto justify-center"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Choose Image File</span>
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3.5 py-2 bg-white/10 text-white hover:bg-white/20 text-xs font-bold rounded-xl transition-all cursor-pointer w-full sm:w-auto"
                >
                  Retry Camera
                </button>
              </div>
            </div>
          )}

          {/* In-Camera Floating Controls (Torch & Camera Switch) */}
          {cameraState === 'active' && (
            <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2.5 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                    torchOn
                      ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/40'
                      : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                  title={torchOn ? 'Turn Flash Off' : 'Turn Flash On'}
                >
                  {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={switchFacingMode}
                className="p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-all cursor-pointer"
                title="Switch Camera (Front/Rear)"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Action Controls Footer */}
        <div className="p-4 bg-neutral-950 border-t border-white/10 flex items-center justify-between gap-3">
          {cameraState === 'active' && (
            <>
              <button
                type="button"
                onClick={() => fileInputFallbackRef.current?.click()}
                className="px-3 py-2 text-white/70 hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span className="hidden sm:inline">Upload instead</span>
              </button>

              <div className="flex items-center gap-3 mx-auto">
                <button
                  type="button"
                  onClick={handleCapture}
                  className="w-16 h-16 rounded-full bg-accent text-primary flex items-center justify-center p-1.5 shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Capture photo"
                >
                  <div className="w-full h-full rounded-full border-2 border-primary/40 flex items-center justify-center">
                    <Camera className="w-6 h-6" />
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopTracks();
                  onClose();
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}

          {cameraState === 'captured' && (
            <div className="w-full flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleUsePhoto}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-900/40 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Use Photo</span>
              </button>
            </div>
          )}

          {cameraState === 'error' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => {
                  stopTracks();
                  onClose();
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
