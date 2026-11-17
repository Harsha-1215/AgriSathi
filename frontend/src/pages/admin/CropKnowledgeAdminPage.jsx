import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, ImagePlus, Save, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import content from '../../data/farmingToolsContent';
import '../../styles/farming-tools.css';

const sectionTypes = ['overview', 'climate', 'soil', 'land-preparation', 'seed-selection', 'sowing', 'irrigation', 'fertilizer', 'weed', 'pest', 'disease', 'harvesting', 'storage', 'marketing', 'faq'];

function errorText(error, fallback) {
  return error?.response?.data?.message || fallback;
}

export default function CropKnowledgeAdminPage() {
  const { lang } = useLanguage();
  const copy = content[lang] || content.en;
  const queryClient = useQueryClient();
  const [cropId, setCropId] = useState('');
  const [article, setArticle] = useState({ sectionType: 'overview', language: 'en', title: '', body: '', source: '', isPublished: false });
  const [editingKnowledgeId, setEditingKnowledgeId] = useState('');
  const [revisionDetails, setRevisionDetails] = useState(null);
  const [calendar, setCalendar] = useState({ language: 'en', state: '', district: '', season: '', sowingStart: '', sowingEnd: '', harvestStart: '', harvestEnd: '', source: '' });
  const [stage, setStage] = useState({ language: 'en', sequence: '1', name: '', durationDays: '', details: '{}', source: '' });
  const [recommendation, setRecommendation] = useState({ recommendationType: 'seed', state: '', details: '{}', source: '' });
  const [newCrop, setNewCrop] = useState({ id: '', name: '', categoryId: '', te: '', hi: '' });
  const [calendarDates, setCalendarDates] = useState({ sowingStart: '', sowingEnd: '', harvestStart: '', harvestEnd: '' });
  const [imageFile, setImageFile] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const cropsQuery = useQuery({
    queryKey: ['admin-crop-catalog'],
    queryFn: async () => unwrapPayload(await api.get('/admin/crop-knowledge/crops')),
    retry: false,
  });
  const categoriesQuery = useQuery({
    queryKey: ['admin-crop-categories'],
    queryFn: async () => unwrapPayload(await api.get('/admin/crop-knowledge/categories')),
    retry: false,
  });
  const knowledgeQuery = useQuery({
    queryKey: ['admin-crop-knowledge'],
    queryFn: async () => unwrapPayload(await api.get('/admin/crop-knowledge/knowledge')),
    retry: false,
  });
  const crops = cropsQuery.data || [];
  useEffect(() => {
    if (!cropId && crops.length) setCropId(crops[0].id);
  }, [cropId, crops]);

  const onSuccess = () => {
    setNotice(copy.adminSaved);
    setError('');
    queryClient.invalidateQueries({ queryKey: ['admin-crop-knowledge'] });
    queryClient.invalidateQueries({ queryKey: ['crop-knowledge-list'] });
    queryClient.invalidateQueries({ queryKey: ['crop-knowledge-detail'] });
  };
  const articleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sectionType: article.sectionType,
        language: article.language,
        title: article.title,
        content: { summary: article.body },
        source: article.source || undefined,
        isPublished: article.isPublished,
      };
      return editingKnowledgeId
        ? api.put(`/admin/crop-knowledge/knowledge/${editingKnowledgeId}`, payload)
        : api.post(`/admin/crop-knowledge/crops/${cropId}/knowledge`, payload);
    },
    onSuccess: () => {
      onSuccess();
      setEditingKnowledgeId('');
      setArticle({ sectionType: 'overview', language: 'en', title: '', body: '', source: '', isPublished: false });
    },
    onError: (requestError) => { setNotice(''); setError(errorText(requestError, copy.adminError)); },
  });
  const calendarMutation = useMutation({
    mutationFn: async () => api.post(`/admin/crop-knowledge/crops/${cropId}/calendars`, {
      language: calendar.language,
      state: calendar.state,
      district: calendar.district || undefined,
      season: calendar.season,
      sowingWindow: { start: calendarDates.sowingStart, end: calendarDates.sowingEnd },
      harvestingWindow: { start: calendarDates.harvestStart, end: calendarDates.harvestEnd },
      activities: [],
      source: calendar.source,
      isPublished: true,
    }),
    onSuccess,
    onError: (requestError) => { setNotice(''); setError(errorText(requestError, copy.adminError)); },
  });
  const stageMutation = useMutation({
    mutationFn: async () => api.post(`/admin/crop-knowledge/crops/${cropId}/stages`, {
      language: stage.language,
      sequence: Number(stage.sequence),
      name: stage.name,
      durationDays: stage.durationDays ? Number(stage.durationDays) : undefined,
      details: JSON.parse(stage.details),
      source: stage.source,
      isPublished: true,
    }),
    onSuccess,
    onError: (requestError) => { setNotice(''); setError(errorText(requestError, copy.adminError)); },
  });
  const recommendationMutation = useMutation({
    mutationFn: async () => api.post('/admin/crop-knowledge/recommendations', {
      cropId,
      recommendationType: recommendation.recommendationType,
      state: recommendation.state || undefined,
      details: JSON.parse(recommendation.details),
      source: recommendation.source,
      isPublished: true,
    }),
    onSuccess,
    onError: (requestError) => { setNotice(''); setError(errorText(requestError, copy.adminError)); },
  });
  const cropMutation = useMutation({
    mutationFn: async () => api.post('/admin/crop-knowledge/crops', {
      id: newCrop.id,
      name: newCrop.name,
      categoryId: newCrop.categoryId,
      translations: { te: newCrop.te, hi: newCrop.hi },
      description: {
        en: 'Crop listing. Verified cultivation guidance for this crop has not yet been published.',
        te: 'పంట జాబితా. ధృవీకరించిన సాగు సమాచారం ఇంకా ప్రచురించబడలేదు.',
        hi: 'फसल सूची। सत्यापित खेती की जानकारी अभी प्रकाशित नहीं हुई है।',
      },
    }),
    onSuccess: () => {
      onSuccess();
      setNewCrop({ id: '', name: '', categoryId: '', te: '', hi: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-crop-catalog'] });
    },
    onError: (requestError) => { setNotice(''); setError(errorText(requestError, copy.adminError)); },
  });
  const imageMutation = useMutation({
    mutationFn: async () => {
      if (!imageFile) throw new Error(copy.adminError);
      const body = new FormData();
      body.append('image', imageFile);
      return api.post(`/admin/crop-knowledge/crops/${cropId}/image`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      onSuccess();
      setImageFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-crop-catalog'] });
    },
    onError: (requestError) => { setNotice(''); setError(errorText(requestError, copy.adminError)); },
  });

  const safeSource = (source) => /^https?:\/\//i.test(source || '')
    ? <a href={source} target="_blank" rel="noreferrer">{source}</a>
    : <span>{source}</span>;

  const editArticle = (item) => {
    setCropId(item.cropId);
    setEditingKnowledgeId(item.id);
    setArticle({
      sectionType: item.sectionType,
      language: item.language,
      title: item.title,
      body: item.content?.summary || JSON.stringify(item.content, null, 2),
      source: item.source || '',
      isPublished: item.isPublished,
    });
  };

  const viewRevisions = async (id) => {
    try {
      const revisions = unwrapPayload(await api.get(`/admin/crop-knowledge/knowledge/${id}/revisions`));
      setRevisionDetails({ id, revisions });
      setError('');
    } catch (requestError) {
      setError(errorText(requestError, copy.adminError));
    }
  };

  return (
    <main className="farming-tools farming-tools--admin">
      <header className="farming-tools__header">
        <Link to="/admin"><Logo size="small" /></Link>
        <div className="farming-tools__header-actions"><ModuleLanguageSelector label={copy.language} /><Link className="farming-tools__back" to="/admin"><ArrowLeft size={17} />{copy.dashboard}</Link></div>
      </header>
      <div className="farming-tools__container">
        <div className="farming-tools__intro"><span className="farming-tools__intro-icon"><ShieldCheck size={27} /></span><div><h1>{copy.adminTitle}</h1><p>{copy.adminSubtitle}</p></div></div>
        {(cropsQuery.isError || categoriesQuery.isError) && <p className="farming-tools__error" role="alert">{copy.adminListError}</p>}
        {notice && <p className="farming-tools__success" role="status">{notice}</p>}
        {error && <p className="farming-tools__error" role="alert">{error}</p>}

        <section className="farming-tools__card farming-tools__admin-card">
          <div className="farming-tools__section-heading"><h2>{copy.article}</h2><BookOpen size={19} /></div>
          <form className="farming-tools__form" onSubmit={(event) => { event.preventDefault(); articleMutation.mutate(); }}>
            <label className="farming-tools__field"><span>{copy.selectCrop}</span><select required value={cropId} onChange={(event) => setCropId(event.target.value)}>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></label>
            <label className="farming-tools__field"><span>{copy.section}</span><select value={article.sectionType} onChange={(event) => setArticle((state) => ({ ...state, sectionType: event.target.value }))}>{sectionTypes.map((section) => <option key={section} value={section}>{section}</option>)}</select></label>
            <label className="farming-tools__field"><span>{copy.languageLabel}</span><select value={article.language} onChange={(event) => setArticle((state) => ({ ...state, language: event.target.value }))}><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिन्दी</option></select></label>
            <label className="farming-tools__field"><span>{copy.title}</span><input required maxLength={180} value={article.title} onChange={(event) => setArticle((state) => ({ ...state, title: event.target.value }))} /></label>
            <label className="farming-tools__field farming-tools__field--wide"><span>{copy.body}</span><textarea required rows="5" value={article.body} onChange={(event) => setArticle((state) => ({ ...state, body: event.target.value }))} /></label>
            <label className="farming-tools__field farming-tools__field--wide"><span>{copy.sourceUrl}</span><input maxLength={1000} value={article.source} onChange={(event) => setArticle((state) => ({ ...state, source: event.target.value }))} /></label>
            <label className="farming-tools__check farming-tools__field--wide"><input type="checkbox" checked={article.isPublished} onChange={(event) => setArticle((state) => ({ ...state, isPublished: event.target.checked }))} /><span>{copy.publish}</span></label>
            <button type="submit" className="farming-tools__primary" disabled={!cropId || articleMutation.isPending}><Save size={17} />{editingKnowledgeId ? 'Update article' : copy.save}</button>
            {editingKnowledgeId && <button type="button" className="farming-tools__secondary" onClick={() => { setEditingKnowledgeId(''); setArticle({ sectionType: 'overview', language: 'en', title: '', body: '', source: '', isPublished: false }); }}>Cancel edit</button>}
          </form>
        </section>

        <section className="farming-tools__card farming-tools__admin-card">
          <div className="farming-tools__section-heading"><h2>{copy.createCalendar}</h2><CalendarDays size={19} /></div>
          <form className="farming-tools__form" onSubmit={(event) => { event.preventDefault(); calendarMutation.mutate(); }}>
            <label className="farming-tools__field"><span>{copy.selectCrop}</span><select required value={cropId} onChange={(event) => setCropId(event.target.value)}>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></label>
            <label className="farming-tools__field"><span>{copy.languageLabel}</span><select value={calendar.language} onChange={(event) => setCalendar((state) => ({ ...state, language: event.target.value }))}><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिन्दी</option></select></label>
            <label className="farming-tools__field"><span>{copy.state}</span><input required value={calendar.state} onChange={(event) => setCalendar((state) => ({ ...state, state: event.target.value }))} /></label>
            <label className="farming-tools__field"><span>{copy.district}</span><input value={calendar.district} onChange={(event) => setCalendar((state) => ({ ...state, district: event.target.value }))} /></label>
            <label className="farming-tools__field"><span>{copy.season}</span><input required value={calendar.season} onChange={(event) => setCalendar((state) => ({ ...state, season: event.target.value }))} /></label>
            {[['sowingStart', 'sowingStart'], ['sowingEnd', 'sowingEnd'], ['harvestStart', 'harvestStart'], ['harvestEnd', 'harvestEnd']].map(([key, label]) => <label className="farming-tools__field" key={key}><span>{copy[label]}</span><input required value={calendarDates[key]} onChange={(event) => setCalendarDates((state) => ({ ...state, [key]: event.target.value }))} /></label>)}
            <label className="farming-tools__field farming-tools__field--wide"><span>{copy.sourceUrl}</span><input required value={calendar.source} onChange={(event) => setCalendar((state) => ({ ...state, source: event.target.value }))} /></label>
            <button type="submit" className="farming-tools__primary" disabled={!cropId || calendarMutation.isPending}><CalendarDays size={17} />{copy.saveCalendar}</button>
          </form>
        </section>

        <section className="farming-tools__card farming-tools__admin-card">
          <div className="farming-tools__section-heading"><h2>{copy.growthStages}</h2><SproutIcon /></div>
          <form className="farming-tools__form" onSubmit={(event) => { event.preventDefault(); stageMutation.mutate(); }}>
            <label className="farming-tools__field"><span>{copy.selectCrop}</span><select required value={cropId} onChange={(event) => setCropId(event.target.value)}>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></label>
            <label className="farming-tools__field"><span>{copy.languageLabel}</span><select value={stage.language} onChange={(event) => setStage((state) => ({ ...state, language: event.target.value }))}><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिन्दी</option></select></label>
            <label className="farming-tools__field"><span>Stage order</span><input type="number" min="1" max="100" step="1" required value={stage.sequence} onChange={(event) => setStage((state) => ({ ...state, sequence: event.target.value }))} /></label>
            <label className="farming-tools__field"><span>Stage name</span><input required maxLength={160} value={stage.name} onChange={(event) => setStage((state) => ({ ...state, name: event.target.value }))} /></label>
            <label className="farming-tools__field"><span>Duration in days (optional)</span><input type="number" min="1" max="1000" step="1" value={stage.durationDays} onChange={(event) => setStage((state) => ({ ...state, durationDays: event.target.value }))} /></label>
            <label className="farming-tools__field farming-tools__field--wide"><span>Stage details (JSON object)</span><textarea required rows="4" value={stage.details} onChange={(event) => setStage((state) => ({ ...state, details: event.target.value }))} /></label>
            <label className="farming-tools__field farming-tools__field--wide"><span>{copy.sourceUrl}</span><input required value={stage.source} onChange={(event) => setStage((state) => ({ ...state, source: event.target.value }))} /></label>
            <button type="submit" className="farming-tools__primary" disabled={!cropId || stageMutation.isPending}><Save size={17} />{copy.save}</button>
          </form>
        </section>

        <section className="farming-tools__card farming-tools__admin-card">
          <div className="farming-tools__section-heading"><h2>{copy.verifiedRecommendations}</h2><BookOpen size={19} /></div>
          <form className="farming-tools__form" onSubmit={(event) => { event.preventDefault(); recommendationMutation.mutate(); }}>
            <label className="farming-tools__field"><span>{copy.selectCrop}</span><select required value={cropId} onChange={(event) => setCropId(event.target.value)}>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></label>
            <label className="farming-tools__field"><span>{copy.calculators}</span><select value={recommendation.recommendationType} onChange={(event) => setRecommendation((state) => ({ ...state, recommendationType: event.target.value }))}>{['seed', 'fertilizer', 'irrigation', 'spacing', 'yield'].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="farming-tools__field"><span>{copy.state}</span><input value={recommendation.state} onChange={(event) => setRecommendation((state) => ({ ...state, state: event.target.value }))} /></label>
            <label className="farming-tools__field farming-tools__field--wide"><span>Recommendation details (JSON object)</span><textarea required rows="4" value={recommendation.details} onChange={(event) => setRecommendation((state) => ({ ...state, details: event.target.value }))} /></label>
            <label className="farming-tools__field farming-tools__field--wide"><span>{copy.sourceUrl}</span><input required value={recommendation.source} onChange={(event) => setRecommendation((state) => ({ ...state, source: event.target.value }))} /></label>
            <button type="submit" className="farming-tools__primary" disabled={!cropId || recommendationMutation.isPending}><Save size={17} />{copy.save}</button>
          </form>
        </section>

        <section className="farming-tools__card farming-tools__admin-card">
          <div className="farming-tools__section-heading"><h2>{copy.selectCrop}</h2><SproutIcon /></div>
          <form className="farming-tools__form" onSubmit={(event) => { event.preventDefault(); cropMutation.mutate(); }}>
            <label className="farming-tools__field"><span>Crop ID (slug)</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={newCrop.id} onChange={(event) => setNewCrop((state) => ({ ...state, id: event.target.value }))} /></label>
            <label className="farming-tools__field"><span>{copy.title}</span><input required maxLength={120} value={newCrop.name} onChange={(event) => setNewCrop((state) => ({ ...state, name: event.target.value }))} /></label>
            <label className="farming-tools__field"><span>{copy.categories}</span><select required value={newCrop.categoryId} onChange={(event) => setNewCrop((state) => ({ ...state, categoryId: event.target.value }))}><option value="">—</option>{(categoriesQuery.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="farming-tools__field"><span>తెలుగు</span><input value={newCrop.te} onChange={(event) => setNewCrop((state) => ({ ...state, te: event.target.value }))} /></label>
            <label className="farming-tools__field"><span>हिन्दी</span><input value={newCrop.hi} onChange={(event) => setNewCrop((state) => ({ ...state, hi: event.target.value }))} /></label>
            <button type="submit" className="farming-tools__primary" disabled={cropMutation.isPending}><Save size={17} />{copy.save}</button>
          </form>
        </section>

        <section className="farming-tools__card farming-tools__admin-card">
          <div className="farming-tools__section-heading"><h2>{copy.selectCrop}</h2><ImagePlus size={19} /></div>
          <form className="farming-tools__form" onSubmit={(event) => { event.preventDefault(); imageMutation.mutate(); }}>
            <label className="farming-tools__field"><span>{copy.selectCrop}</span><select value={cropId} onChange={(event) => setCropId(event.target.value)}>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></label>
            <label className="farming-tools__field"><span>Image (JPEG, PNG, WebP; max 8 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] || null)} /></label>
            <button type="submit" className="farming-tools__primary" disabled={!imageFile || imageMutation.isPending}><ImagePlus size={17} />Upload image</button>
          </form>
        </section>

        <section className="farming-tools__card farming-tools__admin-card">
          <h2>{copy.knowledge}</h2>
          {knowledgeQuery.isPending ? <p>{copy.loading}</p> : knowledgeQuery.isError ? <p role="alert">{copy.adminListError}</p> : (knowledgeQuery.data || []).length === 0 ? <p>{copy.notPublished}</p> : (
            <ul className="crop-admin__list">{knowledgeQuery.data.map((item) => <li key={item.id}><strong>{item.Crop?.name} · {item.title}</strong><span>{item.isPublished ? 'Published' : 'Draft'} · {item.language}</span>{safeSource(item.source)}<div><button type="button" className="farming-tools__secondary" onClick={() => editArticle(item)}>Edit</button><button type="button" className="farming-tools__secondary" onClick={() => viewRevisions(item.id)}>Revisions</button></div></li>)}</ul>
          )}
          {revisionDetails?.revisions?.length > 0 && <div className="crop-admin__revisions"><h3>Revision history</h3>{revisionDetails.revisions.map((revision) => <details key={revision.id}><summary>Version {revision.version} · {new Date(revision.createdAt).toLocaleString()}</summary><pre>{JSON.stringify(revision.snapshot, null, 2)}</pre></details>)}</div>}
        </section>
      </div>
    </main>
  );
}

function SproutIcon() {
  return <BookOpen size={19} aria-hidden="true" />;
}
