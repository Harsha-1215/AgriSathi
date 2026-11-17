import { useEffect, useRef, useState } from 'react';
import { Mic, Settings2, Sprout, Volume2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import authService from '../../services/authService';
import './interaction-mode.css';

const modeKey = 'agrisathi_interaction_mode';
const pendingKey = 'agrisathi_interaction_mode_pending';
const greeting = 'నమస్కారం! అగ్రిసాథికి స్వాగతం. మీరు చదువుకున్నారా?';

export default function InteractionModePrompt() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const { setLang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [heardAnswer, setHeardAnswer] = useState('');
  const greeted = useRef(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (location.pathname === '/voice-register') return;
    setOpen(true);
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.interactionMode) return;
    let pending = false;
    let localMode;
    try {
      pending = localStorage.getItem(pendingKey) === 'true';
      localMode = localStorage.getItem(modeKey);
    } catch {
      setOpen(true);
      return;
    }
    if (pending) {
      if (localMode === 'normal' || localMode === 'voice') {
        authService.updateInteractionMode(localMode)
          .then(async () => {
            localStorage.removeItem(pendingKey);
            await refreshUser();
          })
          .catch(() => setError('మీ ఎంపికను ఖాతాలో భద్రపరచలేకపోయాం. మళ్లీ ప్రయత్నించండి.'));
      }
    } else if (localMode === 'normal' || localMode === 'voice') {
      try {
        localStorage.setItem(modeKey, user.interactionMode);
      } catch {
        setError('ఈ పరికరంలో మీ ఎంపికను భద్రపరచలేకపోయాం.');
      }
    } else if (user.interactionMode === 'voice') {
      try {
        localStorage.setItem(modeKey, 'voice');
      } catch {
        setError('ఈ పరికరంలో మీ ఎంపికను భద్రపరచలేకపోయాం.');
      }
    }
  }, [refreshUser, user]);

  useEffect(() => {
    if (!open || greeted.current || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
    greeted.current = true;
    const utterance = new SpeechSynthesisUtterance(greeting);
    utterance.lang = 'te-IN';
    window.speechSynthesis.speak(utterance);
  }, [open]);

  useEffect(() => () => {
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel();
  }, []);

  function interpretAnswer(answer) {
    const text = answer.toLocaleLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
    if (/\b(no|not educated|uneducated|cannot read|can't read|voice|speak)\b|చదువుకోలేదు|చదవలేదు|చదవలేను|చదువు లేదు|చదువు రాదు|లేదు|కాదు|స్వరం|వాయిస్|నిరక్షరాస్య|नहीं|अनपढ़|आवाज़/.test(text)) {
      return 'voice';
    }
    if (/\b(yes|educated|literate|normal|text)\b|చదువుకున్నాను|చదవగలను|అవును|సాధారణ|पढ़ा लिखा|हाँ|हां|सामान्य/.test(text)) {
      return 'normal';
    }
    return null;
  }

  function listenForAnswer() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('ఈ పరికరంలో స్వర గుర్తింపు అందుబాటులో లేదు. దయచేసి క్రింది బటన్‌ను ఎంచుకోండి.');
      return;
    }
    setError('');
    setHeardAnswer('');
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'te-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const answer = event.results?.[0]?.[0]?.transcript?.trim() || '';
      setHeardAnswer(answer);
      const mode = interpretAnswer(answer);
      if (!mode) {
        setError('స్పష్టంగా వినిపించలేదు. "చదువుకున్నాను" లేదా "చదువుకోలేదు" అని చెప్పండి.');
        return;
      }
      selectMode(mode);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('మైక్రోఫోన్ అనుమతి ఇవ్వండి లేదా క్రింది బటన్‌ను ఎంచుకోండి.');
      } else {
        setError('మీ సమాధానం వినిపించలేదు. మళ్లీ ప్రయత్నించండి లేదా క్రింది బటన్‌ను ఎంచుకోండి.');
      }
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError('మైక్రోఫోన్ ప్రారంభం కాలేదు. మళ్లీ ప్రయత్నించండి.');
    }
  }

  async function selectMode(mode) {
    setBusy(true);
    setError('');
    recognitionRef.current?.stop?.();
    if (mode === 'voice') setLang('te');
    try {
      localStorage.setItem(modeKey, mode);
      if (isAuthenticated) {
        await authService.updateInteractionMode(mode);
        localStorage.removeItem(pendingKey);
        await refreshUser();
      } else {
        localStorage.setItem(pendingKey, 'true');
        if (mode === 'voice') {
          navigate('/voice-register', { replace: true });
        }
      }
      setOpen(false);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'ఎంపిక భద్రపరచబడలేదు. మళ్లీ ప్రయత్నించండి.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="interaction-mode-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="పరస్పర చర్య విధానాన్ని మార్చండి"
      >
        <Settings2 size={18} />
        <span>విధానం</span>
      </button>
      {open && (
        <div className="interaction-mode-overlay">
          <section className="interaction-mode-dialog" role="dialog" aria-modal="true" aria-labelledby="interaction-mode-title">
            <div className="interaction-mode-dialog__icon"><Sprout size={24} /></div>
            <p className="interaction-mode-dialog__eyebrow">AGRISATHI</p>
            <h2 id="interaction-mode-title">{greeting}</h2>
            <button
              className="interaction-mode-replay"
              type="button"
              onClick={() => {
                if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(greeting);
                utterance.lang = 'te-IN';
                window.speechSynthesis.speak(utterance);
              }}
            >
              <Volume2 size={17} /> మళ్లీ వినండి
            </button>
            <p>మీకు నచ్చిన విధానాన్ని ఎంచుకోండి. ఈ ఎంపిక మీ సామర్థ్యాన్ని నిర్ణయించదు; ఎప్పుడైనా మార్చుకోవచ్చు.</p>
            <button className="interaction-mode-replay" type="button" onClick={listenForAnswer} disabled={busy || listening}>
              <Mic size={17} /> {listening ? 'వింటున్నాం… / Listening…' : 'స్వరంతో సమాధానం ఇవ్వండి / Answer by voice'}
            </button>
            {heardAnswer && <p className="interaction-mode-answer" aria-live="polite">మీ సమాధానం: {heardAnswer}</p>}
            {error && <p className="interaction-mode-error" role="alert">{error}</p>}
            <div className="interaction-mode-options">
              <button type="button" disabled={busy} onClick={() => selectMode('normal')}>
                <strong>చదువుకున్నాను</strong>
                <span>Educated · సాధారణ విధానం</span>
              </button>
              <button type="button" disabled={busy} onClick={() => selectMode('voice')}>
                <strong><Mic size={17} /> చదువుకోలేదు</strong>
                <span>Not educated · తెలుగు స్వర విధానం</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
