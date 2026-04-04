import { useState, useEffect } from 'react';

const getLanguage = () => localStorage.getItem('tradingpro_lang') || 'ru';
const setLanguage = (lang) => {
  localStorage.setItem('tradingpro_lang', lang);
  window.dispatchEvent(new Event('languagechange'));
};

export default function LanguageSwitcher({ square }) {
  const [lang, setLang] = useState(getLanguage());

  useEffect(() => {
    const handleLanguageChange = () => setLang(getLanguage());
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, []);

  const toggle = () => setLanguage(lang === 'ru' ? 'en' : 'ru');

  if (square) {
    return (
      <button
        onClick={toggle}
        className="w-full h-full flex items-center justify-center text-[#888] hover:text-[#c0c0c0] transition-colors text-[11px] font-bold tracking-wide"
      >
        {lang === 'ru' ? 'RU' : 'EN'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="text-[#888] hover:text-[#c0c0c0] font-medium text-sm px-2 py-1 rounded transition-colors"
    >
      {lang === 'ru' ? 'RU' : 'EN'}
    </button>
  );
}
