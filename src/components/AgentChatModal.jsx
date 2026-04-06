import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Send, Loader2, Paperclip, Plus, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from "@/lib/utils";

export default function AgentChatModal({ onClose, onTradeCreated, onAddManually }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pastedImages, setPastedImages] = useState([]);
  const [focused, setFocused] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        setPastedImages(prev => [...prev, ...imageFiles]);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const initConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: 'trading_assistant',
        metadata: { name: 'Trade Analysis Chat', source: 'dashboard' }
      });
      setConversation(conv);
      const initialMessages = conv.messages || [];
      if (initialMessages.length === 0) {
        initialMessages.push({
          role: 'assistant',
          content: 'Hey bro! Send me the trade details or screenshots where I can see all the info — I\'ll add the trade for you.'
        });
      }
      setMessages(initialMessages);
      const unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages);
        const hasTradeCreated = data.messages.some(msg =>
          msg?.role === 'assistant' && msg?.tool_calls?.some(
            tc => tc.name === 'entities.Trade.create' && tc.status === 'completed'
          )
        );
        if (hasTradeCreated && onTradeCreated) setTimeout(() => onTradeCreated(), 500);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error('Failed to init conversation:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !conversation || sending) return;
    const userMessage = input;
    setInput('');
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: userMessage });
    } catch (err) { console.error('Failed to send:', err); }
    setSending(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !conversation) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: 'Here\'s a trade screenshot. Extract data and add the trade.',
        file_urls: [file_url]
      });
    } catch (err) { console.error('Upload failed:', err); }
    setUploading(false);
  };

  const handleSendPastedImages = async () => {
    if (pastedImages.length === 0 || !conversation) return;
    setUploading(true);
    try {
      const results = await Promise.all(pastedImages.map(file => base44.integrations.Core.UploadFile({ file })));
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: `Here are ${pastedImages.length} trade screenshot(s). Extract all data and create the trade.`,
        file_urls: results.map(r => r.file_url)
      });
      setPastedImages([]);
    } catch (err) { console.error('Upload failed:', err); }
    setUploading(false);
  };

  const removePastedImage = (index) => setPastedImages(prev => prev.filter((_, i) => i !== index));

  const canSend = conversation && !sending && input.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-2xl flex flex-col"
        style={{
          height: 'min(82vh, 720px)',
          background: 'rgba(7,7,7,0.96)',
          border: '1px solid rgba(16,185,129,0.18)',
          borderRadius: 20,
          boxShadow: '0 0 0 1px rgba(16,185,129,0.04), 0 40px 80px rgba(0,0,0,0.85), 0 0 100px rgba(16,185,129,0.07)',
          backdropFilter: 'blur(40px)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(16,185,129,0.10)',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, transparent 60%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* AI icon */}
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(16,185,129,0.45), inset 0 1px 0 rgba(255,255,255,0.2)',
              flexShrink: 0,
            }}>
              <Zap style={{ width: 16, height: 16, color: 'white' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  fontSize: 14, fontWeight: 700, letterSpacing: '0.01em',
                  background: 'linear-gradient(90deg, #e2e8f0 0%, #10b981 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  AI Trade Assistant
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#10b981',
                    boxShadow: '0 0 6px #10b981',
                    animation: 'pulse 2s infinite',
                  }} />
                  <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600, letterSpacing: '0.05em' }}>LIVE</span>
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                Send screenshots or trade details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s',
              color: 'rgba(255,255,255,0.5)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* ── Messages ── */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: '20px 18px',
            display: 'flex', flexDirection: 'column', gap: 16,
            backgroundImage: 'linear-gradient(rgba(16,185,129,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.025) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        >
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {sending && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ── */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid rgba(16,185,129,0.10)',
          background: 'rgba(0,0,0,0.4)',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Add manually */}
          {onAddManually && (
            <button
              onClick={onAddManually}
              style={{
                width: '100%', height: 40, borderRadius: 10,
                border: '1px solid rgba(16,185,129,0.25)',
                background: 'rgba(16,185,129,0.06)',
                color: '#10b981', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.06)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.25)'; }}
            >
              <Plus style={{ width: 15, height: 15 }} />
              Add trade manually
            </button>
          )}

          {/* Pasted images */}
          {pastedImages.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {pastedImages.map((file, i) => (
                <div key={i} style={{ position: 'relative' }} className="group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(16,185,129,0.25)' }}
                  />
                  <button
                    onClick={() => removePastedImage(i)}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#ef4444', color: 'white', fontSize: 11,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', cursor: 'pointer',
                    }}
                  >×</button>
                </div>
              ))}
              <button
                onClick={handleSendPastedImages}
                disabled={uploading}
                style={{
                  height: 32, padding: '0 12px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white', fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 0 12px rgba(16,185,129,0.3)',
                }}
              >
                {uploading
                  ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
                  : `Send ${pastedImages.length} photo${pastedImages.length > 1 ? 's' : ''}`
                }
              </button>
            </div>
          )}

          {/* Input row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Attach */}
            <label style={{ cursor: (uploading || !conversation) ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading || !conversation} />
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: (uploading || !conversation) ? 0.4 : 1,
                transition: 'all 0.15s',
              }}>
                {uploading
                  ? <Loader2 style={{ width: 15, height: 15, color: '#10b981' }} className="animate-spin" />
                  : <Paperclip style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.45)' }} />
                }
              </div>
            </label>

            {/* Text input */}
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Describe your trade or paste details..."
                disabled={!conversation || sending}
                style={{
                  width: '100%', height: 40, padding: '0 14px',
                  borderRadius: 10,
                  border: focused
                    ? '1px solid rgba(16,185,129,0.5)'
                    : '1px solid rgba(255,255,255,0.08)',
                  background: focused
                    ? 'rgba(16,185,129,0.04)'
                    : 'rgba(255,255,255,0.04)',
                  boxShadow: focused ? '0 0 0 3px rgba(16,185,129,0.08)' : 'none',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 13,
                  outline: 'none',
                  transition: 'all 0.15s',
                }}
              />
            </div>

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                border: 'none', cursor: canSend ? 'pointer' : 'not-allowed',
                background: canSend
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: canSend ? '0 0 16px rgba(16,185,129,0.4)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Send style={{ width: 15, height: 15, color: canSend ? 'white' : 'rgba(255,255,255,0.25)' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 10px rgba(16,185,129,0.35)',
          marginTop: 2,
        }}>
          <span style={{ color: 'white', fontSize: 9, fontWeight: 800, letterSpacing: '0.05em' }}>AI</span>
        </div>
      )}
      <div style={{
        maxWidth: '78%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        fontSize: 13,
        lineHeight: 1.55,
        ...(isUser ? {
          background: 'linear-gradient(135deg, rgba(16,185,129,0.75), rgba(5,150,105,0.85))',
          color: 'white',
          boxShadow: '0 2px 12px rgba(16,185,129,0.2)',
        } : {
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderLeft: '2px solid rgba(16,185,129,0.45)',
          color: 'rgba(255,255,255,0.82)',
        }),
      }}>
        {isUser
          ? <span>{message.content}</span>
          : <ReactMarkdown className="prose prose-sm prose-invert max-w-none" style={{ margin: 0 }}>
              {message.content}
            </ReactMarkdown>
        }
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: 'linear-gradient(135deg, #10b981, #059669)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 10px rgba(16,185,129,0.35)',
      }}>
        <span style={{ color: 'white', fontSize: 9, fontWeight: 800 }}>AI</span>
      </div>
      <div style={{
        padding: '10px 14px', borderRadius: '4px 16px 16px 16px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: '2px solid rgba(16,185,129,0.45)',
        display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: '#10b981',
            display: 'inline-block',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
