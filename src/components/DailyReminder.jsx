import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { X, AlertCircle } from 'lucide-react';

const getLanguage = () => localStorage.getItem('tradingpro_lang') || 'ru';

export default function DailyReminder() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const checkReminder = () => {
      const now = new Date();
      const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
      const hour = moscowTime.getHours();
      
      // Show at 8:00 MSK
      const lastShown = localStorage.getItem('lastReminderShown');
      const today = moscowTime.toISOString().split('T')[0];
      
      if (hour === 8 && lastShown !== today) {
        setShow(true);
        localStorage.setItem('lastReminderShown', today);
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  if (!show) return null;

  const message = getLanguage() === 'ru' 
    ? 'Помни дисциплину. Лучший трейдер — тот, кто соблюдает свои правила.'
    : 'Remember discipline. The best trader is one who follows their rules.';

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-2 border-amber-500/30 rounded-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <AlertCircle className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-amber-400 font-semibold mb-1">
              {getLanguage() === 'ru' ? 'Ежедневное Напоминание' : 'Daily Reminder'}
            </p>
            <p className="text-[#c0c0c0] text-sm">{message}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShow(false)}
            className="text-[#666] hover:text-[#888]"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}