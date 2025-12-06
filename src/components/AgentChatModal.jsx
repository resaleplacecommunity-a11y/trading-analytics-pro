import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from "@/lib/utils";

export default function AgentChatModal({ onClose, onTradeCreated }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: 'trading_assistant',
        metadata: { name: 'Trade Analysis Chat', source: 'dashboard' }
      });
      setConversation(conv);
      setMessages(conv.messages || []);

      // Subscribe to updates
      const unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages);
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
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: userMessage
      });
    } catch (err) {
      console.error('Failed to send:', err);
    }
    
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
        content: 'Вот скриншот сделки. Извлеки данные и добавь сделку.',
        file_urls: [file_url]
      });
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-3xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <div>
            <h3 className="text-[#c0c0c0] font-semibold">Торговый Ассистент</h3>
            <p className="text-[#666] text-xs">AI агент для анализа и добавления сделок</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-[#252525] rounded-2xl px-4 py-2">
                <Loader2 className="w-4 h-4 text-[#888] animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#2a2a2a]">
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading || !conversation}
              />
              <div className={cn(
                "p-3 rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors",
                (uploading || !conversation) && "opacity-50 cursor-not-allowed"
              )}>
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-[#888] animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5 text-[#888]" />
                )}
              </div>
            </label>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Напишите сообщение..."
              disabled={!conversation || sending}
              className="flex-1 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
            />
            <Button
              onClick={handleSend}
              disabled={!conversation || sending || !input.trim()}
              className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <span className="text-amber-400 text-xs">AI</span>
        </div>
      )}
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-2",
        isUser ? "bg-[#c0c0c0] text-black" : "bg-[#252525] text-[#c0c0c0]"
      )}>
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none">
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}