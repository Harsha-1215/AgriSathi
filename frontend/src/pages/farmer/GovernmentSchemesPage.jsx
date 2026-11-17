import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, ExternalLink, FileCheck2, Landmark, Search, ShieldCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../context/LanguageContext';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import '../../styles/platform-modules.css';

const copy = {
  en: {
    title: 'Government Schemes', subtitle: 'Find official, source-verified agricultural support information.',
    dashboard: 'Back to dashboard', search: 'Search schemes or departments', all: 'All schemes',
    recommended: 'For you', saved: 'Saved', applications: 'My applications', updates: 'Verified updates',
    categories: 'Categories', level: 'Government level', any: 'Any level', central: 'Central', state: 'State',
    loading: 'Loading schemes…', empty: 'No verified schemes are available for this search.',
    error: 'Could not load scheme information.', retry: 'Try again', details: 'Details',
    verified: 'Last verified', source: 'Official source', status: 'Application status',
    unknown: 'Not currently verified', open: 'Open (recently verified)', closed: 'Closed (recently verified)',
    stale: 'This information may need re-verification. Confirm details with the official department.',
    noTranslation: 'A verified translation is not available; showing the published English information.',
    benefits: 'Benefits', eligibility: 'Eligibility', documents: 'Required documents',
    procedure: 'How to apply', check: 'Check preliminary eligibility', checkNote: 'This guide is not an official decision and does not guarantee approval or payment.',
    likely: 'You may meet the listed criteria', more: 'More information is needed', no: 'One or more listed criteria do not match',
    notConfigured: 'Eligibility requirements have not been configured. Confirm with the official department.',
    save: 'Save scheme', remove: 'Remove saved scheme', track: 'Track my application',
    reference: 'Application reference (optional)', submission: 'Submission date (optional)',
    trackingStatus: 'Status entered by you', notes: 'Private notes', addTracking: 'Add tracking record', deleteTracking: 'Delete tracking record',
    statusDraft: 'Draft', statusSubmitted: 'Submitted', statusUnderReview: 'Under review',
    statusAdditional: 'More information requested', statusApproved: 'Approved', statusRejected: 'Rejected', statusCompleted: 'Completed',
    farmerEntered: 'Farmer-entered tracking only — not an official government status.',
    noApplications: 'You have no tracked applications.', noUpdates: 'No verified updates have been published.',
    yourAnswers: 'Your information', eligibilityResult: 'Preliminary result', official: 'Open official website',
    filterCategory: 'Filter by category', name: 'Scheme', notFound: 'Scheme not found.',
  },
  te: {
    title: 'ప్రభుత్వ పథకాలు', subtitle: 'అధికారిక మూలాలతో ధృవీకరించిన వ్యవసాయ సహాయ సమాచారాన్ని కనుగొనండి.',
    dashboard: 'డాష్‌బోర్డ్‌కు తిరిగి', search: 'పథకాలు లేదా శాఖలను వెతకండి', all: 'అన్ని పథకాలు',
    recommended: 'మీ కోసం', saved: 'భద్రపరచినవి', applications: 'నా దరఖాస్తులు', updates: 'ధృవీకరించిన నవీకరణలు',
    categories: 'వర్గాలు', level: 'ప్రభుత్వ స్థాయి', any: 'ఏ స్థాయైనా', central: 'కేంద్రం', state: 'రాష్ట్రం',
    loading: 'పథకాలు లోడ్ అవుతున్నాయి…', empty: 'ఈ వెతుకులాటకు ధృవీకరించిన పథకాలు అందుబాటులో లేవు.',
    error: 'పథక సమాచారాన్ని లోడ్ చేయలేకపోయాం.', retry: 'మళ్లీ ప్రయత్నించండి', details: 'వివరాలు',
    verified: 'చివరిగా ధృవీకరించిన తేదీ', source: 'అధికారిక మూలం', status: 'దరఖాస్తు స్థితి',
    unknown: 'ప్రస్తుతం ధృవీకరించలేదు', open: 'తెరిచి ఉంది (ఇటీవల ధృవీకరించబడింది)', closed: 'మూసివేశారు (ఇటీవల ధృవీకరించబడింది)',
    stale: 'ఈ సమాచారం మళ్లీ ధృవీకరించాల్సి ఉండవచ్చు. అధికారిక శాఖతో నిర్ధారించండి.',
    noTranslation: 'ధృవీకరించిన అనువాదం లేదు; ప్రచురించిన ఆంగ్ల సమాచారాన్ని చూపుతున్నాం.',
    benefits: 'ప్రయోజనాలు', eligibility: 'అర్హత', documents: 'అవసరమైన పత్రాలు',
    procedure: 'దరఖాస్తు విధానం', check: 'ప్రాథమిక అర్హతను చూడండి', checkNote: 'ఇది అధికారిక నిర్ణయం కాదు; ఆమోదం లేదా చెల్లింపుకు హామీ ఇవ్వదు.',
    likely: 'మీరు పేర్కొన్న అర్హతలను కలిగి ఉండవచ్చు', more: 'మరింత సమాచారం అవసరం', no: 'ఒకటి లేదా అంతకంటే ఎక్కువ అర్హతలు సరిపోలలేదు',
    notConfigured: 'అర్హతలు ఇంకా నమోదు కాలేదు. అధికారిక శాఖతో నిర్ధారించండి.',
    save: 'పథకాన్ని భద్రపరచండి', remove: 'భద్రపరచిన పథకాన్ని తొలగించండి', track: 'నా దరఖాస్తును నమోదు చేయండి',
    reference: 'దరఖాస్తు సూచన సంఖ్య (ఐచ్ఛికం)', submission: 'సమర్పించిన తేదీ (ఐచ్ఛికం)',
    trackingStatus: 'మీరు నమోదు చేసిన స్థితి', notes: 'వ్యక్తిగత గమనికలు', addTracking: 'నమోదును జోడించండి', deleteTracking: 'ట్రాకింగ్ నమోదును తొలగించండి',
    statusDraft: 'ముసాయిదా', statusSubmitted: 'సమర్పించారు', statusUnderReview: 'పరిశీలనలో ఉంది',
    statusAdditional: 'మరింత సమాచారం కోరారు', statusApproved: 'ఆమోదించారు', statusRejected: 'తిరస్కరించారు', statusCompleted: 'పూర్తయింది',
    farmerEntered: 'రైతు నమోదు చేసిన ట్రాకింగ్ మాత్రమే — ఇది అధికారిక ప్రభుత్వ స్థితి కాదు.',
    noApplications: 'మీరు ఇంకా దరఖాస్తులను నమోదు చేయలేదు.', noUpdates: 'ధృవీకరించిన నవీకరణలు లేవు.',
    yourAnswers: 'మీ సమాచారం', eligibilityResult: 'ప్రాథమిక ఫలితం', official: 'అధికారిక వెబ్‌సైట్ తెరవండి',
    filterCategory: 'వర్గం ద్వారా వడపోసండి', name: 'పథకం', notFound: 'పథకం కనబడలేదు.',
  },
  hi: {
    title: 'सरकारी योजनाएँ', subtitle: 'आधिकारिक स्रोत से सत्यापित कृषि सहायता जानकारी खोजें।',
    dashboard: 'डैशबोर्ड पर वापस', search: 'योजना या विभाग खोजें', all: 'सभी योजनाएँ',
    recommended: 'आपके लिए', saved: 'सहेजी गई', applications: 'मेरे आवेदन', updates: 'सत्यापित अपडेट',
    categories: 'श्रेणियाँ', level: 'सरकारी स्तर', any: 'कोई भी स्तर', central: 'केंद्र', state: 'राज्य',
    loading: 'योजनाएँ लोड हो रही हैं…', empty: 'इस खोज के लिए कोई सत्यापित योजना उपलब्ध नहीं है।',
    error: 'योजना की जानकारी लोड नहीं हुई।', retry: 'फिर प्रयास करें', details: 'विवरण',
    verified: 'अंतिम सत्यापन', source: 'आधिकारिक स्रोत', status: 'आवेदन स्थिति',
    unknown: 'अभी सत्यापित नहीं', open: 'खुला (हाल में सत्यापित)', closed: 'बंद (हाल में सत्यापित)',
    stale: 'इस जानकारी के दोबारा सत्यापन की आवश्यकता हो सकती है। आधिकारिक विभाग से पुष्टि करें।',
    noTranslation: 'सत्यापित अनुवाद उपलब्ध नहीं है; प्रकाशित अंग्रेज़ी जानकारी दिखाई जा रही है।',
    benefits: 'लाभ', eligibility: 'पात्रता', documents: 'आवश्यक दस्तावेज़',
    procedure: 'आवेदन कैसे करें', check: 'प्रारंभिक पात्रता जाँचें', checkNote: 'यह आधिकारिक निर्णय नहीं है और स्वीकृति या भुगतान की गारंटी नहीं देता।',
    likely: 'आप सूचीबद्ध मानदंडों पर खरे उतर सकते हैं', more: 'अधिक जानकारी आवश्यक है', no: 'एक या अधिक मानदंड मेल नहीं खाते',
    notConfigured: 'पात्रता मानदंड दर्ज नहीं हैं। आधिकारिक विभाग से पुष्टि करें।',
    save: 'योजना सहेजें', remove: 'सहेजी योजना हटाएँ', track: 'मेरा आवेदन ट्रैक करें',
    reference: 'आवेदन संदर्भ (वैकल्पिक)', submission: 'जमा करने की तारीख (वैकल्पिक)',
    trackingStatus: 'आपके द्वारा दर्ज स्थिति', notes: 'निजी नोट्स', addTracking: 'ट्रैकिंग जोड़ें', deleteTracking: 'ट्रैकिंग रिकॉर्ड हटाएँ',
    statusDraft: 'मसौदा', statusSubmitted: 'जमा किया', statusUnderReview: 'समीक्षा में',
    statusAdditional: 'अधिक जानकारी मांगी', statusApproved: 'स्वीकृत', statusRejected: 'अस्वीकृत', statusCompleted: 'पूर्ण',
    farmerEntered: 'केवल किसान द्वारा दर्ज ट्रैकिंग — यह आधिकारिक सरकारी स्थिति नहीं है।',
    noApplications: 'आपने कोई आवेदन ट्रैक नहीं किया है।', noUpdates: 'कोई सत्यापित अपडेट प्रकाशित नहीं हुआ।',
    yourAnswers: 'आपकी जानकारी', eligibilityResult: 'प्रारंभिक परिणाम', official: 'आधिकारिक वेबसाइट खोलें',
    filterCategory: 'श्रेणी से फ़िल्टर करें', name: 'योजना', notFound: 'योजना नहीं मिली।',
  },
};

const statusKeys = {
  draft: 'statusDraft', submitted: 'statusSubmitted', under_review: 'statusUnderReview',
  additional_information_required: 'statusAdditional', approved: 'statusApproved',
  rejected: 'statusRejected', completed: 'statusCompleted',
};

function displayList(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : item?.label || JSON.stringify(item));
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}: ${typeof item === 'string' ? item : JSON.stringify(item)}`);
  return value ? [String(value)] : [];
}

async function updateTracking(application, status) {
  try {
    await api.put(`/scheme-applications/${application.id}`, { status });
    await queryClient.invalidateQueries({ queryKey: ['government-schemes', 'applications'] });
  } catch (error) {
    setNotice(error?.response?.data?.message || labels.error);
  }
}

async function deleteTracking(application) {
  try {
    await api.delete(`/scheme-applications/${application.id}`);
    await queryClient.invalidateQueries({ queryKey: ['government-schemes', 'applications'] });
  } catch (error) {
    setNotice(error?.response?.data?.message || labels.error);
  }
}

export default function GovernmentSchemesPage() {
  const { lang } = useLanguage();
  const labels = copy[lang] || copy.en;
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [answers, setAnswers] = useState({});
  const [eligibility, setEligibility] = useState(null);
  const [notice, setNotice] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['scheme-categories', lang],
    queryFn: async () => unwrapPayload(await api.get('/government-schemes/categories', { params: { language: lang } })),
    retry: false,
  });
  const listingQuery = useQuery({
    queryKey: ['government-schemes', view, search, category, level, lang],
    queryFn: async () => {
      if (view === 'saved') return unwrapPayload(await api.get('/government-schemes/saved', { params: { language: lang } }));
      if (view === 'recommended') return unwrapPayload(await api.get('/government-schemes/recommended', { params: { language: lang } }));
      if (view === 'updates') return unwrapPayload(await api.get('/government-schemes/updates', { params: { language: lang } }));
      if (view === 'applications') return unwrapPayload(await api.get('/scheme-applications'));
      return unwrapPayload(await api.get('/government-schemes', { params: { q: search || undefined, category: category || undefined, level: level || undefined, language: lang } }));
    },
    enabled: !id,
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: ['government-scheme', id, lang],
    queryFn: async () => unwrapPayload(await api.get(`/government-schemes/${id}`, { params: { language: lang } })),
    enabled: Boolean(id),
    retry: false,
  });
  const categories = categoriesQuery.data || [];
  const detail = detailQuery.data;
  const list = useMemo(() => {
    if (view === 'saved') return (listingQuery.data || []).map((item) => ({ ...item.scheme, isSaved: true, savedId: item.savedId }));
    if (view === 'updates') return listingQuery.data || [];
    if (view === 'applications') return listingQuery.data || [];
    if (view === 'recommended') return listingQuery.data || [];
    return listingQuery.data?.items || [];
  }, [listingQuery.data, view]);

  async function toggleSaved(scheme) {
    setNotice('');
    try {
      if (scheme.isSaved) await api.delete(`/government-schemes/saved/${scheme.savedId}`);
      else await api.post('/government-schemes/saved', { schemeId: scheme.id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['government-schemes'] }),
        queryClient.invalidateQueries({ queryKey: ['government-scheme', scheme.id] }),
      ]);
    } catch (error) {
      setNotice(error?.response?.data?.message || labels.error);
    }
  }

  async function checkEligibility(event) {
    event.preventDefault();
    try {
      setEligibility(unwrapPayload(await api.post(`/government-schemes/${id}/check-eligibility`, { answers })));
    } catch (error) {
      setNotice(error?.response?.data?.message || labels.error);
    }
  }

  async function trackApplication(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api.post('/scheme-applications', {
        schemeId: detail.id,
        applicationReference: form.elements.reference.value || undefined,
        submissionDate: form.elements.date.value || undefined,
        status: form.elements.status.value,
        notes: form.elements.notes.value || undefined,
      });
      setNotice(labels.farmerEntered);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['government-schemes', 'applications'] });
    } catch (error) {
      setNotice(error?.response?.data?.message || labels.error);
    }
  }

  const statusText = (status) => status === 'open' ? labels.open : status === 'closed' ? labels.closed : labels.unknown;
  const schemeCard = (scheme) => {
    const item = scheme.scheme || scheme;
    if (!item) return null;
    const saved = item.isSaved || Boolean(item.savedId);
    return (
      <article className="platform-scheme-card" key={item.id || scheme.id}>
        <div className="platform-scheme-card__icon"><Landmark size={22} /></div>
        <div className="platform-scheme-card__body">
          <div className="platform-scheme-card__meta"><span>{item.category?.name || item.department}</span><span>{item.governmentLevel === 'state' ? `${labels.state}: ${item.state}` : labels.central}</span></div>
          <h2>{item.schemeName || scheme.title}</h2>
          <p>{item.shortDescription || scheme.summary}</p>
          {view === 'applications' && scheme.status && <><span className="platform-status">{labels[statusKeys[scheme.status]] || scheme.status}</span><small>{labels.farmerEntered}</small></>}
          {view !== 'applications' && item.applicationStatus && <span className={`platform-status platform-status--${item.applicationStatus}`}>{statusText(item.applicationStatus)}</span>}
          <div className="platform-scheme-card__actions">
            {item.id && <Link className="platform-text-button" to={`/farmer/government-schemes/${item.id}`}>{labels.details} →</Link>}
            {item.id && <button className="platform-text-button" type="button" onClick={() => toggleSaved(item)}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? labels.remove : labels.save}</button>}
            {scheme.verifiedAt && <small>{new Date(scheme.verifiedAt).toLocaleDateString()}</small>}
          </div>
          {view === 'applications' && <div className="platform-application-controls"><label>{labels.trackingStatus}<select value={scheme.status} onChange={(event) => updateTracking(scheme, event.target.value)}>{Object.entries(statusKeys).map(([value, key]) => <option key={value} value={value}>{labels[key]}</option>)}</select></label><button className="platform-text-button" type="button" onClick={() => deleteTracking(scheme)}>{labels.deleteTracking}</button></div>}
        </div>
      </article>
    );
  };

  return (
    <main className="farming-tools platform-module">
      <header className="farming-tools__header">
        <Link to="/farmer/dashboard"><Logo size="small" /></Link>
        <div className="farming-tools__header-actions"><ModuleLanguageSelector label={labels.title} /><Link className="farming-tools__back" to="/farmer/dashboard">{labels.dashboard}</Link></div>
      </header>
      <div className="farming-tools__container">
        <div className="farming-tools__intro"><span className="farming-tools__intro-icon"><Landmark size={27} /></span><div><p className="farming-tools__eyebrow">AGRISATHI</p><h1>{labels.title}</h1><p>{labels.subtitle}</p></div></div>
        {notice && <p className="platform-notice" role="status">{notice}</p>}

        {id ? (
          detailQuery.isPending ? <p className="farming-tools__loading" role="status">{labels.loading}</p>
            : detailQuery.isError || !detail ? <div className="platform-notice" role="alert">{labels.notFound}<button type="button" onClick={() => navigate('/farmer/government-schemes')}>{labels.all}</button></div>
              : (
                <div className="platform-layout platform-layout--detail">
                  <section className="platform-panel">
                    <button className="platform-text-button" type="button" onClick={() => navigate('/farmer/government-schemes')}><ArrowLeft size={17} />{labels.all}</button>
                    <div className="platform-scheme-heading"><div className="platform-scheme-card__icon"><Landmark size={24} /></div><div><span>{detail.category?.name} · {detail.department}</span><h2>{detail.schemeName}</h2></div></div>
                    <button className="platform-text-button" type="button" onClick={() => toggleSaved(detail)}><Bookmark size={17} fill={detail.isSaved ? 'currentColor' : 'none'} />{detail.isSaved ? labels.remove : labels.save}</button>
                    <p className="platform-scheme-description">{detail.fullDescription}</p>
                    {detail.needsReview && <p className="platform-warning" role="status">{labels.stale}</p>}
                    {!detail.isTranslationAvailable && lang !== 'en' && <p className="platform-warning">{labels.noTranslation}</p>}
                    <div className="platform-source-row"><span><ShieldCheck size={17} />{labels.status}: {statusText(detail.applicationStatus)}</span><small>{labels.verified}: {detail.lastVerifiedAt ? new Date(detail.lastVerifiedAt).toLocaleDateString() : '—'}</small></div>
                    {detail.statusSource && detail.applicationStatus !== 'unknown' && <a className="platform-text-button" href={detail.statusSource} target="_blank" rel="noreferrer"><ExternalLink size={16} />{labels.source}</a>}
                    {detail.officialWebsite && <a className="platform-primary platform-official-link" href={detail.officialWebsite} target="_blank" rel="noreferrer"><ExternalLink size={17} />{labels.official}</a>}
                    {detail.source && <p className="platform-source-link">{labels.source}: <a href={detail.source} target="_blank" rel="noreferrer">{new URL(detail.source).hostname}</a></p>}
                    {detail.guidelineUrl && <a className="platform-text-button" href={detail.guidelineUrl} target="_blank" rel="noreferrer"><FileCheck2 size={17} />{labels.procedure}</a>}
                    <section className="platform-detail-section"><h3>{labels.benefits}</h3><ul>{displayList(detail.benefitDetails).map((text, index) => <li key={index}>{text}</li>)}</ul></section>
                    <section className="platform-detail-section"><h3>{labels.eligibility}</h3><ul>{displayList(detail.eligibilityCriteria).map((text, index) => <li key={index}>{text}</li>)}</ul></section>
                    <section className="platform-detail-section"><h3>{labels.documents}</h3><ul>{displayList(detail.requiredDocuments).map((text, index) => <li key={index}>{text}</li>)}</ul></section>
                    <section className="platform-detail-section"><h3>{labels.procedure}</h3><ol>{displayList(detail.applicationProcedure).map((text, index) => <li key={index}>{text}</li>)}</ol></section>
                  </section>
                  <aside className="platform-side-column">
                    <section className="platform-panel">
                      <h2>{labels.check}</h2><p>{labels.checkNote}</p>
                      <form className="platform-form" onSubmit={checkEligibility}>
                        {(detail.eligibilityCriteria || []).map((criterion, index) => (
                          <label key={`${criterion.field}-${index}`}>{criterion.label || criterion.field}
                            <input type={['min', 'max'].includes(criterion.operator) ? 'number' : 'text'} value={answers[criterion.field] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [criterion.field]: event.target.value }))} />
                          </label>
                        ))}
                        <button className="platform-primary" type="submit">{labels.check}</button>
                      </form>
                      {eligibility && <div className="platform-eligibility-result"><strong>{labels.eligibilityResult}: {eligibility.status === 'likely_eligible' ? labels.likely : eligibility.status === 'does_not_appear_to_qualify' ? labels.no : eligibility.status === 'eligibility_not_configured' ? labels.notConfigured : labels.more}</strong><p>{eligibility.note}</p></div>}
                    </section>
                    <section className="platform-panel">
                      <h2>{labels.track}</h2><p>{labels.farmerEntered}</p>
                      <form className="platform-form" onSubmit={trackApplication}>
                        <label>{labels.reference}<input name="reference" maxLength="180" /></label>
                        <label>{labels.submission}<input name="date" type="date" /></label>
                        <label>{labels.trackingStatus}<select name="status" defaultValue="draft">{Object.entries(statusKeys).map(([value, key]) => <option key={value} value={value}>{labels[key]}</option>)}</select></label>
                        <label>{labels.notes}<textarea name="notes" maxLength="2000" rows="3" /></label>
                        <button className="platform-primary" type="submit">{labels.addTracking}</button>
                      </form>
                    </section>
                  </aside>
                </div>
              )
        ) : (
          <>
            <div className="platform-tabs platform-tabs--schemes">
              {[[ 'all', labels.all ], ['recommended', labels.recommended], ['saved', labels.saved], ['applications', labels.applications], ['updates', labels.updates]].map(([key, title]) => <button key={key} type="button" className={view === key ? 'is-active' : ''} onClick={() => setView(key)}>{title}</button>)}
            </div>
            {view === 'all' && <div className="platform-toolbar platform-toolbar--schemes">
              <label className="platform-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} /></label>
              <label className="platform-filter">{labels.level}<select value={level} onChange={(event) => setLevel(event.target.value)}><option value="">{labels.any}</option><option value="central">{labels.central}</option><option value="state">{labels.state}</option></select></label>
              <label className="platform-filter">{labels.filterCategory}<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{labels.any}</option>{categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
            </div>}
            {listingQuery.isPending ? <p className="farming-tools__loading" role="status">{labels.loading}</p>
              : listingQuery.isError ? <div className="platform-notice" role="alert">{labels.error}<button type="button" onClick={() => listingQuery.refetch()}>{labels.retry}</button></div>
                : list.length ? <div className="platform-scheme-grid">{list.map(schemeCard)}</div> : <p className="platform-empty">{view === 'applications' ? labels.noApplications : view === 'updates' ? labels.noUpdates : labels.empty}</p>}
          </>
        )}
      </div>
    </main>
  );
}
