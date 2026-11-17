import { useLanguage } from '../../context/LanguageContext';

export default function ModuleLanguageSelector({ label = 'Language' }) {
  const { lang, setLang } = useLanguage();
  return (
    <label className="module-language">
      <span>{label}</span>
      <select value={lang} onChange={(event) => setLang(event.target.value)} aria-label={label}>
        <option value="en">English</option>
        <option value="te">తెలుగు</option>
        <option value="hi">हिन्दी</option>
      </select>
    </label>
  );
}
