import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";

// Language system
const getLanguage = () => localStorage.getItem('tradingpro_lang') || 'ru';
const setLanguage = (lang) => {
  localStorage.setItem('tradingpro_lang', lang);
  window.dispatchEvent(new Event('languagechange'));
};

export default function LanguageSwitcher() {
  const [lang, setLang] = useState(getLanguage());

  useEffect(() => {
    const handleLanguageChange = () => {
      setLang(getLanguage());
    };
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, []);

  const toggle = () => {
    const newLang = lang === 'ru' ? 'en' : 'ru';
    setLanguage(newLang);
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={toggle}
      className="text-[#888] hover:text-[#c0c0c0] font-medium"
    >
      {lang === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}
    </Button>
  );
}