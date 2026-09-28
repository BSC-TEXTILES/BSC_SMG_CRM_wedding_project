import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { ContactMessage } from '../types';
import {
  Inbox,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Mail,
  Phone,
  Building,
  Calendar,
  MessageSquare,
  X,
  Save,
  Archive,
  Check
} from 'lucide-react';

export const AdminMessages: React.FC = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected message for detailed inspection & internal notes
  const [activeMessage, setActiveMessage] = useState<ContactMessage | null>(null);
  const [internalNotes, setInternalNotes] = useState('');

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await ProfileApi.getContactMessages({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() || undefined
      });
      setMessages(data || []);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load messages' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Inquiries & Contact Inbox — Admin';
    loadMessages();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadMessages();
  };

  const handleUpdateStatus = async (id: number, status: 'unread' | 'read' | 'contacted' | 'archived') => {
    try {
      await ProfileApi.updateContactMessage(id, { status });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status } : m));
      if (activeMessage && activeMessage.id === id) {
        setActiveMessage({ ...activeMessage, status });
      }
      setStatusMsg({ type: 'success', text: `Message marked as ${status}.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update message' });
    }
  };

  const handleSaveNotes = async () => {
    if (!activeMessage) return;
    try {
      const updated = await ProfileApi.updateContactMessage(activeMessage.id, { internal_notes: internalNotes });
      setMessages(prev => prev.map(m => m.id === activeMessage.id ? { ...m, internal_notes: internalNotes } : m));
      setActiveMessage({ ...activeMessage, internal_notes: internalNotes });
      setStatusMsg({ type: 'success', text: 'Internal staff notes saved.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save notes' });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Permanently delete inquiry from "${name}"?`)) return;
    try {
      await ProfileApi.deleteContactMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      if (activeMessage?.id === id) setActiveMessage(null);
      setStatusMsg({ type: 'success', text: `Deleted message from "${name}".` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete message' });
    }
  };

  return (
    <AdminLayout
      title="Contact Messages & Inquiries"
      subtitle="Review incoming consultation requests, bridal bookings, and client messages"
    >
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="pf-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status filters */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {(['all', 'unread', 'read', 'contacted', 'archived'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                statusFilter === tab
                  ? 'bg-[var(--pf-burgundy)] text-white shadow-xs'
                  : 'border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] text-[var(--pf-text-muted)] hover:text-[var(--pf-text-main)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pf-text-subtle)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sender, email, subject..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] text-xs text-[var(--pf-text-main)] focus:outline-none focus:border-[var(--pf-gold)]"
          />
        </form>
      </div>

      {/* Inbox List & Detail Viewer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Messages List Column */}
        <div className={`space-y-3 ${activeMessage ? 'lg:col-span-6' : 'lg:col-span-12'}`}>
          {loading ? (
            <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">
              Loading inquiries...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-20 text-center pf-card p-12 text-xs text-[var(--pf-text-muted)]">
              No messages found in this view.
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => {
                  setActiveMessage(msg);
                  setInternalNotes(msg.internal_notes || '');
                  if (msg.status === 'unread') handleUpdateStatus(msg.id, 'read');
                }}
                className={`pf-card p-4 cursor-pointer transition-all space-y-2 hover:border-[var(--pf-gold-border)] ${
                  activeMessage?.id === msg.id ? 'border-2 border-[var(--pf-burgundy)] shadow-md' : ''
                } ${msg.status === 'unread' ? 'bg-[var(--pf-bg-alt)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-sm text-[var(--pf-text-main)]">{msg.name}</span>
                      {msg.status === 'unread' && (
                        <span className="w-2 h-2 rounded-full bg-[var(--pf-burgundy)] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-[var(--pf-gold)]">{msg.subject}</p>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border text-[var(--pf-text-subtle)] shrink-0">
                    {msg.status}
                  </span>
                </div>

                <p className="text-xs text-[var(--pf-text-muted)] line-clamp-2 leading-relaxed">
                  {msg.message}
                </p>

                <div className="flex items-center justify-between text-[11px] text-[var(--pf-text-subtle)] pt-2 border-t border-[var(--pf-border-soft)]">
                  <span>✉️ {msg.email} {msg.phone ? `· 📞 ${msg.phone}` : ''}</span>
                  <span className="font-mono">{new Date(msg.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {activeMessage && (
          <div className="lg:col-span-6 pf-card p-6 space-y-6 self-start sticky top-20">
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--pf-gold)] font-bold">
                  Inquiry Detail #{activeMessage.id}
                </span>
                <h3 className="font-serif font-bold text-lg text-[var(--pf-text-main)]">
                  {activeMessage.subject}
                </h3>
              </div>
              <button onClick={() => setActiveMessage(null)} className="p-1 rounded text-[var(--pf-text-muted)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sender Metadata */}
            <div className="grid grid-cols-2 gap-3 bg-[var(--pf-bg-alt)] p-4 rounded-xl text-xs border border-[var(--pf-border-soft)]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)] block">Sender</span>
                <span className="font-bold text-[var(--pf-text-main)]">{activeMessage.name}</span>
                {activeMessage.company && <span className="text-[10px] text-[var(--pf-text-muted)] block">{activeMessage.company}</span>}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)] block">Date & IP</span>
                <span className="font-mono">{new Date(activeMessage.created_at).toLocaleString()}</span>
                <span className="text-[10px] text-[var(--pf-text-subtle)] block font-mono">IP: {activeMessage.ip_address || '127.0.0.1'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)] block">Email</span>
                <a href={`mailto:${activeMessage.email}`} className="text-[var(--pf-burgundy)] font-medium hover:underline">
                  {activeMessage.email}
                </a>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)] block">Telephone</span>
                {activeMessage.phone ? (
                  <a href={`tel:${activeMessage.phone}`} className="font-mono font-bold hover:underline">
                    {activeMessage.phone}
                  </a>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>

            {/* Message Body */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--pf-gold)]">Inquiry Message</span>
              <div className="p-4 rounded-xl bg-[var(--pf-bg-alt)] border border-[var(--pf-border-soft)] text-xs sm:text-sm text-[var(--pf-text-main)] leading-relaxed whitespace-pre-line">
                {activeMessage.message}
              </div>
            </div>

            {/* Internal Staff Notes */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-[var(--pf-text-main)]">Internal Staff & Consultant Notes</span>
              <textarea
                rows={3}
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                placeholder="Add private staff comments, stylist assignment, or call outcome..."
                className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs"
              />
              <div className="flex justify-end">
                <button onClick={handleSaveNotes} className="pf-btn-secondary text-xs py-1.5 px-3">
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Notes</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-[var(--pf-border)] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleUpdateStatus(activeMessage.id, 'contacted')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-200"
                >
                  Mark Contacted
                </button>
                <button
                  onClick={() => handleUpdateStatus(activeMessage.id, 'archived')}
                  className="px-3 py-1.5 rounded-lg border border-[var(--pf-border)] text-xs font-semibold hover:bg-[var(--pf-bg-alt)]"
                >
                  Archive
                </button>
              </div>

              <button
                onClick={() => handleDelete(activeMessage.id, activeMessage.name)}
                className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                title="Delete message"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMessages;
