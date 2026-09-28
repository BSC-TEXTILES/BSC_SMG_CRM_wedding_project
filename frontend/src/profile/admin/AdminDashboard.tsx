import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { DashboardStats } from '../types';
import { FolderGit2, Layers, MessageSquareQuote, Inbox, Plus, AlertCircle } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Admin Dashboard — BSC Textiles';

    async function loadStats() {
      try {
        const data = await ProfileApi.getAdminStats();
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard metrics');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await ProfileApi.updateContactMessage(id, { status: 'read' });
      // Update local stats
      if (stats) {
        setStats({
          ...stats,
          unread_messages: Math.max(0, stats.unread_messages - 1),
          recent_messages: stats.recent_messages.map(m => m.id === id ? { ...m, status: 'read' } : m)
        });
      }
    } catch (err: any) {
      alert(`Error updating message: ${err.message}`);
    }
  };

  return (
    <AdminLayout
      title="Website Administration"
      subtitle="Overview of published content, visitor inquiries, and site health"
      actions={
        <div className="flex items-center gap-2">
          <Link to="/admin/projects" className="pf-btn-primary text-xs py-1.5 px-3">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Project</span>
          </Link>
        </div>
      }
    >
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">
          Calculating profile metrics and content counters...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Projects */}
            <div className="pf-card p-5 space-y-2 border-l-4 border-l-[var(--pf-burgundy)]">
              <div className="flex items-center justify-between text-[var(--pf-text-muted)]">
                <span className="text-xs font-semibold">Portfolio Projects</span>
                <FolderGit2 className="w-4 h-4 text-[var(--pf-burgundy)]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-[var(--pf-text-main)]">
                  {stats?.total_projects || 0}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {stats?.published_projects || 0} Published
                </span>
              </div>
              <div className="pt-2 text-[11px] text-[var(--pf-text-subtle)] flex items-center justify-between">
                <span>Drafts: {stats?.draft_projects || 0}</span>
                <Link to="/admin/projects" className="text-[var(--pf-gold)] hover:underline font-bold">Manage →</Link>
              </div>
            </div>

            {/* Services */}
            <div className="pf-card p-5 space-y-2 border-l-4 border-l-[var(--pf-gold)]">
              <div className="flex items-center justify-between text-[var(--pf-text-muted)]">
                <span className="text-xs font-semibold">Services & Suites</span>
                <Layers className="w-4 h-4 text-[var(--pf-gold)]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-[var(--pf-text-main)]">
                  {stats?.total_services || 0}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {stats?.published_services || 0} Active
                </span>
              </div>
              <div className="pt-2 text-[11px] text-[var(--pf-text-subtle)] flex items-center justify-between">
                <span>Bookings enabled</span>
                <Link to="/admin/services" className="text-[var(--pf-gold)] hover:underline font-bold">Manage →</Link>
              </div>
            </div>

            {/* Testimonials */}
            <div className="pf-card p-5 space-y-2 border-l-4 border-l-amber-600">
              <div className="flex items-center justify-between text-[var(--pf-text-muted)]">
                <span className="text-xs font-semibold">Testimonials</span>
                <MessageSquareQuote className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-[var(--pf-text-main)]">
                  {stats?.total_testimonials || 0}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">
                  Verified Families
                </span>
              </div>
              <div className="pt-2 text-[11px] text-[var(--pf-text-subtle)] flex items-center justify-between">
                <span>100% 5-Star CSAT</span>
                <Link to="/admin/testimonials" className="text-[var(--pf-gold)] hover:underline font-bold">Manage →</Link>
              </div>
            </div>

            {/* Inquiries */}
            <div className="pf-card p-5 space-y-2 border-l-4 border-l-emerald-600">
              <div className="flex items-center justify-between text-[var(--pf-text-muted)]">
                <span className="text-xs font-semibold">Contact Messages</span>
                <Inbox className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-[var(--pf-text-main)]">
                  {stats?.total_messages || 0}
                </span>
                {stats?.unread_messages ? (
                  <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                    {stats.unread_messages} New
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-600 font-bold">All Read</span>
                )}
              </div>
              <div className="pt-2 text-[11px] text-[var(--pf-text-subtle)] flex items-center justify-between">
                <span>Inquiries & bookings</span>
                <Link to="/admin/messages" className="text-[var(--pf-gold)] hover:underline font-bold">View Inbox →</Link>
              </div>
            </div>
          </div>

          {/* Quick Actions Strip */}
          <div className="pf-card p-5 space-y-3">
            <h3 className="font-serif font-bold text-sm text-[var(--pf-text-main)]">Quick Content Management</h3>
            <div className="flex flex-wrap gap-2.5">
              <Link to="/admin/profile" className="pf-btn-secondary text-xs py-2 px-3.5">
                Edit Main Profile
              </Link>
              <Link to="/admin/projects" className="pf-btn-secondary text-xs py-2 px-3.5">
                + New Portfolio Item
              </Link>
              <Link to="/admin/services" className="pf-btn-secondary text-xs py-2 px-3.5">
                + Add Service / Suite
              </Link>
              <Link to="/admin/skills" className="pf-btn-secondary text-xs py-2 px-3.5">
                + Add Discipline / Skill
              </Link>
              <Link to="/admin/gallery" className="pf-btn-secondary text-xs py-2 px-3.5">
                Upload Gallery Media
              </Link>
              <Link to="/admin/settings" className="pf-btn-secondary text-xs py-2 px-3.5">
                SEO & Meta Tags
              </Link>
            </div>
          </div>

          {/* Two-Column: Recent Inquiries & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Recent Contact Submissions */}
            <div className="lg:col-span-7 pf-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
                <div>
                  <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">
                    Recent Contact Inquiries
                  </h3>
                  <p className="text-[11px] text-[var(--pf-text-muted)]">
                    Latest submissions from the public website contact form
                  </p>
                </div>
                <Link to="/admin/messages" className="text-xs font-bold text-[var(--pf-burgundy)] hover:underline">
                  View All ({stats?.total_messages || 0})
                </Link>
              </div>

              {(!stats?.recent_messages || stats.recent_messages.length === 0) ? (
                <div className="py-8 text-center text-xs text-[var(--pf-text-muted)]">
                  No inquiries received yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recent_messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-xl border transition-all space-y-1.5 ${
                        msg.status === 'unread'
                          ? 'bg-[var(--pf-bg-alt)] border-[var(--pf-gold-border)] shadow-xs'
                          : 'bg-[var(--pf-bg-card)] border-[var(--pf-border)] opacity-85'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[var(--pf-text-main)]">{msg.name}</span>
                            {msg.company && (
                              <span className="text-[10px] text-[var(--pf-text-subtle)]">({msg.company})</span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--pf-gold)] font-medium">{msg.subject}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {msg.status === 'unread' ? (
                            <button
                              onClick={() => handleMarkRead(msg.id)}
                              className="text-[10px] font-bold text-[var(--pf-burgundy)] bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-[var(--pf-border)] hover:bg-[var(--pf-bg-alt)]"
                            >
                              Mark Read
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-bold uppercase">Read</span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-[var(--pf-text-muted)] line-clamp-2 leading-relaxed">
                        {msg.message}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-[var(--pf-text-subtle)] pt-1 border-t border-[var(--pf-border-soft)]">
                        <span>📞 {msg.phone || 'No phone'} · ✉️ {msg.email}</span>
                        <span>{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit Logs Stream */}
            <div className="lg:col-span-5 pf-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
                <div>
                  <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">
                    Audit Activity Log
                  </h3>
                  <p className="text-[11px] text-[var(--pf-text-muted)]">
                    Recent admin creations, edits, and deletions
                  </p>
                </div>
                <Link to="/admin/audit-logs" className="text-xs font-bold text-[var(--pf-burgundy)] hover:underline">
                  Full Log →
                </Link>
              </div>

              {(!stats?.recent_activity || stats.recent_activity.length === 0) ? (
                <div className="py-8 text-center text-xs text-[var(--pf-text-muted)]">
                  No activity recorded yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {stats.recent_activity.map(act => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-lg bg-[var(--pf-bg-alt)] border border-[var(--pf-border-soft)] space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--pf-gold)]">
                          {act.action} · {act.module}
                        </span>
                        <span className="text-[10px] text-[var(--pf-text-subtle)] font-mono">
                          {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--pf-text-main)] font-medium">
                        {act.details}
                      </p>
                      <div className="text-[10px] text-[var(--pf-text-subtle)]">
                        By {act.username}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;
