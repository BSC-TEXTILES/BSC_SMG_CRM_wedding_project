import React, { useState, useEffect } from 'react';
import { X, Bell, Pin, CheckCheck, Trash2, Search, Volume2, VolumeX, MessageSquare, Sliders, CircleCheck, Archive, TriangleAlert } from 'lucide-react';
import { NotificationService, SystemNotification } from '../../services/notificationService';
import NotificationPreferencesModal from './NotificationPreferencesModal';
import DirectMessagingModal from './DirectMessagingModal';
import { Auth } from '../../services/api';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'broadcasts' | 'system' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);

  const session = Auth.get();
  const username = session?.username || 'user';

  useEffect(() => {
    const unsubscribe = NotificationService.subscribe((list) => {
      setNotifications(list);
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const filtered = notifications.filter(n => {
    if (activeTab === 'unread' && n.read) return false;
    if (activeTab === 'archived' && !n.archived) return false;
    if (activeTab !== 'archived' && n.archived) return false;
    if (activeTab === 'broadcasts' && n.category !== 'General' && n.category !== 'HR') return false;
    if (activeTab === 'system' && n.category !== 'System') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    }
    return true;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical': return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-status-danger/15 text-status-danger border border-status-danger/30 animate-pulse">CRITICAL</span>;
      case 'high': return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-status-warning/15 text-status-warning border border-status-warning/30">HIGH</span>;
      case 'low': return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-background text-text-secondary border border-border">LOW</span>;
      default: return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-status-info/15 text-status-info border border-status-info/30">NORMAL</span>;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

        <aside className="relative w-full max-w-md bg-card h-full shadow-2xl flex flex-col z-10 animate-fade-in border-l border-border">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-accent/20 bg-primary text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary-dark/80 text-accent-light border border-accent/20">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-base tracking-tight leading-tight text-white">Notification Center</h2>
                <p className="text-[10.5px] text-accent-light font-semibold mt-0.5">Real-time alerts &amp; announcements</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setDmOpen(true)}
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Direct Text Messaging"
              >
                <MessageSquare className="w-4 h-4 text-accent-light" />
              </button>
              <button
                onClick={() => setPrefsOpen(true)}
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Audio & Notification Preferences"
              >
                <Sliders className="w-4 h-4 text-accent-light" />
              </button>
              <button onClick={onClose} className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & Tabs */}
          <div className="p-3 bg-background border-b border-border space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-accent" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alerts & broadcasts..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-card text-xs text-text-primary font-semibold focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="flex items-center justify-between text-xs font-bold pt-1 overflow-x-auto">
              <div className="flex items-center gap-1">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'unread', label: `Unread (${NotificationService.getUnreadCount()})` },
                  { key: 'broadcasts', label: 'Broadcasts' },
                  { key: 'system', label: 'System' },
                  { key: 'archived', label: 'Archive' }
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key as any)}
                    className={`
                      px-2.5 py-1 rounded-lg text-[10.5px] transition-all whitespace-nowrap
                      ${activeTab === t.key ? 'bg-primary text-white font-extrabold' : 'text-text-secondary hover:bg-border/50'}
                    `}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => NotificationService.markAllAsRead()}
                className="text-[10.5px] text-accent font-extrabold hover:underline flex items-center gap-1 flex-shrink-0 ml-2"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filtered.length > 0 ? (
              filtered.map((n) => {
                const isAcked = n.acknowledgedBy?.some(a => a.username === username);
                return (
                  <div
                    key={n.id}
                    className={`
                      p-3.5 rounded-2xl border transition-all duration-150 relative space-y-2 group
                      ${!n.read ? 'bg-accent/10 border-accent/30 shadow-xs' : 'bg-card border-border'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {!n.read && <span className="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0" />}
                        <h3 className="font-extrabold text-xs text-text-primary leading-tight">{n.title}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {getPriorityBadge(n.priority)}
                        <button
                          onClick={() => NotificationService.togglePin(n.id)}
                          className={`p-1 rounded hover:bg-black/5 ${n.pinned ? 'text-accent' : 'text-text-muted'}`}
                          title="Pin message"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => NotificationService.toggleArchive(n.id)}
                          className={`p-1 rounded hover:bg-black/5 ${n.archived ? 'text-status-info' : 'text-text-muted'}`}
                          title="Archive message"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => NotificationService.deleteNotification(n.id)}
                          className="p-1 rounded text-text-muted hover:text-status-danger hover:bg-status-danger/10"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-text-secondary font-medium leading-relaxed">{n.message}</p>

                    {/* Read Acknowledgement Button */}
                    {n.requireAcknowledgement && (
                      <div className="pt-2 border-t border-border flex items-center justify-between">
                        {isAcked ? (
                          <span className="text-[10px] font-black text-status-success flex items-center gap-1">
                            <CircleCheck className="w-3.5 h-3.5" />
                            <span>Acknowledgement Confirmed</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => NotificationService.acknowledgeRead(n.id, username)}
                            className="btn-primary px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold shadow-xs"
                          >
                            I Have Read &amp; Acknowledge
                          </button>
                        )}
                        <span className="text-[9.5px] text-text-secondary font-semibold">
                          {(n.acknowledgedBy?.length || 0)} Acknowledgements
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-text-secondary font-semibold pt-1">
                      <span className="font-mono">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!n.read && (
                        <button
                          onClick={() => NotificationService.markAsRead(n.id)}
                          className="text-accent font-extrabold hover:underline"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 space-y-2">
                <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mx-auto text-primary">
                  <Bell className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div className="text-xs font-extrabold text-text-primary">No Notifications</div>
                <p className="text-[11px] text-text-secondary max-w-xs mx-auto">You're all caught up! Broadcasts and alerts will appear here.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <NotificationPreferencesModal isOpen={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <DirectMessagingModal isOpen={dmOpen} onClose={() => setDmOpen(false)} session={session} />
    </>
  );
}
