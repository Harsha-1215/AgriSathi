import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Bookmark, CalendarDays, ExternalLink, Leaf, Mic, Sprout } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import content from '../../data/farmingToolsContent';
import '../../styles/farming-tools.css';

function ContentValue({ value }) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    return <ul>{value.map((item, index) => <li key={`${index}-${typeof item === 'string' ? item : 'entry'}`}><ContentValue value={item} /></li>)}</ul>;
  }
  if (typeof value === 'object') {
    return (
      <dl className="crop-detail__content-list">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ')}</dt><dd><ContentValue value={item} /></dd></div>
        ))}
      </dl>
    );
  }
  return <span>{String(value)}</span>;
}

function Source({ source, label }) {
  if (!source) return null;
  const isWebUrl = /^https?:\/\//i.test(source);
  return isWebUrl
    ? <a href={source} target="_blank" rel="noreferrer"><ExternalLink size={15} />{label}: {source}</a>
    : <p className="crop-detail__source">{label}: {source}</p>;
}

function askQuestion(language, name) {
  if (language === 'te') return `${name} పంట గురించి సాగు సమాచారం చెప్పండి.`;
  if (language === 'hi') return `${name} की खेती के बारे में जानकारी दें।`;
  return `Please explain verified cultivation information for ${name}.`;
}

export default function CropKnowledgeDetailPage() {
  const { cropId } = useParams();
  const { lang } = useLanguage();
  const copy = content[lang] || content.en;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [region, setRegion] = useState(user?.profile?.state || user?.state || '');
  const [regionInput, setRegionInput] = useState(user?.profile?.state || user?.state || '');
  const detailQuery = useQuery({
    queryKey: ['crop-knowledge-detail', cropId, lang, region],
    queryFn: async () => unwrapPayload(await api.get(`/crop-knowledge/crops/${cropId}`, { params: { language: lang, state: region || undefined } })),
    retry: false,
  });
  const bookmarksQuery = useQuery({
    queryKey: ['crop-knowledge-bookmarks', lang],
    queryFn: async () => unwrapPayload(await api.get('/crop-knowledge/bookmarks', { params: { language: lang } })),
    retry: false,
  });
  const crop = detailQuery.data;
  const bookmarked = (bookmarksQuery.data || []).some((item) => item.crop.id === cropId);
  const bookmarkMutation = useMutation({
    mutationFn: async () => bookmarked
      ? api.delete(`/crop-knowledge/bookmarks/${cropId}`)
      : api.post(`/crop-knowledge/bookmarks/${cropId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crop-knowledge-bookmarks'] }),
  });

  return (
    <main className="farming-tools">
      <header className="farming-tools__header">
        <Link to="/farmer/dashboard"><Logo size="small" /></Link>
        <div className="farming-tools__header-actions"><ModuleLanguageSelector label={copy.language} /><Link className="farming-tools__back" to="/farmer/crop-knowledge"><ArrowLeft size={17} />{copy.back}</Link></div>
      </header>
      <div className="farming-tools__container">
        {detailQuery.isPending ? <p className="farming-tools__loading" role="status">{copy.loading}</p> : detailQuery.isError ? (
          <div className="farming-tools__warning" role="alert">{detailQuery.error?.response?.data?.message || copy.detailsError}<Link to="/farmer/crop-knowledge">{copy.back}</Link></div>
        ) : crop && (
          <>
            <section className="crop-detail__hero">
              <div className="crop-detail__image">{crop.imageUrl ? <img src={crop.imageUrl} alt="" /> : <Sprout size={48} aria-hidden="true" />}</div>
              <div className="crop-detail__hero-copy">
                <p className="farming-tools__eyebrow">{crop.categoryName}</p>
                <h1>{crop.displayName || crop.name}</h1>
                <p>{crop.description?.[lang] || copy.notPublished}</p>
                <div className="crop-detail__actions">
                  <button type="button" className="farming-tools__secondary" onClick={() => bookmarkMutation.mutate()} disabled={bookmarkMutation.isPending}><Bookmark size={17} fill={bookmarked ? 'currentColor' : 'none'} />{bookmarked ? copy.removeBookmark : copy.saveBookmark}</button>
                  <Link className="farming-tools__secondary" to={`/farmer/calculators?crop=${encodeURIComponent(crop.id)}`}><Leaf size={17} />{copy.useCalculator}</Link>
                  <Link className="farming-tools__secondary" to={`/farmer/voice-assistant?question=${encodeURIComponent(askQuestion(lang, crop.displayName || crop.name))}&language=${lang}`}><Mic size={17} />{copy.askAssistant}</Link>
                </div>
              </div>
            </section>

            <section className="crop-detail__section">
              <div className="farming-tools__section-heading"><h2>{copy.overview}</h2><BookOpen size={19} /></div>
              {crop.knowledge?.length ? crop.knowledge.map((article) => (
                <article className="crop-detail__article" key={article.id}>
                  <h3>{article.title}</h3>
                  <ContentValue value={article.content} />
                  <Source source={article.source} label={copy.source} />
                </article>
              )) : <p className="farming-tools__empty">{copy.notPublished}</p>}
            </section>

            <section className="crop-detail__section">
              <div className="farming-tools__section-heading"><h2>{copy.growthStages}</h2><Sprout size={19} /></div>
              {crop.growthStages?.length ? (
                <ol className="crop-detail__stages">
                  {crop.growthStages.map((stage) => <li key={stage.id}><strong>{stage.sequence}. {stage.name}</strong>{stage.durationDays && <span>{stage.durationDays} days</span>}<ContentValue value={stage.details} /><Source source={stage.source} label={copy.source} /></li>)}
                </ol>
              ) : <p className="farming-tools__empty">{copy.noStages}</p>}
            </section>

            <section className="crop-detail__section">
              <div className="farming-tools__section-heading"><h2>{copy.regionalCalendar}</h2><CalendarDays size={19} /></div>
              <form className="farming-tools__form crop-detail__region-form" onSubmit={(event) => { event.preventDefault(); setRegion(regionInput.trim()); }}>
                <label className="farming-tools__field"><span>{copy.state}</span><input value={regionInput} onChange={(event) => setRegionInput(event.target.value)} maxLength={120} /></label>
                <button className="farming-tools__secondary" type="submit">{copy.searchRegion}</button>
              </form>
              {crop.calendars?.length ? crop.calendars.map((calendar) => (
                <article className="crop-detail__calendar" key={calendar.id}>
                  <h3>{calendar.state}{calendar.district ? ` · ${calendar.district}` : ''} — {calendar.season}</h3>
                  <p><strong>{copy.sowingStart}:</strong> {calendar.sowingWindow?.start || '—'} <strong>{copy.sowingEnd}:</strong> {calendar.sowingWindow?.end || '—'}</p>
                  <p><strong>{copy.harvestStart}:</strong> {calendar.harvestingWindow?.start || '—'} <strong>{copy.harvestEnd}:</strong> {calendar.harvestingWindow?.end || '—'}</p>
                  <ContentValue value={calendar.activities} />
                  <Source source={calendar.source} label={copy.source} />
                </article>
              )) : <p className="farming-tools__empty">{copy.notPublishedCalendar}</p>}
            </section>

            {crop.recommendations?.length > 0 && (
              <section className="crop-detail__section">
                <div className="farming-tools__section-heading"><h2>{copy.verifiedRecommendations}</h2><Leaf size={19} /></div>
                {crop.recommendations.map((recommendation) => <article className="crop-detail__article" key={recommendation.id}><h3>{recommendation.recommendationType}</h3><ContentValue value={recommendation.details} /><Source source={recommendation.source} label={copy.source} /></article>)}
              </section>
            )}

            <aside className="farming-tools__disclaimer"><Leaf size={19} /><p>{copy.sourceNote} {copy.consultations}</p></aside>
          </>
        )}
      </div>
    </main>
  );
}
