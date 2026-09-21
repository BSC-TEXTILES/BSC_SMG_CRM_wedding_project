import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, MessageSquare, Send, X, RefreshCw, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API } from '../services/api';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'system';
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

const ChatDashboard = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, []);

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
      console.error('Failed to load chat history:', err);
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

    // Add user message optimistically
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
        // Replace optimistic message with real one, add system response
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
      console.error('Chat error:', err);
      setError(err.message || 'Failed to send message. Please try again.');
      setMessages(prev => prev.map(msg =>
        msg.id === tempId ? { ...msg, status: 'error' as const } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      try {
        await API.clearChatMessages();
      } catch (err) {
        // Ignore errors — clear locally regardless
      }
      setMessages([]);
      setError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-gray-50 p-4 lg:p-6 overflow-hidden">
      {/* Header */}
      <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 mb-6">
        <div>
          <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-accent" />
            <span>Chat Dashboard</span>
          </h2>
          <p className="text-xs text-primary font-medium mt-0.5">
            Real-time chat with system assistant
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadChatHistory}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link to="/dashboard" className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Link>
          <button
            onClick={handleClearChat}
            className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg shadow-sm hover:bg-red-100 text-sm font-bold transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden min-h-0 relative">
        {error && (
          <div className="absolute top-0 left-0 right-0 z-10 p-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-sm font-medium text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Chat History */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 ${error ? 'pt-16' : ''}`}>
          {isInitialLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-500" />
              <p className="text-sm font-medium">Loading chat history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-slate-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">No messages yet. Start a conversation!</p>
                <p className="text-xs text-slate-500">Type a message below to get started.</p>
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white rounded-tr-sm'
                    : 'bg-slate-100 text-slate-800 rounded-tl-sm border border-slate-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                  <div className={`flex items-center gap-1.5 mt-2 text-[10px] font-medium ${
                    msg.sender === 'user' ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.sender === 'user' && msg.status === 'sending' && (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    )}
                    {msg.sender === 'user' && msg.status === 'error' && (
                      <AlertCircle className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <form onSubmit={handleSendMessage} className="relative flex items-end gap-2 max-w-4xl mx-auto">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={isLoading}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-accent focus:border-accent block px-4 py-3.5 pr-12 transition-all disabled:opacity-60"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="shrink-0 p-3.5 rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
          <div className="mt-2 text-center">
            <span className="text-[10px] font-medium text-slate-500">Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatDashboard;
