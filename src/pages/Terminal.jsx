import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, TrendingUp, TrendingDown, Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import { cn } from "@/lib/utils";

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];

function TradingViewWidget({ symbol }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BYBIT:${symbol}.P`,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'ru',
      backgroundColor: '#0a0a0a',
      gridColor: '#1a1a1a',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });

    const container = document.createElement('div');
    container.className = 'tradingview-widget-container__widget';
    container.style.height = '100%';
    container.style.width = '100%';
    containerRef.current.appendChild(container);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [symbol]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: '100%', width: '100%' }}
    />
  );
}

export default function Terminal() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Привет! Я AI-советник по торговле. Выбери монету и спроси меня о текущей ситуации на рынке, уровнях входа, стоп-лоссах или стратегии.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg) return;

    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Ты профессиональный трейдер-аналитик криптовалютного рынка. Текущая монета в фокусе: ${symbol}.
      
Вопрос трейдера: ${userMsg}

Отвечай кратко и по делу (3-5 предложений). Используй технический анализ. Указывай конкретные уровни, если уместно. Всегда добавляй предупреждение о рисках в одно предложение в конце.`,
      add_context_from_internet: true,
    });

    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  const quickPrompts = [
    `Анализ ${symbol} сейчас`,
    `Хорошее ли время для входа в лонг по ${symbol}?`,
    `Ключевые уровни поддержки и сопротивления ${symbol}`,
    `Какой стоп-лосс поставить на ${symbol}?`,
  ];

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#c0c0c0]">Терминал</h1>
            <p className="text-[#666] text-xs">График + AI-советник</p>
          </div>
        </div>

        {/* Symbol Picker */}
        <div className="relative">
          <button
            onClick={() => setShowSymbolPicker(!showSymbolPicker)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-[#c0c0c0] font-mono font-bold hover:border-emerald-500/40 transition-colors"
          >
            {symbol}
            <ChevronDown className={cn("w-4 h-4 text-[#666] transition-transform", showSymbolPicker && "rotate-180")} />
          </button>
          {showSymbolPicker && (
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-xl z-50 overflow-hidden">
              {SYMBOLS.map(s => (
                <button
                  key={s}
                  onClick={() => { setSymbol(s); setShowSymbolPicker(false); }}
                  className={cn(
                    "w-full px-5 py-2.5 text-left font-mono text-sm transition-colors",
                    s === symbol
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-[#c0c0c0] hover:bg-[#2a2a2a]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Chart */}
        <div className="flex-1 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden min-h-0">
          <TradingViewWidget symbol={symbol} />
        </div>

        {/* AI Bot Panel */}
        <div className="w-[340px] flex-shrink-0 flex flex-col bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          {/* Bot Header */}
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#c0c0c0]">AI-советник</p>
              <p className="text-[10px] text-[#555]">Анализ рынка • {symbol}</p>
            </div>
            <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                    msg.role === 'user'
                      ? "bg-emerald-500/20 text-emerald-100 border border-emerald-500/20"
                      : "bg-[#151515] text-[#c0c0c0] border border-[#2a2a2a]"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl px-3 py-2">
                  <Loader2 className="w-3 h-3 text-[#666] animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 border-t border-[#1a1a1a] flex flex-col gap-1.5 flex-shrink-0">
            <p className="text-[9px] text-[#555] uppercase tracking-wider mb-0.5">Быстрые вопросы</p>
            <div className="grid grid-cols-2 gap-1">
              {quickPrompts.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="text-[9px] text-[#888] bg-[#151515] border border-[#2a2a2a] rounded-lg px-2 py-1.5 hover:border-emerald-500/30 hover:text-emerald-400 transition-all text-left leading-tight disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="flex gap-2 items-center">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
                placeholder="Спроси AI-советника..."
                disabled={loading}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] text-xs h-9 placeholder:text-[#444] focus:border-emerald-500/40"
              />
              <Button
                size="sm"
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="h-9 w-9 p-0 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}