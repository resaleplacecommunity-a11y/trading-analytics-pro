import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, X, Upload, Bold, Italic, List } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const useTranslation = () => {
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  useEffect(() => {
    const h = () => setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    window.addEventListener('languagechange', h);
    return () => window.removeEventListener('languagechange', h);
  }, []);
  return { lang, t: (k) => {
    const tr = {
      ru: { personalJournal: 'Личный Торговый Дневник', newNote: 'Новая Заметка', all: 'Все', strategies: 'Стратегии', thoughts: 'Мысли', marketAnalysis: 'Анализ Рынка', tradingRules: 'Правила', other: 'Другое', title: 'Заголовок', category: 'Категория', content: 'Содержание', cancel: 'Отмена', save: 'Сохранить', noNotes: 'Нет заметок' },
      en: { personalJournal: 'Personal Trading Journal', newNote: 'New Note', all: 'All', strategies: 'Strategies', thoughts: 'Thoughts', marketAnalysis: 'Market Analysis', tradingRules: 'Trading Rules', other: 'Other', title: 'Title', category: 'Category', content: 'Content', cancel: 'Cancel', save: 'Save', noNotes: 'No notes yet' }
    };
    return tr[lang]?.[k] || k;
  }};
};

export default function Notes() {
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: notes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: () => base44.entities.Note.list('-date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Note.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      setShowForm(false);
      setEditingNote(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Note.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      setShowForm(false);
      setEditingNote(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Note.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['notes']),
  });

  const filteredNotes = selectedCategory === 'all' 
    ? notes 
    : notes.filter(n => n.category === selectedCategory);

  const categories = ['all', 'strategies', 'thoughts', 'market_analysis', 'trading_rules', 'other'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">{t('personalJournal')}</h1>
          <p className="text-[#666] text-sm">{filteredNotes.length} заметок</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]">
          <Plus className="w-4 h-4 mr-2" />
          {t('newNote')}
        </Button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
            className={selectedCategory === cat ? "bg-[#c0c0c0] text-black" : "border-[#2a2a2a] text-[#888]"}
          >
            {t(cat)}
          </Button>
        ))}
      </div>

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map(note => (
            <div key={note.id} className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors group">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-[#c0c0c0] font-semibold line-clamp-1">{note.title}</h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingNote(note); setShowForm(true); }}>
                    <Edit className="w-4 h-4 text-[#888]" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(note.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
              <div className="text-[#888] text-sm line-clamp-3" dangerouslySetInnerHTML={{ __html: note.content }} />
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-[#666]">{t(note.category)}</span>
                <span className="text-[#666]">{new Date(note.date || note.created_date).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-[#666]">{t('noNotes')}</div>
      )}

      {/* Form Modal */}
      {showForm && (
        <NoteForm
          note={editingNote}
          onSave={(data) => {
            if (editingNote) {
              updateMutation.mutate({ id: editingNote.id, data });
            } else {
              createMutation.mutate({ ...data, date: new Date().toISOString().split('T')[0] });
            }
          }}
          onClose={() => { setShowForm(false); setEditingNote(null); }}
          t={t}
        />
      )}
    </div>
  );
}

function NoteForm({ note, onSave, onClose, t }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'other',
    image_urls: '',
    ...note
  });

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] sticky top-0 bg-[#1a1a1a]">
          <h2 className="text-[#c0c0c0] font-semibold">{note ? 'Редактировать' : t('newNote')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <Label className="text-[#888]">{t('title')}</Label>
            <Input 
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
            />
          </div>
          
          <div>
            <Label className="text-[#888]">{t('category')}</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
              <SelectTrigger className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                {['strategies', 'thoughts', 'market_analysis', 'trading_rules', 'other'].map(cat => (
                  <SelectItem key={cat} value={cat} className="text-[#c0c0c0]">{t(cat)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-[#888]">{t('content')}</Label>
            <div className="mt-1 rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#151515]">
              <ReactQuill 
                theme="snow"
                value={formData.content}
                onChange={(content) => setFormData({...formData, content})}
                modules={modules}
                className="text-[#c0c0c0] h-64"
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t border-[#2a2a2a] sticky bottom-0 bg-[#1a1a1a]">
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={() => onSave(formData)} className="bg-[#c0c0c0] text-black">
            {t('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}