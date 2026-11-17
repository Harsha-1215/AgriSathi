import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Bookmark, Leaf, Mic, Search, Sprout, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../context/LanguageContext';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import content from '../../data/farmingToolsContent';
import '../../styles/farming-tools.css';

function requestMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function CropCard({ crop, copy, language, bookmarked, onBookmark }) {
  return (
    <article className="crop-card">
      <Link to={`/farmer/crop-knowledge/${crop.id}`} className="crop-card__visual">
        {crop.imageUrl
          ? <img src={crop.imageUrl} alt="" loading="lazy" />
          : <span aria-hidden="true"><Sprout size={38} /></span>}
      </Link>
      <div className="crop-card__body">
        <div><small>{crop.categoryName}</small><h2><Link to={`/farmer/crop-knowledge/${crop.id}`}>{crop.displayName || crop.name}</Link></h2></div>
        <button type="button" className={`crop-card__bookmark${bookmarked ? ' is-saved' : ''}`} onClick={() => onBookmark(crop.id, bookmarked)} aria-label={bookmarked ? copy.removeBookmark : copy.saveBookmark} title={bookmarked ? copy.removeBookmark : copy.saveBookmark}>
          <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
        <p>{crop.description?.[language] || copy.notPublished}</p>
        <Link className="crop-card__details" to={`/farmer/crop-knowledge/${crop.id}`}>{copy.detailsTitle} <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}

export default function CropKnowledgePage() {
  const { lang } = useLanguage();
  const copy = content[lang] || content.en;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [view, setView] = useState('catalog');
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef(null);
  useEffect(() => () => recognitionRef.current?.abort?.(), []);
  const cropsQuery = useQuery({
    queryKey: ['crop-knowledge-list', lang, search, category],
    queryFn: async () => unwrapPayload(await api.get('/crop-knowledge/crops', {
      params: { language: lang, q: search || undefined, categoryId: category || undefined, limit: 100 },
    })),
    retry: false,
  });
  const categoriesQuery = useQuery({
    queryKey: ['crop-knowledge-categories', lang],
    queryFn: async () => unwrapPayload(await api.get('/crop-knowledge/categories', { params: { language: lang } })),
    retry: false,
  });
  const bookmarksQuery = useQuery({
    queryKey: ['crop-knowledge-bookmarks', lang],
    queryFn: async () => unwrapPayload(await api.get('/crop-knowledge/bookmarks', { params: { language: lang } })),
    retry: false,
  });
  const recentQuery = useQuery({
    queryKey: ['crop-knowledge-recent', lang],
    queryFn: async () => unwrapPayload(await api.get('/crop-knowledge/recent', { params: { language: lang } })),
    retry: false,
  });
  const crops = cropsQuery.data || [];
  const bookmarks = bookmarksQuery.data || [];
  const recent = recentQuery.data || [];
  const bookmarkIds = useMemo(() => new Set(bookmarks.map((item) => item.crop.id)), [bookmarks]);

  const bookmarkMutation = useMutation({
    mutationFn: async ({ cropId, bookmarked }) => bookmarked
      ? api.delete(`/crop-knowledge/bookmarks/${cropId}`)
      : api.post(`/crop-knowledge/bookmarks/${cropId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crop-knowledge-bookmarks'] }),
    onError: (error) => setVoiceError(requestMessage(error, copy.adminError)),
  });

  const startVoiceSearch = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError(copy.voiceUnsupported);
      return;
    }
    try {
      recognitionRef.current?.abort?.();
      const recognition = new Recognition();
      recognition.lang = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' }[lang] || 'en-IN';
      recognition.onresult = (event) => {
        setSearch(event.results[0][0].transcript);
        setVoiceError('');
      };
      recognition.onerror = () => setVoiceError(copy.voiceError);
      recognition.onend = () => { recognitionRef.current = null; };
      recognitionRef.current = recognition;
      setVoiceError('');
      recognition.start();
    } catch {
      setVoiceError(copy.voiceError);
    }
  };

  const listForView = view === 'bookmarks'
    ? bookmarks.map((item) => item.crop)
    : view === 'recent'
      ? recent.map((item) => item.crop)
      : crops;

  return (
    <main className="farming-tools">
      <header className="farming-tools__header">
        <Link to="/farmer/dashboard"><Logo size="small" /></Link>
        <div className="farming-tools__header-actions"><ModuleLanguageSelector label={copy.language} /><Link className="farming-tools__back" to="/farmer/dashboard">{copy.dashboard}</Link></div>
      </header>
      <div className="farming-tools__container">
        <div className="farming-tools__intro">
          <span className="farming-tools__intro-icon"><BookOpen size={27} /></span>
          <div><p className="farming-tools__eyebrow">{copy.knowledge}</p><h1>{copy.knowledge}</h1><p>{copy.knowledgeSubtitle}</p></div>
        </div>

        <section className="crop-hub__search">
          <label className="farming-tools__field"><span>{copy.searchCrops}</span><input value={search} onChange={(event) => { setSearch(event.target.value); setView('catalog'); }} /></label>
          <button type="button" className="farming-tools__secondary" onClick={startVoiceSearch}><Mic size={17} />{copy.voiceSearch}</button>
          {search && <button type="button" className="crop-hub__clear" onClick={() => setSearch('')} aria-label={copy.searchCrops}><X size={17} /></button>}
        </section>
        {voiceError && <p className="farming-tools__warning" role="status">{voiceError}</p>}

        <nav className="crop-hub__tabs" aria-label={copy.knowledge}>
          <button type="button" className={view === 'catalog' ? 'is-active' : ''} onClick={() => setView('catalog')}><Sprout size={17} />{copy.knowledge}</button>
          <button type="button" className={view === 'bookmarks' ? 'is-active' : ''} onClick={() => setView('bookmarks')}><Bookmark size={17} />{copy.bookmarks}</button>
          <button type="button" className={view === 'recent' ? 'is-active' : ''} onClick={() => setView('recent')}><BookOpen size={17} />{copy.recent}</button>
        </nav>

        {view === 'catalog' && (
          <div className="crop-hub__filters">
            <label className="farming-tools__field"><span>{copy.categories}</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">{copy.allCategories}</option>
                {(categoriesQuery.data || []).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
              </select>
            </label>
            <Link to="/farmer/calculators"><Leaf size={17} />{copy.useCalculator}</Link>
          </div>
        )}

        {cropsQuery.isPending || (view === 'bookmarks' && bookmarksQuery.isPending) || (view === 'recent' && recentQuery.isPending) ? (
          <p className="farming-tools__loading" role="status">{copy.loading}</p>
        ) : cropsQuery.isError || categoriesQuery.isError ? (
          <div className="farming-tools__warning" role="alert">{copy.listError} <button type="button" onClick={() => cropsQuery.refetch()}>{copy.retry}</button></div>
        ) : listForView.length ? (
          <section className="crop-hub__grid" aria-label={copy.knowledge}>
            {listForView.map((crop) => (
              <CropCard key={crop.id} crop={crop} copy={copy} language={lang} bookmarked={bookmarkIds.has(crop.id)} onBookmark={(cropId, isSaved) => bookmarkMutation.mutate({ cropId, bookmarked: isSaved })} />
            ))}
          </section>
        ) : <p className="farming-tools__empty">{view === 'bookmarks' ? copy.noBookmarks : copy.noCrops}</p>}

        <aside className="farming-tools__disclaimer"><BookOpen size={19} /><p>{copy.sourceNote}</p></aside>
      </div>
    </main>
  );
}
