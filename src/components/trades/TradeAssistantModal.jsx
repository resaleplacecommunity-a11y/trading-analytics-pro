import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Plus, Loader2, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TradeAssistantModal({ isOpen, onClose, onAddManually }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey bro! Send me the trade details or screenshots where I can see all the info — I'll add the trade for you."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  useEffect(() => {
    if (!isOpen) return;

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
        toast.info('Uploading images...');
        await handleFileUpload(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleFileUpload = async (files) => {
    const fileArray = Array.from(files);
    const uploadPromises = fileArray.map(async (file) => {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return file_url;
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
        return null;
      }
    });
    
    const urls = await Promise.all(uploadPromises);
    const validUrls = urls.filter(Boolean);
    setUploadedFiles(prev => [...prev, ...validUrls]);
  };

  const handleSend = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;

    const userMessage = {
      role: 'user',
      content: input,
      files: uploadedFiles
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setUploadedFiles([]);
    setIsLoading(true);

    try {
      // TODO: Implement AI processing to extract trade data
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract trade information from the following message and screenshots:\n${input}\n\nScreenshots: ${uploadedFiles.join(', ')}`,
        file_urls: uploadedFiles.length > 0 ? uploadedFiles : undefined,
        response_json_schema: {
          type: "object",
          properties: {
            coin: { type: "string" },
            direction: { type: "string", enum: ["Long", "Short"] },
            entry_price: { type: "number" },
            position_size: { type: "number" },
            stop_price: { type: "number" },
            take_price: { type: "number" },
            confidence: { type: "number" },
            strategy_tag: { type: "string" },
            entry_reason: { type: "string" }
          }
        }
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Got it! I found:\n\nCoin: ${response.coin}\nDirection: ${response.direction}\nEntry: $${response.entry_price}\nSize: $${response.position_size}\n\nShould I add this trade?`,
        tradeData: response
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I couldn't extract the trade info. Can you send more details or use manual entry?"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[600px] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#2a2a2a] p-0 flex flex-col [&>button]:text-white [&>button]:hover:text-white">
        <DialogHeader className="px-6 py-4 border-b border-[#2a2a2a]">
          <DialogTitle className="text-[#c0c0c0] flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            AI Trade Assistant
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn(
              "flex gap-3",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c0c0c0] to-[#888] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-[#111]" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-xl px-4 py-3",
                msg.role === 'user' 
                  ? "bg-[#c0c0c0] text-[#111]" 
                  : "bg-[#252525] text-[#c0c0c0]"
              )}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.files && msg.files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.files.map((url, i) => (
                      <img key={i} src={url} alt="Upload" className="max-w-full rounded" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c0c0c0] to-[#888] flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-[#111] animate-spin" />
              </div>
              <div className="bg-[#252525] rounded-xl px-4 py-3">
                <p className="text-sm text-[#888]">Analyzing...</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#2a2a2a] space-y-3">
          <Button
            onClick={onAddManually}
            variant="outline"
            className="w-full bg-white hover:bg-gray-100 text-black border-0 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add trade manually
          </Button>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Describe your trade or paste details..."
              className="flex-1 bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
            />
            <Button
              onClick={() => document.getElementById('ai-file-upload').click()}
              variant="ghost"
              size="icon"
              className="shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
              className="shrink-0 bg-[#c0c0c0] hover:bg-[#888] text-[#111]"
            >
              <Send className="w-4 h-4" />
            </Button>
            <input
              id="ai-file-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
          </div>

          {uploadedFiles.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {uploadedFiles.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded overflow-hidden">
                  <img src={url} alt="Upload" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}