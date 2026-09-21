import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Send, User, Check, CheckCheck, Shield } from 'lucide-react';
import { NotificationService, DirectMessage } from '../../services/notificationService';
import { UserSession } from '../../services/api';
import { showToast } from '../Toast';

interface DirectMessagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession | null;
}

export default function DirectMessagingModal({ isOpen, onClose, session }: DirectMessagingModalProps) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [recipient, setRecipient] = useState('All HR Staff');
  const [text, setText] = useState('');

  useEffect(() => {
    const unsub = NotificationService.subscribeDMs((list) => {
      setMessages(list);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    NotificationService.sendDirectMessage(
      recipient.toLowerCase().replace(/\s+/g, '_'),
      recipient,
      text,
      session?.username || 'user',
      session?.fullName || 'User'
    );

    setText('');
    showToast(`Direct message sent to ${recipient}!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-accent-soft flex flex-col h-[520px] animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-accent-soft bg-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-accent" />
            <div>
              <h3 className="font-extrabold text-sm tracking-tight text-white">Direct Text Messaging</h3>
              <p className="text-[10px] text-white/80">Secure text-only staff communication</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recipient Selector */}
        <div className="p-3 bg-background border-b border-accent-soft flex items-center gap-2 text-xs">
          <span className="font-extrabold text-primary">Send To:</span>
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="flex-1 p-1.5 rounded-xl border border-accent-soft bg-white font-bold text-primary"
          >
            <option value="All HR Staff">All HR Staff</option>
            <option value="Store Managers">Store Managers</option>
            <option value="Interviewers">Interview Panel</option>
            <option value="Recruitment Team">Recruitment Team</option>
            <option value="System Administrators">System Administrators</option>
          </select>
        </div>

        {/* Thread History */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-background/50 text-xs">
          {messages.length > 0 ? (
            messages.map((m) => {
              const isMe = m.senderUsername === (session?.username || 'user');
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="text-[10px] text-primary font-semibold mb-0.5">
                    {m.senderName} · <span className="font-mono">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div
                    className={`
                      p-3 rounded-2xl max-w-[80%] font-medium shadow-xs leading-relaxed
                      ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white border border-accent-soft text-primary rounded-tl-none'}
                    `}
                  >
                    {m.text}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-[#687080] mt-0.5 font-mono">
                    <span>Delivered</span>
                    <CheckCheck className="w-3 h-3 text-emerald-600" />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 text-[#6B5D50]">
              No previous messages in thread. Send a text message to start conversation.
            </div>
          )}
        </div>

        {/* Messaging Input */}
        <form onSubmit={handleSend} className="p-3 border-t border-accent-soft bg-white flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type direct text message... (messaging only)"
            className="flex-1 input-modern text-xs"
          />
          <button type="submit" className="btn-gold p-2.5 rounded-xl shadow-md">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
