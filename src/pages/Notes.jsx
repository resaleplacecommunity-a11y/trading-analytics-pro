import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, BookOpen, Brain, TrendingUp, BarChart3, Plus, Upload, X, ChevronLeft, ChevronRight, Zap, Lock, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const CATEGORIES = [
{ id: 'risk_management', label: 'Risk Management', icon: TrendingUp, color: 'emerald' },
{ id: 'psychology', label: 'Psychology', icon: Brain, color: 'cyan' },
{ id: 'chart_analysis', label: 'Chart Analysis', icon: BarChart3, color: 'violet' },
{ id: 'in_process', label: 'In Process', icon: Zap, color: 'amber' }];

const IN_PROCESS_FEATURES = [
  { id: 1, title: 'Public Traders Profiles', description: 'Discover and learn from successful traders', status: 'In Development', progress: 65 },
  { id: 2, title: 'AI Market Analysis', description: 'Real-time AI-powered market insights', status: 'In Development', progress: 45 },
  { id: 3, title: 'Market Screeners', description: 'Advanced filtering and screening tools', status: 'In Development', progress: 30 },
  { id: 4, title: 'Social Trading Hub', description: 'Connect with traders worldwide', status: 'Coming Soon', progress: 15, blurred: true },
  { id: 5, title: 'Advanced Backtesting', description: 'Test strategies on historical data', status: 'Coming Soon', progress: 10, blurred: true },
  { id: 6, title: 'Portfolio Analytics', description: 'Multi-asset portfolio tracking', status: 'Coming Soon', progress: 5, blurred: true },
];


const quillModules = {
  toolbar: [
  [{ 'header': [1, 2, 3, false] }],
  [{ 'size': ['small', false, 'large', 'huge'] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ 'align': [] }],
  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
  ['blockquote', 'code-block'],
  [{ 'color': [] }, { 'background': [] }],
  ['link', 'image'],
  ['clean']]

};

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
  const scrollRef = useRef(null);

  const { data: notes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: () => base44.entities.Note.list('-date', 100)
  });

  const createNoteMutation = useMutation({
    mutationFn: (data) => base44.entities.Note.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      setNoteForm({ title: '', content: '', image_urls: '' });
      setEditingNote(null);
      toast.success('Note saved');
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Note.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      setNoteForm({ title: '', content: '', image_urls: '' });
      setEditingNote(null);
      toast.success('Note updated');
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id) => base44.entities.Note.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      toast.success('Note deleted');
    }
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

  const removeImage = (urlToRemove) => {
    const urls = noteForm.image_urls.split(',').filter((url) => url !== urlToRemove);
    setNoteForm({ ...noteForm, image_urls: urls.join(',') });
  };

  const categoryNotes = notes.filter((n) => n.category === activeCategory);
  const activeTab = CATEGORIES.find((c) => c.id === activeCategory);
  const isInProcessTab = activeCategory === 'in_process';

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

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
            className="bg-[#111] border-[#2a2a2a] text-[#888]">

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
              onKeyDown={(e) => e.key === 'Enter' && handleAIAssist()} />

            <Button
              onClick={handleAIAssist}
              disabled={aiLoading}
              className="w-full bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:from-violet-600 hover:to-violet-700">

              <Sparkles className="w-4 h-4 mr-2" />
              {aiLoading ? 'Thinking...' : 'Ask AI'}
            </Button>
          </div>

          {aiResponse &&
          <div className="mt-6 p-6 bg-[#111]/50 rounded-xl border border-[#2a2a2a]">
              <div className="text-[#c0c0c0] whitespace-pre-wrap">{aiResponse}</div>
            </div>
          }
        </div>
      </div>);

  }

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          className="bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:from-violet-600 hover:to-violet-700">

          <Sparkles className="w-4 h-4 mr-2" />
          AI Assistant
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setEditingNote(null);
                setNoteForm({ title: '', content: '', image_urls: '' });
              }}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl border-2 transition-all whitespace-nowrap",
                isActive ?
                cat.color === 'emerald' ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" :
                cat.color === 'cyan' ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" :
                "bg-violet-500/20 border-violet-500/50 text-violet-400" :
                "bg-[#111] border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a]"
              )}>

              <Icon className="w-5 h-5" />
              <span className="font-medium">{cat.label}</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs",
                isActive ?
                cat.color === 'emerald' ? "bg-emerald-500/30" :
                cat.color === 'cyan' ? "bg-cyan-500/30" : "bg-violet-500/30" :
                "bg-[#1a1a1a]"
              )}>
                {notes.filter((n) => n.category === cat.id).length}
              </span>
            </button>);

        })}
      </div>

      {/* In Process Tab - Special UI */}
      {isInProcessTab && (
        <div className="space-y-8">
          {/* Hero Section */}
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-[#0d0d0d] backdrop-blur-sm rounded-3xl border-2 border-amber-500/30 p-12">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            
            <div className="relative z-10 text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-2 mb-4">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-amber-400 text-sm font-medium">Work in Progress</span>
              </div>
              
              <h2 className="text-4xl font-bold text-[#c0c0c0] mb-4">
                Exciting Features Coming Soon
              </h2>
              <p className="text-[#888] text-lg">
                We're building powerful new tools to take your trading to the next level. Stay tuned for amazing updates!
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {IN_PROCESS_FEATURES.map((feature) => (
              <div
                key={feature.id}
                className={cn(
                  "relative group bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6 transition-all hover:border-[#3a3a3a]",
                  feature.blurred && "blur-sm"
                )}
              >
                {/* Progress Indicator */}
                <div className="absolute top-4 right-4">
                  <div className="w-12 h-12 rounded-full border-4 border-[#1a1a1a] flex items-center justify-center relative">
                    <svg className="absolute inset-0 w-12 h-12 -rotate-90">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-[#2a2a2a]"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-amber-500"
                        strokeDasharray={`${feature.progress * 1.256} 125.6`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-[#c0c0c0] text-xs font-bold">{feature.progress}%</span>
                  </div>
                </div>

                {/* Lock Icon for Blurred */}
                {feature.blurred && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-[#1a1a1a]/90 rounded-xl p-4 border border-[#2a2a2a]">
                      <Lock className="w-8 h-8 text-[#666]" />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#c0c0c0] font-bold">{feature.title}</h3>
                    <p className="text-xs text-[#666]">{feature.status}</p>
                  </div>
                </div>

                <p className="text-[#888] text-sm mb-4">{feature.description}</p>

                {/* Progress Bar */}
                <div className="h-1.5 bg-[#0d0d0d] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-1000"
                    style={{ width: `${feature.progress}%` }}
                  />
                </div>

                {/* Animated Border */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#1a1a1a]/90 via-[#0d0d0d]/90 to-[#1a1a1a]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-8">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-1/4 w-32 h-32 bg-amber-500 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-emerald-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
            </div>
            
            <div className="relative z-10 text-center">
              <p className="text-[#c0c0c0] text-lg font-medium mb-2">
                🚀 More Amazing Features in Development
              </p>
              <p className="text-[#666] text-sm">
                We're constantly working to bring you the most advanced trading tools. Follow our updates!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Horizontal Notes Scroll */}
      {!isInProcessTab && categoryNotes.length > 0 &&
      <div className="relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
            <Button
            onClick={() => scroll('left')}
            variant="ghost"
            size="icon"
            className="bg-[#111]/90 hover:bg-[#1a1a1a] border border-[#2a2a2a]">

              <ChevronLeft className="w-5 h-5 text-[#888]" />
            </Button>
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
            <Button
            onClick={() => scroll('right')}
            variant="ghost"
            size="icon"
            className="bg-[#111]/90 hover:bg-[#1a1a1a] border border-[#2a2a2a]">

              <ChevronRight className="w-5 h-5 text-[#888]" />
            </Button>
          </div>
          <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 px-12 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

            {categoryNotes.map((note) =>
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
            className={cn(
              "min-w-[280px] bg-[#111]/50 rounded-xl border-2 p-4 cursor-pointer transition-all",
              editingNote?.id === note.id ?
              "border-violet-500/50 bg-violet-500/10" :
              "border-[#2a2a2a] hover:border-[#3a3a3a]"
            )}>

                <h4 className="text-[#c0c0c0] font-bold mb-2 truncate">{note.title}</h4>
                <div
              className="text-[#666] text-xs line-clamp-3"
              dangerouslySetInnerHTML={{ __html: note.content }} />

                <div className="flex items-center justify-between mt-3">
                  <span className="text-[#666] text-xs">{new Date(note.date).toLocaleDateString()}</span>
                  <Button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this note?')) {
                    deleteNoteMutation.mutate(note.id);
                    if (editingNote?.id === note.id) {
                      setEditingNote(null);
                      setNoteForm({ title: '', content: '', image_urls: '' });
                    }
                  }
                }}
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 h-6 px-2">

                    Delete
                  </Button>
                </div>
              </div>
          )}
          </div>
        </div>
      }

      {/* Editor - Full Width (hidden for In Process tab) */}
      {!isInProcessTab && (
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#c0c0c0]">
            {editingNote ? 'Edit Note' : 'New Note'}
          </h3>
          {editingNote &&
          <Button
            onClick={() => {
              setEditingNote(null);
              setNoteForm({ title: '', content: '', image_urls: '' });
            }}
            variant="ghost"
            size="sm"
            className="text-[#888]">

              Cancel Edit
            </Button>
          }
        </div>

        <Input
          placeholder="Note title..."
          value={noteForm.title}
          onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
          className="mb-6 bg-transparent border-none text-[#c0c0c0] text-2xl font-bold placeholder:text-[#444] focus-visible:ring-0 px-0" />


        <div className="text-slate-50 mb-4">
          <ReactQuill
            theme="snow"
            value={noteForm.content}
            onChange={(content) => setNoteForm({ ...noteForm, content })}
            modules={quillModules}
            style={{ minHeight: '400px' }} />

        </div>

        {noteForm.image_urls &&
        <div className="mb-4 flex flex-wrap gap-3">
            {noteForm.image_urls.split(',').filter(Boolean).map((url, idx) =>
          <div key={idx} className="relative group">
                <img
              src={url}
              alt=""
              className="h-32 object-cover rounded-lg border-2 border-[#2a2a2a]"
              style={{ maxWidth: '200px' }} />

                <button
              onClick={() => removeImage(url)}
              className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">

                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
          )}
          </div>
        }

        <div className="flex gap-3">
          <Button
            onClick={() => document.getElementById('file-upload').click()}
            variant="outline"
            disabled={uploading}
            className="bg-[#111] border-[#2a2a2a] text-[#888]">

            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload Image'}
          </Button>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden" />

          <Button
            onClick={handleSaveNote}
            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700">

            <Plus className="w-4 h-4 mr-2" />
            {editingNote ? 'Update Note' : 'Save Note'}
          </Button>
        </div>
      </div>
      )}
    </div>);

}