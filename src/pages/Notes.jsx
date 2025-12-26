import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, BookOpen, Brain, TrendingUp, BarChart3, Plus, Upload, Link as LinkIcon } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const CATEGORIES = [
  { id: 'risk_management', label: 'Risk Management', icon: TrendingUp, color: 'emerald' },
  { id: 'psychology', label: 'Psychology', icon: Brain, color: 'cyan' },
  { id: 'chart_analysis', label: 'Chart Analysis', icon: BarChart3, color: 'violet' }
];

export default function NotesPage() {
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('risk_management');
  const [showAI, setShowAI] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState({ title: '', content: '', image_urls: '' });
  const [uploading, setUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: () => base44.entities.Note.list('-date', 100),
  });

  const createNoteMutation = useMutation({
    mutationFn: (data) => base44.entities.Note.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      setNoteForm({ title: '', content: '', image_urls: '' });
      setEditingNote(null);
      toast.success('Note saved');
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Note.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      setNoteForm({ title: '', content: '', image_urls: '' });
      setEditingNote(null);
      toast.success('Note updated');
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id) => base44.entities.Note.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      toast.success('Note deleted');
    },
  });

  const handleSaveNote = () => {
    if (!noteForm.title || !noteForm.content) {
      toast.error('Title and content are required');
      return;
    }

    const data = {
      ...noteForm,
      category: activeCategory,
      date: new Date().toISOString().split('T')[0]
    };

    if (editingNote) {
      updateNoteMutation.mutate({ id: editingNote.id, data });
    } else {
      createNoteMutation.mutate(data);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const existingUrls = noteForm.image_urls ? noteForm.image_urls.split(',') : [];
      setNoteForm({
        ...noteForm,
        image_urls: [...existingUrls, file_url].join(',')
      });
      toast.success('File uploaded');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAIAssist = async () => {
    if (!aiPrompt) return;
    
    setAiLoading(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a professional trading coach. Help with this question: ${aiPrompt}`,
        add_context_from_internet: false
      });
      setAiResponse(response);
    } catch (error) {
      toast.error('AI request failed');
    } finally {
      setAiLoading(false);
    }
  };

  const categoryNotes = notes.filter(n => n.category === activeCategory);
  const activeTab = CATEGORIES.find(c => c.id === activeCategory);

  if (showAI) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#c0c0c0]">AI Trading Assistant</h1>
              <p className="text-[#666] text-sm">Ask anything about trading</p>
            </div>
          </div>
          <Button
            onClick={() => setShowAI(false)}
            variant="outline"
            className="bg-[#111] border-[#2a2a2a] text-[#888]"
          >
            Back to Notes
          </Button>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
          <div className="space-y-4">
            <Input
              placeholder="Ask your question..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
              onKeyDown={(e) => e.key === 'Enter' && handleAIAssist()}
            />
            <Button
              onClick={handleAIAssist}
              disabled={aiLoading}
              className="w-full bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:from-violet-600 hover:to-violet-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {aiLoading ? 'Thinking...' : 'Ask AI'}
            </Button>
          </div>

          {aiResponse && (
            <div className="mt-6 p-6 bg-[#111]/50 rounded-xl border border-[#2a2a2a]">
              <div className="text-[#c0c0c0] whitespace-pre-wrap">{aiResponse}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#c0c0c0]">Learning Hub</h1>
            <p className="text-[#666] text-sm">Document your trading knowledge</p>
          </div>
        </div>
        <Button
          onClick={() => setShowAI(true)}
          className="bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:from-violet-600 hover:to-violet-700"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          AI Assistant
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-3 mb-6 overflow-x-auto">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl border-2 transition-all whitespace-nowrap",
                activeCategory === cat.id
                  ? `bg-${cat.color}-500/20 border-${cat.color}-500/50 text-${cat.color}-400`
                  : "bg-[#111] border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a]"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{cat.label}</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs",
                activeCategory === cat.id ? `bg-${cat.color}-500/30` : "bg-[#1a1a1a]"
              )}>
                {notes.filter(n => n.category === cat.id).length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
          <h3 className="text-lg font-bold text-[#c0c0c0] mb-4">
            {editingNote ? 'Edit Note' : 'New Note'}
          </h3>

          <Input
            placeholder="Note title..."
            value={noteForm.title}
            onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
            className="mb-4 bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
          />

          <ReactQuill
            theme="snow"
            value={noteForm.content}
            onChange={(content) => setNoteForm({ ...noteForm, content })}
            className="mb-4"
            style={{ minHeight: '300px' }}
          />

          <div className="flex gap-3">
            <Button
              onClick={() => document.getElementById('file-upload').click()}
              variant="outline"
              disabled={uploading}
              className="bg-[#111] border-[#2a2a2a] text-[#888]"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload Image'}
            </Button>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={handleSaveNote}
              className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {editingNote ? 'Update Note' : 'Save Note'}
            </Button>
          </div>

          {noteForm.image_urls && (
            <div className="mt-4 flex flex-wrap gap-2">
              {noteForm.image_urls.split(',').filter(Boolean).map((url, idx) => (
                <img key={idx} src={url} alt="" className="w-24 h-24 object-cover rounded-lg border border-[#2a2a2a]" />
              ))}
            </div>
          )}
        </div>

        {/* Notes List */}
        <div className="space-y-3">
          {categoryNotes.length === 0 ? (
            <div className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-6 text-center">
              <p className="text-[#666] text-sm">No notes yet in this category</p>
            </div>
          ) : (
            categoryNotes.map(note => (
              <div
                key={note.id}
                onClick={() => {
                  setEditingNote(note);
                  setNoteForm({
                    title: note.title,
                    content: note.content,
                    image_urls: note.image_urls || ''
                  });
                }}
                className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-4 cursor-pointer hover:border-[#3a3a3a] transition-all"
              >
                <h4 className="text-[#c0c0c0] font-medium mb-1">{note.title}</h4>
                <div 
                  className="text-[#666] text-xs line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[#666] text-xs">{new Date(note.date).toLocaleDateString()}</span>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNoteMutation.mutate(note.id);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}