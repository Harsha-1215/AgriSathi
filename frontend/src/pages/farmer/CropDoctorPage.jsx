import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Camera, Check, CloudUpload, Leaf, LoaderCircle,
  MessageCircle, RotateCcw, Search, ShieldCheck, Stethoscope, Trash2, Upload,
  Volume2, X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../context/LanguageContext';
import moduleContent from '../../data/moduleContent';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusSummary({ result, copy }) {
  const content = {
    possible_issue: { title: copy.possible, status: 'warning', icon: AlertTriangle },
    image_unclear: { title: copy.unclear, status: 'warning', icon: Camera },
    no_reliable_match: { title: copy.noMatch, status: 'warning', icon: AlertTriangle },
    healthy_looking: { title: copy.healthy, status: 'success', icon: ShieldCheck },
    analysis_unavailable: { title: copy.error, status: 'warning', icon: AlertTriangle },
  }[result.analysisStatus] || { title: copy.result, status: 'warning', icon: AlertTriangle };
  const Icon = content.icon;
  const explanatory = {
    image_unclear: copy.unclearText,
    no_reliable_match: copy.noMatchText,
    healthy_looking: copy.healthyText,
  }[result.analysisStatus];
  return (
    <div className={`crop-result-status crop-result-status--${content.status}`} role="status">
      <Icon size={22} />
      <div><h3>{content.title}</h3>{explanatory && <p>{explanatory}</p>}</div>
    </div>
  );
}

export default function CropDoctorPage() {
  const { lang } = useLanguage();
  const copy = moduleContent[lang]?.crop || moduleContent.en.crop;
  const queryClient = useQueryClient();
  const [crop, setCrop] = useState('');
  const [file, setFile] = useState(null);
  const [externalConsent, setExternalConsent] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [consulting, setConsulting] = useState(false);
  const [description, setDescription] = useState('');
  const [consultationState, setConsultationState] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const cropsQuery = useQuery({
    queryKey: ['crop-doctor-crops'],
    queryFn: async () => unwrapPayload(await api.get('/crop-doctor/crops')),
    retry: false,
  });
  const crops = cropsQuery.data || [];
  const selectedCrop = crops.find((item) => item.id === crop);
  const historyQuery = useQuery({
    queryKey: ['crop-doctor-history', search, fromDate, toDate],
    queryFn: async () => unwrapPayload(await api.get('/crop-doctor/history', {
      params: { crop: search || undefined, from: fromDate || undefined, to: toDate || undefined, limit: 30 },
    })),
    retry: false,
  });
  const diseasesQuery = useQuery({
    queryKey: ['crop-doctor-diseases', crop],
    queryFn: async () => unwrapPayload(await api.get('/crop-doctor/diseases', { params: { crop: selectedCrop?.name } })),
    enabled: Boolean(selectedCrop),
    retry: false,
  });

  const history = historyQuery.data?.items || [];
  const verifiedDiseases = diseasesQuery.data?.items || [];
  const canAnalyze = Boolean(file && selectedCrop);

  function chooseFile(nextFile) {
    setError('');
    if (!nextFile) return;
    if (!allowedTypes.has(nextFile.type)) {
      setError(copy.invalidImage);
      return;
    }
    if (nextFile.size > 8 * 1024 * 1024) {
      setError(copy.maxSize);
      return;
    }
    setFile(nextFile);
    setExternalConsent(false);
    setResult(null);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function analyze(event) {
    event.preventDefault();
    setError('');
    if (!selectedCrop || !file) {
      setError(copy.noSelection);
      return;
    }
    const form = new FormData();
    form.append('cropId', selectedCrop.id);
    form.append('language', lang);
    form.append('image', file);
    form.append('externalProcessingConsent', 'true');
    setBusy(true);
    try {
      const data = unwrapPayload(await api.post('/crop-doctor/analyze', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }));
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['crop-doctor-history'] });
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.error));
    } finally {
      setBusy(false);
    }
  }

  async function openReport(id) {
    setError('');
    try {
      setResult(unwrapPayload(await api.get(`/crop-doctor/history/${id}`)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.error));
    }
  }

  async function deleteReport(event, id) {
    event.stopPropagation();
    if (!window.confirm(copy.confirmDelete)) return;
    try {
      await api.delete(`/crop-doctor/history/${id}`);
      if (result?.id === id) setResult(null);
      queryClient.invalidateQueries({ queryKey: ['crop-doctor-history'] });
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.error));
    }
  }

  async function sendConsultation(event) {
    event.preventDefault();
    setConsultationState('');
    setError('');
    try {
      await api.post('/crop-doctor/consultation', {
        diagnosisId: result.id,
        description,
        includeImage: false,
      });
      setConsultationState(copy.consultationSent);
      setConsulting(false);
      setDescription('');
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.error));
    }
  }

  function speakExplanation() {
    if (!result?.aiExplanation || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(result.aiExplanation);
    utterance.lang = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' }[lang];
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="agri-module-page crop-page">
      <header className="module-topbar">
        <Link to="/farmer/dashboard" className="module-brand" aria-label="AGRISATHI dashboard"><Logo size="small" /></Link>
        <div className="module-topbar__title"><Stethoscope size={21} /><h1>{copy.title}</h1></div>
        <div className="module-topbar__actions"><ModuleLanguageSelector label={lang === 'te' ? 'భాష' : lang === 'hi' ? 'भाषा' : 'Language'} /><Link className="module-back-link" to="/farmer/dashboard"><ArrowLeft size={16} />{copy.dashboard}</Link></div>
      </header>

      <main className="crop-layout">
        <section className="crop-intro">
          <div className="crop-intro__icon"><Leaf size={32} /></div>
          <div><h2>{copy.title}</h2><p>{copy.subtitle}</p></div>
        </section>

        <div className="crop-grid">
          <section className="module-card crop-upload-card">
            <h2>{copy.image}</h2>
            <form onSubmit={analyze}>
              <label className="crop-field">
                <span>{copy.crop}</span>
                <select value={crop} onChange={(event) => { setCrop(event.target.value); setExternalConsent(false); setResult(null); setError(''); }} required>
                  <option value="">{copy.chooseCrop}</option>
                  {crops.map((item) => <option key={item.id} value={item.id}>{item.translations?.[lang] || item.name}</option>)}
                </select>
              </label>
              {previewUrl ? (
                <div className="crop-image-preview">
                  <img src={previewUrl} alt={`${selectedCrop?.translations?.[lang] || selectedCrop?.name || 'Crop'} preview`} />
                  <div className="crop-image-preview__actions">
                    <button type="button" onClick={() => inputRef.current?.click()}><RotateCcw size={16} />{copy.replace}</button>
                    <button type="button" onClick={() => { setFile(null); setResult(null); }}><X size={16} />{copy.remove}</button>
                  </div>
                </div>
              ) : (
                <div className={`crop-dropzone${dragging ? ' is-dragging' : ''}`}
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}>
                  <CloudUpload size={30} />
                  <strong>{copy.drop}</strong>
                  <span>{copy.formats}</span>
                  <div className="crop-dropzone__buttons">
                    <button type="button" onClick={() => inputRef.current?.click()}><Upload size={17} />{copy.upload}</button>
                    <button type="button" onClick={() => { if (inputRef.current) { inputRef.current.setAttribute('capture', 'environment'); inputRef.current.click(); } }}><Camera size={17} />{copy.camera}</button>
                  </div>
                </div>
              )}
              <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                chooseFile(event.target.files?.[0]);
                event.currentTarget.removeAttribute('capture');
                event.currentTarget.value = '';
              }} />
              <p className="crop-instructions">{copy.instructions}</p>
              <div className="crop-external-consent">
                <label>
                  <input
                    type="checkbox"
                    checked={externalConsent}
                    disabled={!file || busy}
                    onChange={(event) => setExternalConsent(event.target.checked)}
                    required
                  />
                  <span>{copy.externalConsentLabel}</span>
                </label>
                <p>{copy.externalConsentNotice}</p>
              </div>
              {error && <p className="module-alert" role="alert">{error}</p>}
              <button className="module-primary-button" type="submit" disabled={busy || !canAnalyze || !externalConsent}>
                {busy ? <><LoaderCircle className="module-spin" size={18} />{copy.analyzing}</> : <><Search size={18} />{copy.analyze}</>}
              </button>
            </form>
          </section>

          <div className="crop-right-column">
            {result ? (
              <section className="module-card crop-result-card" aria-live="polite">
                <div className="module-card__heading"><h2>{copy.result}</h2><button className="module-icon-button" type="button" aria-label={copy.remove} onClick={() => setResult(null)}><X size={18} /></button></div>
                <StatusSummary result={result} copy={copy} />
                {result.externalProcessingConsent && <p className="crop-external-notice">{copy.externalProcessingNotice}</p>}
                <div className="crop-result-image"><img src={result.imageUrl} alt={`${result.cropName} analysis`} onError={(event) => { event.currentTarget.alt = `${result.cropName} image preview unavailable`; }} /></div>
                <div className="crop-result-meta"><strong>{result.cropName}</strong>{result.createdAt && <time>{formatDate(result.createdAt)}</time>}</div>
                {result.possibleDisease && <h3 className="crop-issue-name">{result.possibleDisease}</h3>}
                {result.severity && <p className={`crop-severity crop-severity--${result.severity}`}>{copy.severity}: {copy[result.severity] || result.severity}</p>}
                {result.observedSymptoms?.length > 0 && <div className="crop-result-section"><h3>{copy.symptoms}</h3><ul>{result.observedSymptoms.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
                {result.aiExplanation && <div className="crop-result-section"><div className="crop-section-heading"><h3>{copy.explanation}</h3><button type="button" onClick={speakExplanation} aria-label={copy.playExplanation}><Volume2 size={17} /></button></div><p>{result.aiExplanation}</p></div>}
                {result.recommendations?.length > 0 && <div className="crop-result-section"><h3>{copy.recommendations}</h3><ul>{result.recommendations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
                <p className="crop-disclaimer"><ShieldCheck size={17} />{copy.disclaimer}</p>
                <button className="module-secondary-button" type="button" onClick={() => { setConsulting(!consulting); setConsultationState(''); }}><MessageCircle size={18} />{copy.consult}</button>
                {consulting && <form className="crop-consult-form" onSubmit={sendConsultation}>
                  <p>{copy.consultationDescription}</p>
                  <textarea rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} aria-label={copy.consultationDescription} />
                  <div><button type="submit" className="module-primary-button"><MessageCircle size={16} />{copy.sendConsultation}</button><button type="button" className="module-text-button" onClick={() => setConsulting(false)}>{copy.cancel}</button></div>
                </form>}
                {consultationState && <p className="module-success" role="status"><Check size={16} />{consultationState}</p>}
              </section>
            ) : (
              <section className="module-card crop-how-card">
                <h2>{copy.instructions}</h2>
                <ul><li>{copy.drop}</li><li>{copy.formats}</li><li>{copy.disclaimer}</li></ul>
              </section>
            )}

            {crop && crop !== 'Other' && (
              <section className="module-card crop-verified-card">
                <h2><ShieldCheck size={18} />{copy.verified}</h2>
                {diseasesQuery.isPending ? <p className="module-muted">{copy.analyzing}</p>
                  : diseasesQuery.isError ? <p className="module-muted">{getErrorMessage(diseasesQuery.error, copy.error)}</p>
                    : verifiedDiseases.length ? verifiedDiseases.map((disease) => <article key={disease.id}>
                      <h3>{disease.name}</h3><p>{disease.description}</p>
                      {disease.symptoms?.length > 0 && <><strong>{copy.verifiedSymptoms}</strong><ul>{disease.symptoms.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></>}
                      {disease.prevention?.length > 0 && <><strong>{copy.prevention}</strong><ul>{disease.prevention.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></>}
                      {disease.verifiedTreatmentGuidance && <><strong>{copy.verifiedTreatment}</strong><p>{disease.verifiedTreatmentGuidance}</p></>}
                    </article>)
                      : <p>{copy.verifiedEmpty}</p>}
              </section>
            )}
          </div>
        </div>

        <section className="module-card crop-history-card">
          <div className="crop-history-filters">
            <h2>{copy.history}</h2>
            <label className="module-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchCrop} /></label>
            <label><span>{copy.fromDate}</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label><span>{copy.toDate}</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
          </div>
          {historyQuery.isPending ? <p className="module-muted" role="status">{copy.analyzing}</p>
            : historyQuery.isError ? <div className="module-alert" role="alert">{getErrorMessage(historyQuery.error, copy.error)} <button type="button" onClick={() => historyQuery.refetch()}>{copy.error}</button></div>
              : history.length ? <div className="crop-history-list">
                {history.map((item) => <article className="crop-history-item" key={item.id} onClick={() => openReport(item.id)} tabIndex={0} role="button" onKeyDown={(event) => { if (event.key === 'Enter') openReport(item.id); }}>
                  <img src={item.imageUrl} alt="" />
                  <div><strong>{item.cropName}</strong><span>{item.possibleDisease || item.analysisStatus.replaceAll('_', ' ')}</span><time>{formatDate(item.createdAt)}</time></div>
                  <button type="button" onClick={(event) => deleteReport(event, item.id)} aria-label={copy.delete}><Trash2 size={17} /></button>
                </article>)}
              </div> : <p className="module-muted">{copy.noHistory}</p>}
        </section>
      </main>
    </div>
  );
}
