export default function LanguageSelector() {
  const languages = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  ];

  return (
    <div className="relative inline-block" role="group" aria-label="Select language">
      <button
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#172B1D] bg-white border border-[#DCFCE7] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
        aria-haspopup="listbox"
      >
        <span>🌐</span>
        <span className="ml-1">English</span>
        <span className="w-0 h-0 border-l-3 border-t-3 border-b-3 transparent border-t-[#172B1D] ml-1"></span>
      </button>
      <div className="absolute right-0 mt-2 w-32 bg-white border border-[#DCFCE7] rounded-lg shadow-lg overflow-hidden z-20">
        {languages.map((lang) => (
          <button
            key={lang.code}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#64748B] hover:bg-[#DCFCE7] hover:text-[#166534] transition-colors"
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}