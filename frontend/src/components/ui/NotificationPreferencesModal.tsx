import { useState } from 'react';
import { X, Volume2, Sliders } from 'lucide-react';
import { NotificationService, NotificationSettings } from '../../services/notificationService';
import { showToast } from '../Toast';
import ModalPortal from './ModalPortal';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationPreferencesModal({ isOpen, onClose }: NotificationPreferencesModalProps) {
  const [settings, setSettings] = useState<NotificationSettings>(NotificationService.getSettings());

  if (!isOpen) return null;

  const handleSave = () => {
    NotificationService.saveSettings(settings);
    showToast('Notification preferences saved!', 'success');
    onClose();
  };

  const handleTestSound = () => {
    NotificationService.playSound('high');
  };

  return (
    <ModalPortal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Notification & Audio Preferences"
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-5 shadow-2xl border border-accent-soft">
        <div className="flex items-center justify-between border-b border-accent-soft pb-3">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-accent" />
            <h3 className="font-extrabold text-primary text-base">Notification &amp; Audio Preferences</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#6B5D50] hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Pop-up Notification Messages (Toasts) */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#DFDDD7]">
            <div>
              <span className="font-bold text-[#182033] block">Pop-up Notification Messages</span>
              <span className="text-[11px] text-[#687080]">Show real-time toast alert popups on your screen</span>
            </div>
            <input
              type="checkbox"
              checked={settings.desktopToastEnabled}
              onChange={(e) => setSettings({ ...settings, desktopToastEnabled: e.target.checked })}
              className="w-4 h-4 rounded accent-[#C9A45C] cursor-pointer"
            />
          </div>

          {/* Sound Enable */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#DFDDD7]">
            <div>
              <span className="font-bold text-[#182033] block">Notification Audio Alerts</span>
              <span className="text-[11px] text-[#687080]">Play full chime when genuinely new alerts arrive</span>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
              className="w-4 h-4 rounded accent-[#C9A45C] cursor-pointer"
            />
          </div>

          {/* Volume Slider */}
          {settings.soundEnabled && (
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#DFDDD7] space-y-2.5">
              <div className="flex justify-between font-bold text-[#182033]">
                <span>Chime Volume</span>
                <span className="text-[#C9A45C] font-mono">{Math.round(settings.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.0"
                step="0.05"
                value={settings.volume}
                onChange={(e) => setSettings({ ...settings, volume: parseFloat(e.target.value) })}
                className="w-full accent-[#C9A45C] cursor-pointer"
              />
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10.5px] text-[#8B776A]">Resonant, luxury multi-tone chime</span>
                <button
                  type="button"
                  onClick={handleTestSound}
                  className="text-[11px] font-extrabold text-[#C9A45C] hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Test Audio Chime</span>
                </button>
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-950 leading-relaxed">
            <span className="font-bold block text-[#182033] mb-0.5">Real-time Notification Center</span>
            When enabled, incoming alerts will pop up as toast messages on your screen and sound a full, clear audio alert chime for this user.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-accent-soft">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-accent-soft font-bold text-xs">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary text-xs shadow-md">
            Save Preferences
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
