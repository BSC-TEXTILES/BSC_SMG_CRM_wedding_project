import React, { useState, useEffect } from 'react';
import { Activity, X, Calendar, Clock, CircleCheck, TriangleAlert, ShieldCheck, Sparkles, User, LogIn, LogOut } from 'lucide-react';
import { API, Auth } from '../../services/api';

interface ActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ActivityPanel({ isOpen, onClose }: ActivityPanelProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const fetchActivity = () => {
      // Try to get user tracking stats and activity
      API.getUserTrackingStats().then(res => {
        if (res && res.recentActivity) {
          setActivities(res.recentActivity);
          setStats({
            totalLogins: res.totalLoginsToday || 0,
            totalLogouts: res.totalLogoutsToday || 0,
            activeUsers: res.activeUsersToday || 0
          });
        }
      }).catch(() => {
        // Fallback to candidate activity if user tracking fails
        API.getActivity({ limit: 10 }).then(res => {
          if (res && res.activity) {
            setActivities(res.activity);
          }
        }).catch(() => {});
      });
    };

    fetchActivity();
    const intervalId = setInterval(fetchActivity, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <aside className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 animate-fade-in border-l border-accent-soft">
        <div className="p-4 sm:p-5 border-b border-accent-soft bg-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-accent" />
            <h2 className="font-extrabold text-base tracking-tight leading-tight">Live Activity Intelligence</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-black hover:text-black hover:bg-black/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                <div className="text-lg font-black text-primary">{stats.totalLogins}</div>
                <div className="text-[10px] text-primary mt-0.5">Logins Today</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
                <div className="text-lg font-black text-rose-600">{stats.totalLogouts}</div>
                <div className="text-[10px] text-rose-600/70 mt-0.5">Logouts Today</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <div className="text-lg font-black text-emerald-600">{stats.activeUsers}</div>
                <div className="text-[10px] text-emerald-600/70 mt-0.5">Active Users</div>
              </div>
            </div>
          )}

          {/* Activity Feed */}
          <div>
            <h3 className="font-black text-xs text-primary uppercase tracking-wider mb-2.5">User Activity Timeline</h3>
            <div className="space-y-2.5">
              {activities.length > 0 ? (
                activities.map((act, idx) => {
                  // Determine icon based on action
                  let Icon = Activity;
                  let colorClass = 'text-primary';
                  
                  if (act.action === 'USER_LOGIN') {
                    Icon = LogIn;
                    colorClass = 'text-emerald-600';
                  } else if (act.action === 'USER_LOGOUT') {
                    Icon = LogOut;
                    colorClass = 'text-rose-600';
                  } else if (act.action && act.action.includes('USER_ACTIVITY')) {
                    Icon = Activity;
                    colorClass = 'text-primary';
                  }

                  // Parse details if it's JSON
                  let details = act.details;
                  try {
                    if (typeof details === 'string') {
                      details = JSON.parse(details);
                    }
                  } catch (e) {
                    // Keep as string
                  }

                  return (
                    <div key={idx} className="p-3 rounded-xl border border-accent-soft bg-background space-y-1">
                      <div className="flex items-center justify-between font-bold text-primary">
                        <span className="flex items-center gap-1.5">
                          <Icon className={`w-4 h-4 ${colorClass}`} />
                          <span className="font-bold">{act.username || 'Unknown User'}</span>
                          <span className="text-primary">- {act.action}</span>
                        </span>
                        <span className="text-[10px] text-primary font-mono">
                          {act.created_at ? new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      {act.module && (
                        <p className="text-[10px] text-primary/60 font-medium">
                          Module: {act.module}
                        </p>
                      )}
                      {details && details.page && (
                        <p className="text-[10px] text-primary/60 font-medium">
                          Page: {details.page}
                        </p>
                      )}
                      {act.ip_address && (
                        <p className="text-[10px] text-primary/60 font-mono truncate max-w-full">
                          IP: {act.ip_address}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-[#6B5D50]">No recent user activity logged.</div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
