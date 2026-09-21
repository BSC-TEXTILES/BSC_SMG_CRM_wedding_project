import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, RefreshCw, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { API } from '../../services/api';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'system';
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadChatHistory();
    }
  }, [isOpen]);

  const loadChatHistory = async () => {
    try {
      setIsInitialLoading(true);
      const res = await API.getChatMessages();
      if (res && res.messages && Array.isArray(res.messages)) {
        const mapped: ChatMessage[] = res.messages.map((m: any) => ({
          id: m.id,
          text: m.message_text,
          sender: m.sender,
          timestamp: m.created_at,
          status: 'sent' as const
        }));
        setMessages(mapped);
      }
    } catch (err) {
      // Silent fail — widget is non-critical
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userText = inputText.trim();
    const tempId = Date.now().toString();
    setInputText('');
    setIsLoading(true);
    setError(null);

    const optimisticUser: ChatMessage = {
      id: tempId,
      text: userText,
      sender: 'user',
      timestamp: new Date().toISOString(),
      status: 'sending'
    };
    setMessages(prev => [...prev, optimisticUser]);

    try {
      const res = await API.sendChatMessage(userText);
      if (res && res.success) {
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId);
          return [
            ...filtered,
            {
              id: res.userMessage.id,
              text: res.userMessage.message_text,
              sender: 'user' as const,
              timestamp: res.userMessage.created_at,
              status: 'sent' as const
            },
            {
              id: res.systemMessage.id,
              text: res.systemMessage.message_text,
              sender: 'system' as const,
              timestamp: res.systemMessage.created_at
            }
          ];
        });
      } else {
        throw new Error(res?.message || 'Failed to send message');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
      setMessages(prev => prev.map(msg =>
        msg.id === tempId ? { ...msg, status: 'error' as const } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    try {
      await API.clearChatMessages();
    } catch (err) {}
    setMessages([]);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 border-2 ${
          isOpen
            ? 'bg-slate-800 text-white border-slate-700 rotate-0'
            : 'bg-accent text-white border-accent/50 hover:scale-110 hover:shadow-accent/30'
        }`}
        title={isOpen ? 'Close Chat' : 'Open AI Chat Assistant'}
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 left-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-bold">AI Assistant</h3>
                <p className="text-[10px] text-slate-400">Powered by Gemini</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadChatHistory}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Clear Chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2 text-xs font-medium text-red-700 shrink-0">
              <span className="flex-1 truncate">{error}</span>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 bg-slate-50">
            {isInitialLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-300" />
                <p className="text-xs font-medium">Loading...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 px-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-accent" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-600">AI Chat Assistant</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Ask me anything about BSC Enterprise</p>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-slate-900 text-white rounded-br-sm'
                      : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200 shadow-xs'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <div className={`flex items-center gap-1 mt-1 text-[9px] font-medium ${
                      msg.sender === 'user' ? 'text-slate-400' : 'text-slate-400'
                    }`}>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.sender === 'user' && msg.status === 'sending' && (
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      )}
                      {msg.sender === 'user' && msg.status === 'error' && (
                        <span className="text-red-400">Failed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={isLoading}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-accent focus:border-accent transition-all disabled:opacity-50"
                autoFocus
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="shrink-0 w-9 h-9 rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[9px] text-slate-400 text-center mt-1.5">Press Enter to send</p>
          </form>
        </div>
      )}
    </>
  );
}
