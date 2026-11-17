import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, EyeOff, Flag, Landmark, RefreshCw, Video } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Logo from '../../components/common/Logo';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import '../../styles/platform-modules.css';

const emptyScheme = {
  schemeName: '', shortDescription: '', fullDescription: '', department: '',
  governmentLevel: 'central', state: '', categoryId: '', benefitDetails: '{}',
  eligibilityCriteria: '[]', requiredDocuments: '', applicationProcedure: '',
  officialWebsite: '', guidelineUrl: '', applicationStartDate: '', applicationEndDate: '',
  applicationStatus: 'unknown', applicationStatusVerifiedAt: '', statusSource: '',
  source: '', lastVerifiedAt: '', isPublished: false,
};

function parseJson(value, fallback, field) {
  if (!value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${field} must be valid JSON.`);
  }
}

function isoDate(value) {
  return value ? new Date(value).toISOString() : undefined;
}

export default function PlatformAdminPage({ schemes = false }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyScheme);
  const [translation, setTranslation] = useState({ language: 'te', translatedName: '', translatedDescription: '', translatedEligibility: '[]', translatedBenefits: '{}', translatedProcedure: '[]', source: '', verifiedAt: '' });
  const [shortCategory, setShortCategory] = useState({ slug: '', name: '' });
  const [busy, setBusy] = useState(false);

  const videosQuery = useQuery({
    queryKey: ['admin-agri-shorts-videos'],
    queryFn: async () => unwrapPayload(await api.get('/admin/agri-shorts/videos', { params: { status: 'pending' } })),
    enabled: !schemes,
    retry: false,
  });
  const reportsQuery = useQuery({
    queryKey: ['admin-agri-shorts-reports'],
    queryFn: async () => unwrapPayload(await api.get('/admin/agri-shorts/reports', { params: { status: 'open' } })),
    enabled: !schemes,
    retry: false,
  });
  const videoCategoriesQuery = useQuery({
    queryKey: ['admin-agri-shorts-categories'],
    queryFn: async () => unwrapPayload(await api.get('/admin/agri-shorts/categories')),
    enabled: !schemes,
    retry: false,
  });
  const schemesQuery = useQuery({
    queryKey: ['admin-government-schemes'],
    queryFn: async () => unwrapPayload(await api.get('/admin/government-schemes')),
    enabled: schemes,
    retry: false,
  });
  const categoriesQuery = useQuery({
    queryKey: ['admin-scheme-categories'],
    queryFn: async () => unwrapPayload(await api.get('/admin/government-schemes/categories')),
    enabled: schemes,
    retry: false,
  });

  async function moderateVideo(video, status) {
    const reason = status === 'rejected' ? window.prompt('Reason for rejection') : undefined;
    if (status === 'rejected' && !reason) return;
    try {
      await api.put(`/admin/agri-shorts/videos/${video.id}/review`, { status, reason });
      setNotice(`Video ${status}.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-agri-shorts-videos'] });
    } catch (error) {
      setNotice(error?.response?.data?.message || 'Could not update video moderation.');
    }
  }

  async function reviewReport(report, status) {
    const reason = window.prompt('Optional moderation note') || undefined;
    try {
      await api.put(`/admin/agri-shorts/reports/${report.id}`, { status, reason });
      setNotice(`Report marked ${status}.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-agri-shorts-reports'] });
    } catch (error) {
      setNotice(error?.response?.data?.message || 'Could not review report.');
    }
  }

  async function moderateComment(report) {
    const reason = window.prompt('Reason for hiding this comment');
    if (!reason || !report.commentId) return;
    try {
      await api.put(`/admin/agri-shorts/comments/${report.commentId}/moderate`, { status: 'hidden', reason });
      setNotice('Reported comment hidden.');
      await queryClient.invalidateQueries({ queryKey: ['admin-agri-shorts-reports'] });
    } catch (error) {
      setNotice(error?.response?.data?.message || 'Could not moderate comment.');
    }
  }

  async function createVideoCategory(event) {
    event.preventDefault();
    try {
      await api.post('/admin/agri-shorts/categories', shortCategory);
      setShortCategory({ slug: '', name: '' });
      setNotice('Video category created.');
      await queryClient.invalidateQueries({ queryKey: ['admin-agri-shorts-categories'] });
    } catch (error) {
      setNotice(error?.response?.data?.message || 'Could not create category.');
    }
  }

  async function toggleVideoCategory(category) {
    try {
      await api.put(`/admin/agri-shorts/categories/${category.id}`, { isActive: !category.isActive });
      await queryClient.invalidateQueries({ queryKey: ['admin-agri-shorts-categories'] });
    } catch (error) {
      setNotice(error?.response?.data?.message || 'Could not update category.');
    }
  }

  function beginEdit(scheme) {
    setEditing(scheme.id);
    setForm({
      ...emptyScheme,
      ...scheme,
      benefitDetails: JSON.stringify(scheme.benefitDetails || {}, null, 2),
      eligibilityCriteria: JSON.stringify(scheme.eligibilityCriteria || [], null, 2),
      requiredDocuments: (scheme.requiredDocuments || []).join('\n'),
      applicationProcedure: (scheme.applicationProcedure || []).join('\n'),
      applicationStartDate: scheme.applicationStartDate || '',
      applicationEndDate: scheme.applicationEndDate || '',
      applicationStatusVerifiedAt: scheme.applicationStatusVerifiedAt ? new Date(scheme.applicationStatusVerifiedAt).toISOString().slice(0, 16) : '',
      lastVerifiedAt: scheme.lastVerifiedAt ? new Date(scheme.lastVerifiedAt).toISOString().slice(0, 16) : '',
    });
  }

  async function saveScheme(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const payload = {
        ...form,
        benefitDetails: parseJson(form.benefitDetails, {}, 'Benefits'),
        eligibilityCriteria: parseJson(form.eligibilityCriteria, [], 'Eligibility criteria'),
        requiredDocuments: form.requiredDocuments.split('\n').map((item) => item.trim()).filter(Boolean),
        applicationProcedure: form.applicationProcedure.split('\n').map((item) => item.trim()).filter(Boolean),
        applicationStartDate: form.applicationStartDate || null,
        applicationEndDate: form.applicationEndDate || null,
        applicationStatusVerifiedAt: isoDate(form.applicationStatusVerifiedAt),
        lastVerifiedAt: isoDate(form.lastVerifiedAt),
        statusSource: form.applicationStatus === 'unknown' ? null : form.statusSource,
        updateTitle: form.updateTitle || undefined,
        updateSummary: form.updateSummary || undefined,
        updateSource: form.updateSource || undefined,
        updateVerifiedAt: isoDate(form.updateVerifiedAt),
      };
      if (editing) await api.put(`/admin/government-schemes/${editing}`, payload);
      else await api.post('/admin/government-schemes', payload);
      setNotice(editing ? 'Scheme updated.' : 'Draft scheme created.');
      setEditing(null);
      setForm(emptyScheme);
      await queryClient.invalidateQueries({ queryKey: ['admin-government-schemes'] });
    } catch (error) {
      setNotice(error?.response?.data?.message || error.message || 'Could not save scheme.');
    } finally {
      setBusy(false);
    }
  }

  async function publishScheme(scheme, publish) {
    try {
      if (publish) await api.post(`/admin/government-schemes/${scheme.id}/publish`);
      else await api.post(`/admin/government-schemes/${scheme.id}/unpublish`, { reason: 'Unpublished for content review.' });
      setNotice(publish ? 'Scheme published.' : 'Scheme unpublished.');
      await queryClient.invalidateQueries({ queryKey: ['admin-government-schemes'] });
    } catch (error) {
      setNotice(error?.response?.data?.message || 'Could not change publication status.');
    }
  }

  async function addTranslation(event) {
    event.preventDefault();
    if (!editing) {
      setNotice('Save the scheme draft before adding a translation.');
      return;
    }
    try {
      await api.post(`/admin/government-schemes/${editing}/translations`, {
        ...translation,
        translatedEligibility: parseJson(translation.translatedEligibility, [], 'Translated eligibility'),
        translatedBenefits: parseJson(translation.translatedBenefits, {}, 'Translated benefits'),
        translatedProcedure: parseJson(translation.translatedProcedure, [], 'Translated procedure'),
        verifiedAt: isoDate(translation.verifiedAt),
      });
      setNotice('Verified translation saved.');
    } catch (error) {
      setNotice(error?.response?.data?.message || 'Could not save translation.');
    }
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  return (
    <main className="farming-tools platform-module">
      <header className="farming-tools__header"><Link to="/admin/crop-knowledge"><Logo size="small" /></Link><div className="farming-tools__header-actions"><Link className="farming-tools__back" to="/admin/livestock">Livestock</Link><Link className="farming-tools__back" to="/admin/marketplace">Marketplace</Link><Link className="farming-tools__back" to="/admin/crop-knowledge">Admin tools</Link></div></header>
      <div className="farming-tools__container">
        <div className="farming-tools__intro"><span className="farming-tools__intro-icon">{schemes ? <Landmark size={26} /> : <Video size={26} />}</span><div><p className="farming-tools__eyebrow">AGRISATHI ADMIN</p><h1>{schemes ? 'Government Scheme Publishing' : 'Agri Shorts Moderation'}</h1><p>{schemes ? 'Publish only source-verified scheme information. Do not enter unconfirmed benefits or deadlines.' : 'Review videos and community reports before taking action.'}</p></div></div>
        {notice && <p className="platform-notice" role="status">{notice}</p>}

        {schemes ? (
          <div className="platform-admin-layout">
            <section className="platform-panel">
              <h2>{editing ? 'Edit scheme' : 'Create scheme draft'}</h2>
              <form className="platform-form" onSubmit={saveScheme}>
                <label>Scheme name<input name="schemeName" value={form.schemeName} onChange={updateField} required maxLength="240" /></label>
                <label>Short description<textarea name="shortDescription" value={form.shortDescription} onChange={updateField} required maxLength="1500" rows="2" /></label>
                <label>Full description<textarea name="fullDescription" value={form.fullDescription} onChange={updateField} required maxLength="15000" rows="4" /></label>
                <label>Department<input name="department" value={form.department} onChange={updateField} required /></label>
                <label>Government level<select name="governmentLevel" value={form.governmentLevel} onChange={updateField}><option value="central">Central</option><option value="state">State</option></select></label>
                {form.governmentLevel === 'state' && <label>State<input name="state" value={form.state || ''} onChange={updateField} required /></label>}
                <label>Category<select name="categoryId" value={form.categoryId || ''} onChange={updateField} required><option value="">Select a category</option>{(categoriesQuery.data || []).filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>Benefits (JSON object)<textarea name="benefitDetails" value={form.benefitDetails} onChange={updateField} rows="3" /></label>
                <label>Eligibility criteria (JSON list)<textarea name="eligibilityCriteria" value={form.eligibilityCriteria} onChange={updateField} rows="4" /></label>
                <label>Required documents (one per line)<textarea name="requiredDocuments" value={form.requiredDocuments} onChange={updateField} rows="3" /></label>
                <label>Application procedure (one step per line)<textarea name="applicationProcedure" value={form.applicationProcedure} onChange={updateField} rows="3" /></label>
                <label>Official scheme page (HTTPS)<input name="officialWebsite" value={form.officialWebsite || ''} onChange={updateField} type="url" /></label>
                <label>Official source URL (HTTPS)<input name="source" value={form.source} onChange={updateField} type="url" required /></label>
                <label>Guidelines URL (HTTPS)<input name="guidelineUrl" value={form.guidelineUrl || ''} onChange={updateField} type="url" /></label>
                <label>Application status<select name="applicationStatus" value={form.applicationStatus} onChange={updateField}><option value="unknown">Unknown / not verified</option><option value="open">Open</option><option value="closed">Closed</option></select></label>
                {form.applicationStatus !== 'unknown' && <><label>Status source URL<input name="statusSource" value={form.statusSource || ''} onChange={updateField} type="url" required /></label><label>Status verification date<input name="applicationStatusVerifiedAt" value={form.applicationStatusVerifiedAt || ''} onChange={updateField} type="datetime-local" required /></label></>}
                <label>Last information verification<input name="lastVerifiedAt" value={form.lastVerifiedAt || ''} onChange={updateField} type="datetime-local" required /></label>
                <details className="platform-admin-update-fields"><summary>Add a verified public update (optional)</summary><div className="platform-form"><label>Update title<input name="updateTitle" value={form.updateTitle || ''} onChange={updateField} /></label><label>Update summary<textarea name="updateSummary" value={form.updateSummary || ''} onChange={updateField} /></label><label>Update source URL<input name="updateSource" value={form.updateSource || ''} onChange={updateField} type="url" /></label><label>Update verified at<input name="updateVerifiedAt" value={form.updateVerifiedAt || ''} onChange={updateField} type="datetime-local" /></label></div></details>
                <div className="platform-form-row"><label>Application starts<input name="applicationStartDate" value={form.applicationStartDate || ''} onChange={updateField} type="date" /></label><label>Application ends<input name="applicationEndDate" value={form.applicationEndDate || ''} onChange={updateField} type="date" /></label></div>
                <label className="platform-checkbox"><input type="checkbox" name="isPublished" checked={Boolean(form.isPublished)} onChange={updateField} />Publish after saving (requires verified details)</label>
                <div className="platform-admin-actions"><button className="platform-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create scheme'}</button><button className="platform-secondary" type="button" onClick={() => { setEditing(null); setForm(emptyScheme); }}>Clear</button></div>
              </form>
              {editing && <form className="platform-form platform-translation-form" onSubmit={addTranslation}><h3>Add/update a verified translation</h3><label>Language<select value={translation.language} onChange={(event) => setTranslation((value) => ({ ...value, language: event.target.value }))}><option value="te">Telugu</option><option value="hi">Hindi</option></select></label><label>Translated name<input value={translation.translatedName} onChange={(event) => setTranslation((value) => ({ ...value, translatedName: event.target.value }))} required /></label><label>Translated description<textarea value={translation.translatedDescription} onChange={(event) => setTranslation((value) => ({ ...value, translatedDescription: event.target.value }))} required /></label><label>Translated eligibility (JSON list)<textarea value={translation.translatedEligibility} onChange={(event) => setTranslation((value) => ({ ...value, translatedEligibility: event.target.value }))} /></label><label>Translated benefits (JSON object)<textarea value={translation.translatedBenefits} onChange={(event) => setTranslation((value) => ({ ...value, translatedBenefits: event.target.value }))} /></label><label>Translated application steps (JSON list)<textarea value={translation.translatedProcedure} onChange={(event) => setTranslation((value) => ({ ...value, translatedProcedure: event.target.value }))} /></label><label>Verified translation source URL<input type="url" value={translation.source} onChange={(event) => setTranslation((value) => ({ ...value, source: event.target.value }))} required /></label><label>Verified at<input type="datetime-local" value={translation.verifiedAt} onChange={(event) => setTranslation((value) => ({ ...value, verifiedAt: event.target.value }))} required /></label><button className="platform-primary" type="submit">Save verified translation</button></form>}
            </section>
            <section className="platform-panel">
              <div className="platform-admin-heading"><h2>Existing schemes</h2><button className="platform-text-button" type="button" onClick={() => schemesQuery.refetch()}><RefreshCw size={17} />Refresh</button></div>
              {schemesQuery.isPending ? <p role="status">Loading schemes…</p> : schemesQuery.isError ? <p role="alert">Could not load schemes.</p> : (schemesQuery.data || []).map((scheme) => <article className="platform-admin-row" key={scheme.id}><div><strong>{scheme.schemeName}</strong><small>{scheme.department} · {scheme.isPublished ? 'Published' : 'Draft'} · Version {scheme.informationVersion}</small></div><div><button className="platform-text-button" type="button" onClick={() => beginEdit(scheme)}>Edit</button><button className="platform-text-button" type="button" onClick={() => publishScheme(scheme, !scheme.isPublished)}>{scheme.isPublished ? <><EyeOff size={16} />Unpublish</> : <><Eye size={16} />Publish</>}</button></div></article>)}
            </section>
          </div>
        ) : (
          <div className="platform-admin-layout">
            <section className="platform-panel"><div className="platform-admin-heading"><h2>Videos pending review</h2><button className="platform-text-button" type="button" onClick={() => videosQuery.refetch()}><RefreshCw size={17} />Refresh</button></div>
              {videosQuery.isPending ? <p role="status">Loading videos…</p> : videosQuery.isError ? <p role="alert">Could not load review queue.</p> : (videosQuery.data || []).map((video) => <article className="platform-review-card" key={video.id}><video controls preload="metadata" src={video.videoUrl} /><div><h3>{video.title}</h3><p>{video.description}</p><small>{video.creatorDisplayName} · {video.language} · {video.duration}s</small><div className="platform-admin-actions"><button className="platform-primary" type="button" onClick={() => moderateVideo(video, 'approved')}><Check size={17} />Approve</button><button className="platform-secondary" type="button" onClick={() => moderateVideo(video, 'rejected')}>Reject</button></div></div></article>)}</section>
            <section className="platform-panel"><div className="platform-admin-heading"><h2><Flag size={19} />Open reports</h2><button className="platform-text-button" type="button" onClick={() => reportsQuery.refetch()}><RefreshCw size={17} />Refresh</button></div>
              {reportsQuery.isPending ? <p role="status">Loading reports…</p> : reportsQuery.isError ? <p role="alert">Could not load reports.</p> : (reportsQuery.data || []).map((report) => <article className="platform-admin-row" key={report.id}><div><strong>{report.reason} · {report.commentId ? 'Comment' : 'Video'}</strong><small>{report.commentId ? report.AgriVideoComment?.comment : report.AgriVideo?.title}{report.description ? ` — ${report.description}` : ''}</small></div><div>{report.commentId && <button className="platform-text-button" type="button" onClick={() => moderateComment(report)}>Hide comment</button>}<button className="platform-text-button" type="button" onClick={() => reviewReport(report, 'reviewed')}>Reviewed</button><button className="platform-text-button" type="button" onClick={() => reviewReport(report, 'dismissed')}>Dismiss</button></div></article>)}
              <form className="platform-admin-category-form" onSubmit={createVideoCategory}><h3>Video categories</h3><label>Slug<input value={shortCategory.slug} onChange={(event) => setShortCategory((value) => ({ ...value, slug: event.target.value }))} required /></label><label>Name<input value={shortCategory.name} onChange={(event) => setShortCategory((value) => ({ ...value, name: event.target.value }))} required /></label><button className="platform-primary" type="submit">Add category</button></form>
              {(videoCategoriesQuery.data || []).map((category) => <div className="platform-admin-row" key={category.id}><strong>{category.name}</strong><button className="platform-text-button" type="button" onClick={() => toggleVideoCategory(category)}>{category.isActive ? 'Deactivate' : 'Activate'}</button></div>)}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
