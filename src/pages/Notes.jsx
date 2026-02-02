import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, BookOpen, Brain, TrendingUp, BarChart3, Plus, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';

// Register image resize module
Quill.register('modules/imageResize', ImageResize);

const DEFAULT_CATEGORIES = [
{ id: 'risk_management', label: 'Risk Management', icon: TrendingUp, color: 'emerald' },
{ id: 'psychology', label: 'Psychology', icon: Brain, color: 'cyan' },
{ id: 'chart_analysis', label: 'Chart Analysis', icon: BarChart3, color: 'violet' }];


const quillModules = {
  toolbar: [
  [{ 'header': [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ 'align': [] }],
  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
  ['blockquote', 'code-block'],
  [{ 'color': [] }, { 'background': [] }],
  ['link', 'image'],
  ['clean']],
  imageResize: {
    modules: ['Resize', 'DisplaySize']
  }
};

export default function NotesPage() {
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('tradingpro_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  const [activeCategory, setActiveCategory] = useState('risk_management');
  const [showAI, setShowAI] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState({ title: '', content: '', image_urls: '' });
  const [uploading, setUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const scrollRef = useRef(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Note.filter({ created_by: user.email }, '-date', 100);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
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

  const saveCategories = (newCategories) => {
    setCategories(newCategories);
    localStorage.setItem('tradingpro_categories', JSON.stringify(newCategories));
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const newId = newCategoryName.toLowerCase().replace(/\s+/g, '_');
    const colors = ['emerald', 'cyan', 'violet', 'amber', 'rose', 'blue'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newCategory = {
      id: newId,
      label: newCategoryName,
      icon: BookOpen,
      color: randomColor,
      custom: true
    };
    saveCategories([...categories, newCategory]);
    setNewCategoryName('');
    setShowAddCategory(false);
    toast.success('Category added');
  };

  const deleteCategory = (catId) => {
    const filtered = categories.filter(c => c.id !== catId);
    saveCategories(filtered);
    if (activeCategory === catId) {
      setActiveCategory(filtered[0]?.id || 'risk_management');
    }
    toast.success('Category deleted');
  };

  const categoryNotes = notes.filter((n) => n.category === activeCategory);
  const activeTab = categories.find((c) => c.id === activeCategory);

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
      <div className="flex gap-3 overflow-x-auto pb-2 items-center">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <div key={cat.id} className="relative group">
              <button
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
                  cat.color === 'violet' ? "bg-violet-500/20 border-violet-500/50 text-violet-400" :
                  cat.color === 'amber' ? "bg-amber-500/20 border-amber-500/50 text-amber-400" :
                  cat.color === 'rose' ? "bg-rose-500/20 border-rose-500/50 text-rose-400" :
                  "bg-blue-500/20 border-blue-500/50 text-blue-400" :
                  "bg-[#111] border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a]"
                )}>

                <Icon className="w-5 h-5" />
                <span className="font-medium">{cat.label}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs",
                  isActive ?
                  cat.color === 'emerald' ? "bg-emerald-500/30" :
                  cat.color === 'cyan' ? "bg-cyan-500/30" : 
                  cat.color === 'violet' ? "bg-violet-500/30" :
                  cat.color === 'amber' ? "bg-amber-500/30" :
                  cat.color === 'rose' ? "bg-rose-500/30" : "bg-blue-500/30" :
                  "bg-[#1a1a1a]"
                )}>
                  {notes.filter((n) => n.category === cat.id).length}
                </span>
              </button>
              {cat.custom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete category "${cat.label}"?`)) {
                      deleteCategory(cat.id);
                    }
                  }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/90 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>);

        })}
        <button
          onClick={() => setShowAddCategory(true)}
          className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-dashed border-[#2a2a2a] text-[#666] hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl border-2 border-[#2a2a2a] p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-[#c0c0c0] mb-4">Add New Category</h3>
            <Input
              placeholder="Category name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              className="mb-4 bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                onClick={addCategory}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              >
                Add Category
              </Button>
              <Button
                onClick={() => {
                  setShowAddCategory(false);
                  setNewCategoryName('');
                }}
                variant="outline"
                className="bg-[#111] border-[#2a2a2a] text-[#888]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Horizontal Notes Scroll */}
      {categoryNotes.length > 0 &&
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

      {/* Editor - Full Width */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        {editingNote && (
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => {
                setEditingNote(null);
                setNoteForm({ title: '', content: '', image_urls: '' });
              }}
              variant="ghost"
              size="sm"
              className="text-[#888]"
            >
              Cancel Edit
            </Button>
          </div>
        )}

        <Input
          placeholder="Note title..."
          value={noteForm.title}
          onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
          className="mb-6 bg-transparent border-none text-[#c0c0c0] text-3xl font-bold placeholder:text-[#444] focus-visible:ring-0 px-0"
        />

        <style>{`
          .ql-editor.ql-blank::before {
            color: white !important;
            opacity: 0.7;
          }
          .ql-editor img {
            cursor: move;
          }
        `}</style>

        <div className="text-slate-50 mb-6">
          <ReactQuill
            theme="snow"
            value={noteForm.content}
            onChange={(content) => setNoteForm({ ...noteForm, content })}
            modules={quillModules}
            placeholder="Start writing..."
            style={{ minHeight: '400px' }} />
        </div>

        <Button
          onClick={handleSaveNote}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700">
          <Plus className="w-4 h-4 mr-2" />
          {editingNote ? 'Update Note' : 'Save Note'}
        </Button>
      </div>
    </div>);

}