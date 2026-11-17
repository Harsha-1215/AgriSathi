import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Volume2, Pause, Play, X, Loader2 } from 'lucide-react';
import voiceRegistrationService from '../../services/voiceRegistrationService';

const STATUS_LABELS = {
  te: {
    listening: 'వింటున్నాం…',
    processing: 'ఇணిపిస్తున్నాం…',
    speaking: 'మాట్లాడುತ್ತున్నాం…',
    waiting: 'మీ సమాధానం కోసం వేచి ఉంది…',
    confirming: 'నిర్ధారణకు వేచి ఉంది…',
    complete: 'ఖాతా సృష్టించబడింది!',
    error: 'பிழை ஏற்பட்டది.',
  },
  en: {
    listening: 'Listening…',
    processing: 'Processing…',
    speaking: 'Speaking…',
    waiting: 'Waiting for your answer…',
    confirming: 'Waiting for confirmation…',
    complete: 'Account created!',
    error: 'Error occurred.',
  },
  hi: {
    listening: 'सुन रहे हैं…',
    processing: 'प्रसंस्करण कर रहे हैं…',
    speaking: 'बोल रहे हैं…',
    waiting: 'आपके उत्तर की प्रतीक्षा कर रहे हैं…',
    confirming: 'पुष्टि की प्रतीक्षा कर रहे हैं…',
    complete: 'खाता बन गया!',
    error: 'त्रुटि हुई.',
  },
};

export default function VoiceConversationUI({
  sessionId,
  language = 'te',
  onComplete,
  onCancel,
}) {
  const labels = STATUS_LABELS[language] || STATUS_LABELS.te;
  const [status, setStatus] = useState('waiting');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentField, setCurrentField] = useState(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [collectedFields, setCollectedFields] = useState({});
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [confirmMode, setConfirmMode] = useState(false);
  const recognitionRef = useRef(null);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [language]);

  const startListening = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('వైకృతి: ఈ పరికరంలో స్వర గుర్తింపు మద్దతు లేదు.');
      return;
    }
    setError('');
    setIsListening(true);
    setStatus('listening');
    const recognition = new Recognition();
    recognition.lang = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      setRecognizedText(final || interim);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setStatus('waiting');
      if (event.error === 'not-allowed') {
        setError('మైక్రోఫోన్ అనుమతి అవసరం.');
      } else {
        setError('మీ మాట వినబడలేదు. మళ్లీ ప్రయత్నించండి.');
      }
      recognitionRef.current = null;
    };
    try { recognition.start(); } catch { setIsListening(false); recognitionRef.current = null; }
  }, [language]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleSubmitResponse = async () => {
    const text = recognizedText.trim() || manualInput.trim();
    if (!text) return;
    setBusy(true);
    setStatus('processing');
    stopListening();
    try {
      const data = await voiceRegistrationService.respond(sessionId, text, currentField);
      setCollectedFields(data.data?.collectedFields || {});
      if (data.data.stage === 'confirming') {
        setConfirmMode(true);
        setSummary(data.data.summary || '');
        setStatus('confirming');
        speak(data.data.question);
      } else if (data.data.stage === 'validation_error') {
        setError(data.data.question);
        setStatus('waiting');
      } else {
        setCurrentField(data.data.field);
        setCurrentQuestion(data.data.question);
        setStatus('waiting');
        setRecognizedText('');
        setManualInput('');
        speak(data.data.question);
      }
    } catch (err) {
      setError(err.message || 'పరిశీలన కాలేదు.');
      setStatus('waiting');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (confirmed) => {
    if (!confirmed) {
      setConfirmMode(false);
      setStatus('waiting');
      setCollectedFields({});
      return;
    }
    setBusy(true);
    setStatus('processing');
    try {
      const data = await voiceRegistrationService.confirm(sessionId, true);
      if (data.data.developmentCode) {
        setManualInput(data.data.developmentCode);
        setShowManualInput(true);
      }
      setStatus('confirming');
      speak(language === 'te' ? 'మీ మొబైల్ నంబర్‌కు SMS కోడ్ పంపించాము. దయచేసి OTP నమోదు చేయండి.' : 'We sent an OTP to your mobile. Please enter it.');
    } catch (err) {
      setError(err.message || 'OTP పంపడంలో సమస్య.');
      setStatus('waiting');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!/^\d{6}$/.test(manualInput)) {
      setError('దయచేసి 6 అంకెల కోడ్ నమోదు చేయండి.');
      return;
    }
    setBusy(true);
    setStatus('processing');
    try {
      await voiceRegistrationService.verifyOTP(sessionId, manualInput);
      setStatus('complete');
      speak(language === 'te' ? 'అభినందనలు! మీ అగ్రిసాథి ఖాతా విజయవంతంగా సృష్టించబడింది.' : 'Congratulations! Your AgriSathi account has been created.');
      setTimeout(() => onComplete?.(), 2000);
    } catch (err) {
      setError(err.message || 'కోడ్ సరిగ్గా లేదు.');
      setStatus('waiting');
    } finally {
      setBusy(false);
    }
  };

  const handleResendOTP = async () => {
    setBusy(true);
    try {
      await voiceRegistrationService.resendOTP(sessionId);
      setError('');
      setStatus('waiting');
      speak(language === 'te' ? 'కోడ్ మళ్లీ పంపించాం.' : 'Code resent.');
    } catch (err) {
      setError(err.message || 'మళ్లీ పంపలేకపoya.');
      setStatus('waiting');
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    setBusy(true);
    try {
      const data = await voiceRegistrationService.startSession(language);
      setCurrentField(data.data.field);
      setCurrentQuestion(data.data.question);
      setStatus('waiting');
      speak(data.data.question);
    } catch (err) {
      setError(err.message || ' enregistre.');
      setStatus('waiting');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    handleStart();
  }, [sessionId]);

  return (
    <section className="voice-conversation-ui min-h-screen flex flex-col items-center justify-center bg-[#F8FAF7] p-4 text-[#172B1D]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DCFCE7]/30 border border-[#166534]/30 text-[#166534] text-sm font-semibold mb-4">
            <span className={`w-2 h-2 rounded-full ${status === 'listening' ? 'bg-[#22C55E] animate-pulse' : 'bg-[#166534]'}`} />
            {status === 'listening' ? labels.listening : status === 'processing' ? labels.processing : status === 'speaking' ? labels.speaking : status === 'confirming' ? labels.confirming : status === 'complete' ? labels.complete : labels.waiting}
          </div>
          <div className={`text-3xl md:text-5xl font-bold leading-tight mb-6 ${isSpeaking ? 'animate-pulse' : ''}`}>
            {currentQuestion || (status === 'complete' ? labels.complete : '')}
          </div>
          {recognizedText && <p className="text-[#64748B] text-sm italic mb-4">మీరు: {recognizedText}</p>}
          {error && <p className="text-[#DC2626] text-sm font-medium mb-4">{error}</p>}
        </div>

        {confirmMode && (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6 border border-[#DCFCE7]/30">
            <p className="text-[#172B1D] text-lg font-medium mb-4">{labels.confirming}</p>
            <p className="text-[#64748B] text-sm mb-4">{summary}</p>
            <div className="flex gap-3">
              <button
                className="flex-1 bg-[#166534] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#14532D] transition-colors"
                onClick={() => handleConfirm(true)}
                disabled={busy}
              >
                {busy ? 'వేచి ఉండండి…' : 'అవును, సరైనది'}
              </button>
              <button
                className="flex-1 bg-[#F59E0B]/10 text-[#F59E0B] px-6 py-3 rounded-xl font-semibold hover:bg-[#F59E0B]/20 transition-colors"
                onClick={() => handleConfirm(false)}
                disabled={busy}
              >
                కాదు, మార్చండి
              </button>
            </div>
          </div>
        )}

        {status === 'complete' && (
          <div className="bg-[#166534] text-white rounded-2xl p-8 text-center mb-6 shadow-xl">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-2xl font-bold mb-2">{labels.complete}</h2>
            <p className="text-[#DCFCE7]/90">ఖాతా సృష్టించబడింది. డాష్‌బోర్డ్ తెరువబడుతుంది.</p>
          </div>
        )}

        {!confirmMode && status !== 'complete' && (
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-[#DCFCE7]/30">
            <div className="flex items-center justify-between mb-6">
              <button
                className="p-2 rounded-lg hover:bg-[#DCFCE7]/50 text-[#64748B] transition-colors"
                onClick={() => setShowManualInput(!showManualInput)}
                aria-label="Manual input"
              >
                <span className="w-5 h-5">⌨</span>
              </button>
              <button
                className={`p-3 rounded-full ${isListening ? 'bg-[#DC2626] text-white' : 'bg-[#166534] text-white'} shadow-lg transition-all`}
                onClick={isListening ? stopListening : startListening}
                aria-label={isListening ? 'Stop listening' : 'Start listening'}
              >
                {isListening ? <MicOff size={24} strokeWidth={2.5} /> : <Mic size={24} strokeWidth={2.5} />}
              </button>
              <button
                className="p-2 rounded-lg hover:bg-[#DCFCE7]/50 text-[#64748B] transition-colors"
                onClick={() => speak(currentQuestion)}
                aria-label="Repeat question"
              >
                <Volume2 size={20} />
              </button>
            </div>

            {showManualInput && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#64748B] mb-2">క విలువ టైప్ చేయండి / Type your answer</label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-[#DCFCE7]/50 focus:outline-none focus:ring-2 focus:ring-[#166534] text-[#172B1D]"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="మీ సమాధానం టైప్ చేయండి"
                  autoFocus
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                className={`flex-1 px-6 py-4 rounded-xl font-semibold text-lg transition-all ${busy ? 'opacity-60' : ''}`}
                onClick={handleSubmitResponse}
                disabled={busy || (!recognizedText && !manualInput)}
              >
                {busy ? 'సమర్పిస్తోంది…' : 'సమర్పించండి / Submit'}
              </button>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                className="flex-1 px-4 py-3 rounded-lg border border-[#DCFCE7]/50 text-[#64748B] font-medium hover:bg-[#DCFCE7]/30 transition-colors"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? <Play size={18} /> : <Pause size={18} />} {isPaused ? 'పునః ప్రారంభించు' : 'విరామం'}
              </button>
              <button
                className="flex-1 px-4 py-3 rounded-lg border border-[#DCFCE7]/50 text-[#DC2626] font-medium hover:bg-[#DC2626]/10 transition-colors"
                onClick={onCancel}
              >
                <X size={18} /> రద్దు
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}