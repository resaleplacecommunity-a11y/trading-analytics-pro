import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { Upload, Paperclip, ExternalLink, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function AttachmentsSection({ data, onChange }) {
  const [uploading, setUploading] = useState(false);
  const attachments = data?.attachments ? JSON.parse(data.attachments) : [];

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const newAttachments = [...attachments, { url: file_url, name: file.name, type: 'file' }];
      onChange({ attachments: JSON.stringify(newAttachments) });
      toast.success('File uploaded');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index) => {
    onChange({ attachments: JSON.stringify(attachments.filter((_, i) => i !== index)) });
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Paperclip className="w-5 h-5 text-pink-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">Attachments & Links</h3>
      </div>

      <div className="space-y-4">
        {/* TradingView Link */}
        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
            <ExternalLink className="w-3 h-3" />
            TradingView Chart
          </Label>
          <Input
            value={data?.tradingview_link || ''}
            onChange={(e) => onChange({ tradingview_link: e.target.value })}
            placeholder="https://tradingview.com/chart/..."
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
          />
        </div>

        {/* Extra Links */}
        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Extra Links</Label>
          <Input
            value={data?.extra_links || ''}
            onChange={(e) => onChange({ extra_links: e.target.value })}
            placeholder="Additional links (comma-separated)"
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
          />
        </div>

        {/* File Upload */}
        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Screenshots & Files</Label>
          <div className="flex gap-2">
            <label className="flex-1">
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
                disabled={uploading}
                asChild
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload File'}
                </span>
              </Button>
            </label>
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#111] rounded-lg border border-[#2a2a2a] p-3">
                  <ImageIcon className="w-4 h-4 text-[#666]" />
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#c0c0c0] text-sm hover:text-cyan-400 flex-1 truncate"
                  >
                    {att.name}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttachment(i)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}