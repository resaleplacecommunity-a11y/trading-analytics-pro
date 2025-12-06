import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { TrendingDown, Save, Edit } from 'lucide-react';

const useTranslation = () => {
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  useEffect(() => {
    const h = () => setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    window.addEventListener('languagechange', h);
    return () => window.removeEventListener('languagechange', h);
  }, []);
  return { lang, t: (k) => {
    const tr = {
      ru: { weeklyOutlook: 'Недельный Прогноз Рынка', analysis: 'Анализ Рынка', expectations: 'Ожидания', keyLevels: 'Ключевые Уровни', tradingPlan: 'Торговый План', save: 'Сохранить', edit: 'Редактировать', noOutlook: 'Прогноз на эту неделю еще не создан' },
      en: { weeklyOutlook: 'Weekly Market Outlook', analysis: 'Market Analysis', expectations: 'Expectations', keyLevels: 'Key Levels', tradingPlan: 'Trading Plan', save: 'Save', edit: 'Edit', noOutlook: 'No outlook for this week yet' }
    };
    return tr[lang]?.[k] || k;
  }};
};

export default function MarketOutlook() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    analysis: '',
    expectations: '',
    key_levels: '',
    trading_plan: ''
  });
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekKey = format(weekStart, 'yyyy-MM-dd');

  const { data: outlooks = [] } = useQuery({
    queryKey: ['marketOutlook'],
    queryFn: () => base44.entities.MarketOutlook.list('-week_start', 100),
  });

  const currentOutlook = outlooks.find(o => o.week_start === weekKey);

  useEffect(() => {
    if (currentOutlook) {
      setFormData({
        analysis: currentOutlook.analysis || '',
        expectations: currentOutlook.expectations || '',
        key_levels: currentOutlook.key_levels || '',
        trading_plan: currentOutlook.trading_plan || ''
      });
    }
  }, [currentOutlook]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (currentOutlook) {
        return base44.entities.MarketOutlook.update(currentOutlook.id, data);
      } else {
        return base44.entities.MarketOutlook.create({
          ...data,
          week_start: weekKey,
          week_end: format(weekEnd, 'yyyy-MM-dd')
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marketOutlook']);
      setIsEditing(false);
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">{t('weeklyOutlook')}</h1>
          <p className="text-[#666] text-sm">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        <Button 
          onClick={() => isEditing ? saveMutation.mutate(formData) : setIsEditing(true)}
          className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
        >
          {isEditing ? <><Save className="w-4 h-4 mr-2" />{t('save')}</> : <><Edit className="w-4 h-4 mr-2" />{t('edit')}</>}
        </Button>
      </div>

      {!currentOutlook && !isEditing ? (
        <div className="bg-[#1a1a1a] rounded-xl p-12 border border-[#2a2a2a] text-center">
          <TrendingDown className="w-12 h-12 text-[#666] mx-auto mb-4" />
          <p className="text-[#666] mb-4">{t('noOutlook')}</p>
          <Button onClick={() => setIsEditing(true)} className="bg-[#c0c0c0] text-black">
            Создать Прогноз
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
            <Label className="text-[#888] mb-2 block">{t('analysis')}</Label>
            {isEditing ? (
              <Textarea 
                value={formData.analysis}
                onChange={(e) => setFormData({...formData, analysis: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-32"
                placeholder="Общий анализ рынка на неделю..."
              />
            ) : (
              <p className="text-[#c0c0c0] whitespace-pre-wrap">{formData.analysis}</p>
            )}
          </div>

          <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
            <Label className="text-[#888] mb-2 block">{t('expectations')}</Label>
            {isEditing ? (
              <Textarea 
                value={formData.expectations}
                onChange={(e) => setFormData({...formData, expectations: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-24"
                placeholder="Что ожидаю от рынка..."
              />
            ) : (
              <p className="text-[#c0c0c0] whitespace-pre-wrap">{formData.expectations}</p>
            )}
          </div>

          <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
            <Label className="text-[#888] mb-2 block">{t('keyLevels')}</Label>
            {isEditing ? (
              <Textarea 
                value={formData.key_levels}
                onChange={(e) => setFormData({...formData, key_levels: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-24"
                placeholder="BTC: 94000 (поддержка), 97000 (сопротивление)..."
              />
            ) : (
              <p className="text-[#c0c0c0] whitespace-pre-wrap">{formData.key_levels}</p>
            )}
          </div>

          <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
            <Label className="text-[#888] mb-2 block">{t('tradingPlan')}</Label>
            {isEditing ? (
              <Textarea 
                value={formData.trading_plan}
                onChange={(e) => setFormData({...formData, trading_plan: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-32"
                placeholder="План торговли на неделю..."
              />
            ) : (
              <p className="text-[#c0c0c0] whitespace-pre-wrap">{formData.trading_plan}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}