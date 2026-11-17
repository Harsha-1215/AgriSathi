import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, Volume2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import authService from '../../services/authService';
import Logo from '../../components/common/Logo';

const fieldPrompts = {
  fullName: 'మీ పేరు చెప్పండి.',
  mobile: 'మీ మొబైల్ నంబర్ చెప్పండి.',
  district: 'మీ జిల్లా పేరు చెప్పండి.',
  village: 'మీ గ్రామం పేరు చెప్పండి.',
};

const labels = {
  fullName: 'పూర్తి పేరు / Full name',
  mobile: 'మొబైల్ నంబర్ / Mobile number',
  state: 'రాష్ట్రం / State (optional)',
  district: 'జిల్లా / District',
  mandal: 'మండలం / Mandal (optional)',
  village: 'గ్రామం / Village',
  password: 'పాస్‌వర్డ్ / Password (type it; do not say it aloud)',
};

export default function VoiceRegistration() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { setLang } = useLanguage();
  const [values, setValues] = useState({
    fullName: '', mobile: '', state: '', district: '', mandal: '', village: '', password: '', preferredLanguage: 'te',
  });
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('details');
  const [busy, setBusy] = useState(false);
  const [listeningField, setListeningField] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLang('te');
    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      const greeting = new SpeechSynthesisUtterance('నమస్కారం! అగ్రిసాథి స్వర నమోదు ప్రారంభిద్దాం.');
      greeting.lang = 'te-IN';
      window.speechSynthesis.speak(greeting);
    }
    return () => window.speechSynthesis?.cancel();
  }, [setLang]);

  function listenFor(field) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('ఈ పరికరంలో స్వర గుర్తింపు అందుబాటులో లేదు. దయచేసి టైప్ చేయండి. / Voice recognition is unavailable; please type instead.');
      return;
    }
    setError('');
    const recognition = new Recognition();
    recognition.lang = 'te-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const recognized = event.results?.[0]?.[0]?.transcript?.trim();
      if (recognized) setValues((current) => ({ ...current, [field]: recognized }));
      setListeningField('');
    };
    recognition.onerror = () => {
      setListeningField('');
      setError('మీ మాట వినిపించలేదు. మళ్లీ ప్రయత్నించండి లేదా టైప్ చేయండి. / Speech was not recognized; retry or type instead.');
    };
    recognition.onend = () => setListeningField('');
    setListeningField(field);
    const startRecognition = () => {
      try {
        recognition.start();
      } catch {
        setListeningField('');
        setError('మైక్రోఫోన్ ప్రారంభం కాలేదు. మళ్లీ ప్రయత్నించండి లేదా టైప్ చేయండి. / Could not start the microphone; retry or type instead.');
      }
    };
    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(fieldPrompts[field] || labels[field]);
      utterance.lang = 'te-IN';
      utterance.onend = startRecognition;
      window.speechSynthesis.speak(utterance);
    } else {
      startRecognition();
    }
  }

  function reviewDetails(event) {
    event.preventDefault();
    setError('');
    setStage('confirm-mobile');
    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      const utterance = new SpeechSynthesisUtterance(`మీరు చెప్పిన నంబర్ ${values.mobile}. ఇది సరైనదేనా?`);
      utterance.lang = 'te-IN';
      window.speechSynthesis.speak(utterance);
    }
  }

  async function sendCode() {
    setBusy(true);
    setError('');
    try {
      const response = await authService.registerWithVoice({
        ...values,
        agreeTerms,
      });
      setStage('verify');
      setCode(response.data?.developmentCode || '');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'నమోదు కాలేదు. మళ్లీ ప్రయత్నించండి. / Registration failed; please retry.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authService.verifyVoiceRegistration({ mobile: values.mobile, code });
      await refreshUser();
      navigate('/voice-services', { replace: true });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'కోడ్ నిర్ధారణ కాలేదు. మళ్లీ ప్రయత్నించండి. / Code verification failed; please retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card auth-card--wide">
      <div className="auth-card__brand"><Logo size="small" /></div>
      <p className="auth-eyebrow">TELUGU VOICE</p>
      <h1>స్వరంతో రైతు ఖాతా సృష్టించండి</h1>
      <p className="auth-description">మాట్లాడండి లేదా టైప్ చేయండి. పాస్‌వర్డ్‌ను గోప్యంగా టైప్ చేయండి; SMS కోడ్‌తో మొబైల్‌ను నిర్ధారించాలి.</p>
      {error && <p className="auth-alert auth-alert--error" role="alert">{error}</p>}
      {stage === 'details' ? (
        <form className="auth-form" onSubmit={reviewDetails}>
          {Object.keys(labels).map((field) => (
            <div className="auth-field" key={field}>
              <label htmlFor={`voice-${field}`}>{labels[field]}</label>
              <div className="voice-registration-input">
                <input
                  id={`voice-${field}`}
                  type={field === 'password' ? 'password' : field === 'mobile' ? 'tel' : 'text'}
                  autoComplete={field === 'password' ? 'new-password' : field}
                  required={['fullName', 'mobile', 'district', 'village', 'password'].includes(field)}
                  minLength={field === 'password' ? 8 : undefined}
                  value={values[field]}
                  onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                />
                {fieldPrompts[field] && (
                  <button type="button" onClick={() => listenFor(field)} aria-label={`Speak ${field}`}>
                    {listeningField === field ? <Volume2 size={18} /> : <Mic size={18} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="auth-field">
            <label htmlFor="voice-preferred-language">ఇష్టమైన భాష / Preferred language</label>
            <select
              id="voice-preferred-language"
              value={values.preferredLanguage}
              onChange={(event) => setValues((current) => ({ ...current, preferredLanguage: event.target.value }))}
            >
              <option value="te">తెలుగు</option>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
          <label className="auth-check">
            <input type="checkbox" required checked={agreeTerms} onChange={(event) => setAgreeTerms(event.target.checked)} />
            <span>నిబంధనలను అంగీకరిస్తున్నాను / I accept the terms.</span>
          </label>
          <label className="auth-check">
            <input type="checkbox" checked readOnly />
            <span>ఖాతా రకం: రైతు · పరస్పర చర్య: తెలుగు స్వరం · భాష: తెలుగు</span>
          </label>
          <button className="auth-button auth-button--primary auth-button--full" type="submit" disabled={busy}>
            {busy ? 'వేచి ఉండండి…' : 'మొబైల్ నంబర్‌ను నిర్ధారించండి'}
          </button>
        </form>
      ) : stage === 'confirm-mobile' ? (
        <div className="auth-form">
          <p className="auth-description">మీరు చెప్పిన మొబైల్ నంబర్ సరైనదేనా?</p>
          <strong className="voice-registration-number">{values.mobile}</strong>
          <button className="auth-button auth-button--primary auth-button--full" type="button" onClick={sendCode} disabled={busy}>
            {busy ? 'పంపుతోంది…' : 'అవును, ఈ నంబర్‌కు SMS కోడ్ పంపండి'}
          </button>
          <button className="auth-button auth-button--secondary auth-button--full" type="button" onClick={() => setStage('details')} disabled={busy}>
            కాదు, నంబర్ మార్చండి
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={verifyCode}>
          <p className="auth-description">{values.mobile} నంబర్‌కు పంపిన ఆరు అంకెల SMS కోడ్ నమోదు చేయండి.</p>
          <div className="auth-field">
            <label htmlFor="voice-registration-code">నిర్ధారణ కోడ్ / Verification code</label>
            <input id="voice-registration-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
          <button className="auth-button auth-button--primary auth-button--full" type="submit" disabled={busy || code.length !== 6}>
            {busy ? 'నిర్ధారిస్తోంది…' : 'కోడ్ నిర్ధారించి ఖాతా సృష్టించండి'}
          </button>
          <button className="auth-button auth-button--secondary auth-button--full" type="button" onClick={sendCode} disabled={busy}>
            SMS కోడ్ మళ్లీ పంపండి
          </button>
        </form>
      )}
      <p className="auth-switch"><Link to="/register">మాన్యువల్ నమోదు / Manual registration</Link></p>
    </section>
  );
}
