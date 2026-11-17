import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const supportedLanguages = ['en', 'te', 'hi'];
const defaultLanguage = 'en';
const storageKey = 'agrisathi_language';

const translations = {
  en: () => import('../i18n/en.json'),
  te: () => import('../i18n/te.json'),
  hi: () => import('../i18n/hi.json'),
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(defaultLanguage);
  const [translationsDict, setTranslationsDict] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved && supportedLanguages.includes(saved)) {
      setLangState(saved);
      document.documentElement.setAttribute('data-lang', saved);
      document.documentElement.lang = saved;
    } else {
      document.documentElement.lang = defaultLanguage;
    }
  }, []);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const mod = await translations[lang]();
        setTranslationsDict(mod.default || mod);
        setReady(true);
      } catch (e) {
        console.error('Failed to load translations for', lang, e);
        setReady(true);
      }
    };
    loadTranslations();
  }, [lang]);

  const setLang = useCallback((newLang) => {
    if (!supportedLanguages.includes(newLang)) return;
    setLangState(newLang);
    localStorage.setItem(storageKey, newLang);
    document.documentElement.setAttribute('data-lang', newLang);
    document.documentElement.lang = newLang;
  }, []);

  const t = (key) => {
    const keys = key.split('.');
    let value = translationsDict;
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key;
      }
    }
    return typeof value === 'string' ? value : key;
  };

  const value = {
    lang,
    setLang,
    t,
    supportedLanguages,
    ready,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
};