import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bot, Check, Copy, History, Mic, MicOff, Plus, Search, Send, Settings2,
  Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, Volume2,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../context/LanguageContext';
import moduleContent from '../../data/moduleContent';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

const speechLocales = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function useStoredAutoSpeak() {
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try {
      return localStorage.getItem('agrisathi_voice_auto_speak') === 'true';
    } catch {
      return false;
    }
  });
  const update = useCallback((value) => {
    setAutoSpeak(value);
    try {
      localStorage.setItem('agrisathi_voice_auto_speak', String(value));
    } catch {
      setAutoSpeak(false);
    }
  }, []);
  return [autoSpeak, update];
}

function AssistantMessage({ item, copy, onSpeak, onFeedback, onBook }) {
  const [copied, setCopied] = useState(false);
  const isAssistant = item.role === 'assistant';

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(item.message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className={`assistant-message${isAssistant ? ' assistant-message--ai' : ' assistant-message--farmer'}`}>
      <div className="assistant-message__avatar" aria-hidden="true">
        {isAssistant ? <Bot size={19} /> : <span>●</span>}
      </div>
      <div className="assistant-message__body">
        <div className="assistant-message__label">{isAssistant ? 'AGRISATHI' : 'You'}</div>
        <p>{item.message}</p>
        {isAssistant && ['service_search', 'service_booking'].includes(item.intent) && item.results?.length > 0 && (
          <div className="voice-provider-results">
            {item.results.map((provider) => (
              <article key={provider.providerId} className="voice-provider-result">
                <div>
                  <strong>{provider.businessName}</strong>
                  <span>{provider.serviceCategory} · {provider.district || provider.village || ''}</span>
                  <small>{provider.pricing || 'ధర వివరాల కోసం ప్రదాతను సంప్రదించండి'}</small>
                </div>
                <button type="button" onClick={() => onBook(provider, item.entities)}>{copy.requestBooking}</button>
              </article>
            ))}
          </div>
        )}
        <div className="assistant-message__actions">
          {isAssistant && (
            <>
              <button type="button" onClick={() => onSpeak(item.message)} aria-label={copy.listen}>
                <Volume2 size={16} />
              </button>
              <button type="button" onClick={copyText} aria-label={copied ? copy.copied : copy.copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              {item.id && !String(item.id).startsWith('local-') && (
                <>
                  <button type="button" onClick={() => onFeedback(item.id, 'helpful')} aria-label={copy.helpful}><ThumbsUp size={16} /></button>
                  <button type="button" onClick={() => onFeedback(item.id, 'not_helpful')} aria-label={copy.notHelpful}><ThumbsDown size={16} /></button>
                </>
              )}
            </>
          )}
          {item.createdAt && <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>}
        </div>
      </div>
    </article>
  );
}

export default function VoiceAssistantPage() {
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const copy = moduleContent[lang]?.voice || moduleContent.en.voice;
  const queryClient = useQueryClient();
  const [autoSpeak, setAutoSpeak] = useStoredAutoSpeak();
  const [search, setSearch] = useState('');
  const [question, setQuestion] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [bookingDraft, setBookingDraft] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingDistrict, setBookingDistrict] = useState('');
  const [bookingVillage, setBookingVillage] = useState('');
  const [bookingArea, setBookingArea] = useState('');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const recognitionRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const scrollRef = useRef(null);
  const lastSharedPromptRef = useRef('');

  useEffect(() => {
    if (user?.interactionMode === 'voice') {
      setLang('te');
      setAutoSpeak(true);
    }
  }, [setLang, setAutoSpeak, user?.interactionMode]);

  useEffect(() => {
    const suggestedQuestion = searchParams.get('question');
    const suggestedLanguage = searchParams.get('language');
    const sharedPrompt = `${suggestedQuestion || ''}|${suggestedLanguage || ''}`;
    if (!suggestedQuestion || lastSharedPromptRef.current === sharedPrompt) return;
    lastSharedPromptRef.current = sharedPrompt;
    setQuestion(suggestedQuestion);
    if (['en', 'te', 'hi'].includes(suggestedLanguage)) setLang(suggestedLanguage);
  }, [searchParams, setLang]);

  const historyQuery = useQuery({
    queryKey: ['assistant-conversations', search],
    queryFn: async () => unwrapPayload(await api.get('/assistant/conversations', {
      params: { q: search || undefined, limit: 30 },
    })),
    retry: false,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    recognitionRef.current?.abort?.();
    recorderRef.current?.stop?.();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }
  }, []);

  const openConversation = async (id) => {
    setError('');
    try {
      const [conversationResponse, messagesResponse] = await Promise.all([
        api.get(`/assistant/conversations/${id}`),
        api.get(`/assistant/conversations/${id}/messages`, { params: { limit: 100 } }),
      ]);
      const data = unwrapPayload(conversationResponse);
      const messageData = unwrapPayload(messagesResponse);
      setConversationId(data.id);
      setMessages(messageData.items || []);
      if (['en', 'te', 'hi'].includes(data.language)) setLang(data.language);
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.unavailable));
    }
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setQuestion('');
    setError('');
    stopSpeaking();
  };

  async function sendQuestion(value) {
    const text = String(value || '').trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    const temporaryId = `local-${Date.now()}`;
    setMessages((items) => [...items, { id: temporaryId, role: 'user', message: text, createdAt: new Date().toISOString() }]);
    setQuestion('');
    try {
      const data = unwrapPayload(await api.post('/voice/process-command', {
        command: text,
        language: lang,
        conversationId,
      }));
      setConversationId(data.conversationId);
      setMessages((items) => [
        ...items.filter((item) => item.id !== temporaryId),
        ...data.messages.map((item) => item.role === 'assistant'
          ? { ...item, intent: data.intent, entities: data.entities, results: data.results }
          : item),
      ]);
      queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] });
      if (autoSpeak) speakText(data.answer);
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.unavailable));
    } finally {
      setBusy(false);
    }
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current.removeAttribute('src');
    }
    setSpeaking(false);
  }

  async function speakText(text) {
    stopSpeaking();
    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLocales[lang];
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
      return;
    }
    try {
      const response = await api.post('/voice/text-to-speech', { text, language: lang }, { responseType: 'blob' });
      const audioUrl = URL.createObjectURL(response.data);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = audioUrl;
      audioRef.current.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setSpeaking(false);
      };
      setSpeaking(true);
      await audioRef.current.play();
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.unavailable));
      setSpeaking(false);
    }
  }

  function stopListening() {
    window.clearTimeout(timerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setListening(false);
  }

  async function startRecordingFallback() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(copy.speechUnavailable);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
      const mimeType = typeof MediaRecorder.isTypeSupported === 'function'
        ? candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
        : '';
      if (!mimeType) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setError(copy.microphoneUnavailable);
        return;
      }
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setListening(false);
        setError(copy.speechUnavailable);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (!chunks.length) return;
        try {
          const form = new FormData();
          form.append('audio', new Blob(chunks, { type: mimeType }), 'question.webm');
          form.append('language', lang);
          const result = unwrapPayload(await api.post('/voice/speech-to-text', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          }));
          setQuestion(result.text);
        } catch (requestError) {
          setError(getErrorMessage(requestError, copy.speechUnavailable));
        }
      };
      recorder.start();
      setListening(true);
      timerRef.current = window.setTimeout(() => stopListening(), 60000);
    } catch (requestError) {
      if (requestError.name === 'NotAllowedError' || requestError.name === 'SecurityError') {
        setError(copy.microphoneDenied);
      } else {
        setError(copy.microphoneUnavailable);
      }
      setListening(false);
    }
  }

  function startListening() {
    setError('');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      startRecordingFallback();
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = speechLocales[lang];
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const finalText = Array.from(event.results)
          .filter((result) => result.isFinal)
          .map((result) => result[0].transcript)
          .join(' ')
          .trim();
        if (finalText) setQuestion(finalText);
      };
      recognition.onerror = (event) => {
        setListening(false);
        setError(event.error === 'not-allowed' ? copy.microphoneDenied : copy.speechUnavailable);
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError(copy.speechUnavailable);
    }
  }

  const submit = (event) => {
    event.preventDefault();
    sendQuestion(question);
  };

  async function submitFeedback(messageId, rating) {
    try {
      await api.post(`/assistant/conversations/${conversationId}/messages/${messageId}/feedback`, { rating });
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.unavailable));
    }
  }

  async function deleteConversation(event, id) {
    event.stopPropagation();
    if (!window.confirm(copy.confirmDelete)) return;
    try {
      await api.delete(`/assistant/conversations/${id}`);
      if (conversationId === id) startNewConversation();
      queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] });
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.unavailable));
    }
  }

  function startBooking(provider, entities) {
    setBookingDraft({ provider, entities });
    setBookingDate('');
    setBookingDistrict(user?.profile?.district || '');
    setBookingVillage(user?.profile?.village || '');
    setBookingArea(entities?.landArea ? String(entities.landArea) : '');
    setBookingConfirmed(false);
    setBookingError('');
  }

  async function submitBooking(event) {
    event.preventDefault();
    if (!bookingDraft || !bookingConfirmed || bookingBusy) return;
    setBookingBusy(true);
    setBookingError('');
    try {
      const response = await api.post('/bookings', {
        confirm: true,
        providerId: bookingDraft.provider.providerId,
        serviceCategory: bookingDraft.provider.serviceCategory,
        requestedDate: bookingDate,
        district: bookingDistrict,
        village: bookingVillage,
        landArea: bookingArea || undefined,
      });
      const result = unwrapPayload(response);
      setMessages((items) => [...items, {
        id: `local-booking-${Date.now()}`,
        role: 'assistant',
        message: lang === 'te'
          ? `మీ సేవా బుకింగ్ అభ్యర్థన పంపబడింది. స్థితి: ${result.status}.`
          : lang === 'hi'
            ? `आपका सेवा बुकिंग अनुरोध भेज दिया गया है। स्थिति: ${result.status}.`
            : `Your service booking request was sent. Status: ${result.status}.`,
        createdAt: new Date().toISOString(),
      }]);
      setBookingDraft(null);
      if (autoSpeak) speakText(lang === 'te' ? 'మీ సేవా బుకింగ్ అభ్యర్థన పంపబడింది.' : 'Your service booking request was sent.');
    } catch (requestError) {
      setBookingError(getErrorMessage(requestError, copy.unavailable));
    } finally {
      setBookingBusy(false);
    }
  }

  const conversations = historyQuery.data?.items || [];

  return (
    <div className="agri-module-page voice-page">
      <header className="module-topbar">
        <Link to="/farmer/dashboard" className="module-brand" aria-label="AGRISATHI dashboard"><Logo size="small" /></Link>
        <div className="module-topbar__title"><Sparkles size={20} /><h1>{copy.title}</h1></div>
        <div className="module-topbar__actions">
          <ModuleLanguageSelector label={copy.language} />
          <Link className="module-back-link" to="/farmer/dashboard">{copy.dashboard}</Link>
        </div>
      </header>

      <main className="voice-layout">
        <aside className="voice-history">
          <div className="voice-history__head">
            <h2><History size={19} />{copy.history}</h2>
            <button type="button" className="module-icon-button" onClick={startNewConversation} aria-label={copy.newConversation}><Plus size={19} /></button>
          </div>
          <label className="module-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchHistory} /></label>
          {historyQuery.isPending ? <p className="module-muted" role="status">{copy.processing}</p> : null}
          {historyQuery.isError ? <button className="module-retry" type="button" onClick={() => historyQuery.refetch()}>{copy.unavailable}</button> : null}
          <div className="voice-history__list">
            {conversations.map((conversation) => (
              <div className={`voice-history__item${conversationId === conversation.id ? ' is-active' : ''}`} key={conversation.id}>
                <button type="button" onClick={() => openConversation(conversation.id)}>{conversation.title || copy.newConversation}</button>
                <button type="button" onClick={(event) => deleteConversation(event, conversation.id)} aria-label={copy.delete}><Trash2 size={15} /></button>
              </div>
            ))}
            {!historyQuery.isPending && !conversations.length && <p className="module-muted">{copy.noHistory}</p>}
          </div>
          <details className="voice-settings">
            <summary><Settings2 size={17} />{copy.settings}</summary>
            <label><input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />{copy.autoSpeak}</label>
          </details>
        </aside>

        <section className="voice-main" aria-label={copy.title}>
          <div className="voice-main__intro"><span className="voice-main__badge"><Bot size={20} /> AGRISATHI</span><p>{copy.subtitle}</p></div>
          <div className="voice-conversation" ref={scrollRef} aria-live="polite">
            {!messages.length && !busy && <div className="voice-empty"><div><Bot size={32} /></div><p>{copy.empty}</p></div>}
            {messages.map((item, index) => (
              <AssistantMessage
                key={item.id || `${item.role}-${index}`}
                item={item}
                copy={copy}
                onSpeak={speakText}
                onFeedback={submitFeedback}
                onBook={startBooking}
              />
            ))}
            {busy && <div className="assistant-thinking" role="status"><span /><span /><span />{copy.processing}</div>}
          </div>
          <div className="voice-controls">
            <div className={`voice-status${listening ? ' is-listening' : speaking ? ' is-speaking' : ''}`} role="status">
              <span className="voice-status__wave"><i /><i /><i /><i /><i /></span>
              {listening ? copy.listening : speaking ? copy.speaking : copy.ready}
            </div>
            <div className="voice-actions">
              <button className={`voice-mic${listening ? ' is-listening' : ''}`} type="button" onClick={listening ? stopListening : startListening} disabled={busy} aria-label={listening ? copy.stop : copy.start}>
                {listening ? <MicOff size={25} /> : <Mic size={25} />}
              </button>
              {speaking && <button className="voice-stop-speaking" type="button" onClick={stopSpeaking}><Square size={16} />{copy.stopSpeaking}</button>}
            </div>
            {error && <p className="module-alert" role="alert">{error}</p>}
            <form className="voice-input" onSubmit={submit}>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={copy.inputPlaceholder} rows={2} maxLength={2000} aria-label={copy.inputPlaceholder} />
              <button type="submit" disabled={!question.trim() || busy} aria-label={copy.send}><Send size={19} /></button>
            </form>
            <div className="voice-quick">
              <h2>{copy.quickQuestions}</h2>
              <div>{copy.questions.map((suggestion) => <button type="button" key={suggestion} disabled={busy} onClick={() => sendQuestion(suggestion)}>{suggestion}</button>)}</div>
            </div>
          </div>
        </section>
      </main>
      {bookingDraft && (
        <div className="voice-booking-overlay">
          <form className="voice-booking-dialog" onSubmit={submitBooking}>
            <h2>{lang === 'te' ? 'బుకింగ్‌ను నిర్ధారించండి' : lang === 'hi' ? 'बुकिंग की पुष्टि करें' : 'Confirm service booking'}</h2>
            <p>{bookingDraft.provider.businessName} · {bookingDraft.provider.serviceCategory}</p>
            <label>
              {lang === 'te' ? 'అవసరమైన తేదీ' : lang === 'hi' ? 'आवश्यक तारीख' : 'Requested date'}
              <input type="date" required min={new Date().toISOString().slice(0, 10)} value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} />
            </label>
            <label>
              {lang === 'te' ? 'జిల్లా' : lang === 'hi' ? 'जिला' : 'District'}
              <input required maxLength={120} value={bookingDistrict} onChange={(event) => setBookingDistrict(event.target.value)} />
            </label>
            <label>
              {lang === 'te' ? 'గ్రామం' : lang === 'hi' ? 'गाँव' : 'Village'}
              <input required maxLength={120} value={bookingVillage} onChange={(event) => setBookingVillage(event.target.value)} />
            </label>
            <label>
              {lang === 'te' ? 'పొలం విస్తీర్ణం (ఐచ్ఛికం)' : lang === 'hi' ? 'खेत का क्षेत्रफल (वैकल्पिक)' : 'Land area (optional)'}
              <input type="number" min="0.0001" step="any" value={bookingArea} onChange={(event) => setBookingArea(event.target.value)} />
            </label>
            <label className="voice-booking-confirm">
              <input type="checkbox" required checked={bookingConfirmed} onChange={(event) => setBookingConfirmed(event.target.checked)} />
              <span>{lang === 'te' ? 'ఈ సేవా అభ్యర్థనను పంపడానికి నేను స్పష్టంగా అంగీకరిస్తున్నాను.' : lang === 'hi' ? 'मैं इस सेवा अनुरोध को भेजने की स्पष्ट पुष्टि करता/करती हूँ।' : 'I explicitly confirm that I want to send this service request.'}</span>
            </label>
            {bookingError && <p className="module-alert" role="alert">{bookingError}</p>}
            <div className="voice-booking-actions">
              <button type="button" onClick={() => setBookingDraft(null)} disabled={bookingBusy}>{copy.cancel}</button>
              <button type="submit" disabled={!bookingConfirmed || bookingBusy}>{bookingBusy ? copy.processing : copy.requestBooking}</button>
            </div>
          </form>
        </div>
      )}
      <audio ref={audioRef} hidden />
    </div>
  );
}
