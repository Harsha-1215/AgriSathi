import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Mic, MicOff, Volume2, ArrowLeft, Bot, Check } from 'lucide-react';
import api from '../../services/api';

const serviceRouteMap = {
  'tractors-machinery': '/farmer/marketplace',
  'irrigation-equipment': '/farmer/marketplace',
  'seeds': '/farmer/marketplace',
  'fertilizers': '/farmer/marketplace',
  'pesticides-crop-protection': '/farmer/marketplace',
  'agricultural-equipment': '/farmer/marketplace',
  'organic-farming-products': '/farmer/marketplace',
  'fruits': '/farmer/marketplace',
  'vegetables': '/farmer/marketplace',
  'paddy-rice': '/farmer/marketplace',
  'cotton': '/farmer/marketplace',
  'chilli': '/farmer/marketplace',
  'maize': '/farmer/marketplace',
  'groundnut': '/farmer/marketplace',
  'other-agricultural-products': '/farmer/marketplace',
};

const serviceAliases = {
  te: {
    ట్రాక్టర్: 'tractors-machinery',
    యంత్రాలు: 'tractors-machinery',
    అద్దె: 'tractors-machinery',
    ನೀர்: 'irrigation-equipment',
    డ్రిప్: 'irrigation-equipment',
    పారుదల: 'irrigation-equipment',
    విత్తనాలు: 'seeds',
    బీజం: 'seeds',
    ఎరువులు: 'fertilizers',
    ఎరువు: 'fertilizers',
    పురుగుమందు: 'pesticides-crop-protection',
    పురుగు: 'pesticides-crop-protection',
    రక్స్: 'pesticides-crop-protection',
    పరికరాలు: 'agricultural-equipment',
    యಂತ್ರాలు: 'agricultural-equipment',
    పంట: 'seeds',
    వ్యవసాయం: 'tractors-machinery',
  },
  en: {
    tractor: 'tractors-machinery',
    machinery: 'tractors-machinery',
    rental: 'tractors-machinery',
    irrigation: 'irrigation-equipment',
    drip: 'irrigation-equipment',
    water: 'irrigation-equipment',
    seed: 'seeds',
    seeds: 'seeds',
    fertilizer: 'fertilizers',
    fertilizers: 'fertilizers',
    pesticide: 'pesticides-crop-protection',
    pesticides: 'pesticides-crop-protection',
    equipment: 'agricultural-equipment',
    agricultural: 'agricultural-equipment',
    crop: 'seeds',
    farming: 'tractors-machinery',
    organic: 'organic-farming-products',
    fruit: 'fruits',
    fruits: 'fruits',
    vegetable: 'vegetables',
    vegetables: 'vegetables',
    paddy: 'paddy-rice',
    rice: 'paddy-rice',
    cotton: 'cotton',
    chilli: 'chilli',
    maize: 'maize',
    groundnut: 'groundnut',
  },
  hi: {
    ट्रैक्टर: 'tractors-machinery',
    यंत्र: 'tractors-machinery',
    किराया: 'tractors-machinery',
    सिंचाई: 'irrigation-equipment',
    ड्रिप: 'irrigation-equipment',
    पानी: 'irrigation-equipment',
    बीज: 'seeds',
    बीजों: 'seeds',
    खाद: 'fertilizers',
    उर्वरक: 'fertilizers',
    कीटनाशक: 'pesticides-crop-protection',
    कीट: 'pesticides-crop-protection',
    उपकरण: 'agricultural-equipment',
    कृषि: 'agricultural-equipment',
    फसल: 'seeds',
    खेती: 'tractors-machinery',
    जैविक: 'organic-farming-products',
    फल: 'fruits',
    फलों: 'fruits',
    सब्जी: 'vegetables',
    सब्ज़ियाँ: 'vegetables',
    धान: 'paddy-rice',
    चावल: 'paddy-rice',
    कपास: 'cotton',
    मिर्च: 'chilli',
    मक्का: 'maize',
    मूंगफली: 'groundnut',
  },
};

const serviceTeluguDescriptions = {
  'tractors-machinery': 'ట్రాక్టర్లు మరియు వ్యవసాయ యంత్రాల అద్దె సేవలు.',
  'irrigation-equipment': 'నీటి పారుదల మరియు డ్రిప్ ఇరిగేషన్ పరికరాలు.',
  'seeds': 'విత్తనాలు మరియు నాటి పదార్థాలు.',
  'fertilizers': 'ఎరువులు మరియు పोषక తత్వాలు.',
  'pesticides-crop-protection': 'పురుగుమందులు మరియు పంట రక్షణ.',
  'agricultural-equipment': 'వ్యవసాయ పరికరాలు మరియు యంత్రాలు.',
  'organic-farming-products': 'సేంద్రియ వ్యవసాయ ఉత్పత్తులు.',
  'fruits': 'పండ్లు మరియు తేయాలు.',
  'vegetables': 'కూరగాయలు మరియు తర్కಾರಿ.',
  'paddy-rice': 'వరి మరియు బియ్యం.',
  'cotton': 'పత్తి.',
  'chilli': 'మిరప.',
  'maize': 'మొక్కజొన్న.',
  'groundnut': 'వేరుశెనగ.',
  'other-agricultural-products': 'ఇతర వ్యవసాయ ఉత్పత్తులు.',
};

const welcomeGreeting = {
  te: 'నమస్కారం! అగ్రిసాథికి స్వాగతం. మీకు ఎVAILABLE späten సేవలు చెబుతున్నాను.',
  en: 'Namaste! Welcome to AGRISATHI. Let me tell you about the available services.',
  hi: 'नमस्ते! अग्रिसाथी में आपका स्वागत है. उपलब्ध सेवाएं बताता हूँ.',
};

const selectPrompt = {
  te: 'మీకు ఇప్పుడు ఏ వ్యవసాయ సేవ కావాలి? దయచేసి చెప్పండి.',
  en: 'Which agricultural service do you need now? Please tell me.',
  hi: 'आपको अब किस कृषि सेवा की आवश्यकता है? कृपया बताएं.',
};

export default function VoiceServiceSelection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, setLang } = useLanguage();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(selectPrompt[lang] || selectPrompt.te);
  const [recognizedText, setRecognizedText] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);

  const languageCode = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';

  useEffect(() => {
    setLang('te');
    fetchServices();
    speakWelcome();
  }, [setLang]);

  const fetchServices = async () => {
    try {
      const response = await api.get('/public/services');
      setServices(response.data.data || []);
    } catch (err) {
      setError('సేవలను लोడ్ చేయలేకపోయాం. మళ్లీ ప్రయత్నించండి.');
    } finally {
      setLoading(false);
    }
  };

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode;
    utterance.rate = 0.9;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [languageCode]);

  const speakWelcome = useCallback(() => {
    speak(welcomeGreeting[lang] || welcomeGreeting.te);
    setTimeout(() => {
      speak(selectPrompt[lang] || selectPrompt.te);
    }, 3000);
  }, [lang, speak]);

  const startListening = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('ఈ పరికరంలో స్వర గుర్తింపు మద్దతు లేదు.');
      return;
    }
    setError('');
    setListening(true);
    const recognition = new Recognition();
    recognition.lang = languageCode;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
      }
      setRecognizedText(final);
      if (final) {
        const selected = matchService(final);
        if (selected) {
          setSelectedService(selected);
          stopListening();
          navigateToService(selected);
        }
      }
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'not-allowed') {
        setError('మైక్రోఫోన్ అనుమతి అవసరం.');
      } else {
        setError('మీ మాట వినబడలేదు. మళ్లీ ప్రయత్నించండి.');
      }
      recognitionRef.current = null;
    };
    try { recognition.start(); } catch { setListening(false); recognitionRef.current = null; }
  }, [languageCode]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setListening(false);
  }, []);

  const matchService = (text) => {
    const lower = text.toLocaleLowerCase();
    const aliases = serviceAliases[lang] || serviceAliases.te;
    for (const [alias, slug] of Object.entries(aliases)) {
      if (lower.includes(alias.toLocaleLowerCase())) {
        return slug;
      }
    }
    return null;
  };

  const navigateToService = (slug) => {
    const route = serviceRouteMap[slug] || '/farmer/dashboard';
    setTimeout(() => {
      navigate(route, { replace: true, state: { service: slug, notice: `మీ సేవ ఎంపిక చేయబడింది: ${slug}` } });
    }, 1000);
  };

  const handleSelectService = (slug) => {
    setSelectedService(slug);
    navigateToService(slug);
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (loading) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-[#F8FAF7] p-4 text-[#172B1D]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#166534]" />
          <p className="mt-4 text-[#64748B]">సేవలు लोడ్ అవుతున్నాయి…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#F8FAF7] text-[#172B1D] p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/farmer/dashboard" className="inline-flex items-center gap-2 text-[#166534] font-medium hover:text-[#14532D] transition-colors">
            <ArrowLeft size={18} /> డాష్‌బోర్డ్
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#DCFCE7]/30 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Bot size={24} className="text-[#166534]" />
            <h1 className="text-2xl font-bold text-[#172B1D]">సేవల ఎంపిక / Service Selection</h1>
          </div>
          <p className="text-[#64748B] text-lg mb-6">{currentPrompt}</p>
          {recognizedText && <p className="text-[#166534] font-medium text-sm mb-4">మీరు: {recognizedText}</p>}
          {error && <p className="text-[#DC2626] text-sm font-medium mb-4">{error}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => {
            const isSelected = selectedService === service.slug;
            return (
              <button
                key={service.slug}
                className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-[#166534] bg-[#DCFCE7]/30 text-[#166534]'
                    : 'border-[#DCFCE7]/50 text-[#64748B] hover:border-[#166534] hover:text-[#166534] hover:bg-[#F8FAF7]'
                }`}
                onClick={() => handleSelectService(service.slug)}
                aria-label={service.telugu || service.name}
              >
                <div className="w-12 h-12 rounded-full bg-[#166534]/10 flex items-center justify-center mb-2">
                  <span className="text-2xl">{service.icon === 'tractor' ? '🚜' : service.icon === 'droplets' ? '💧' : service.icon === 'sprout' ? '🌱' : service.icon === 'flask-conical' ? '🧪' : service.icon === 'shield-check' ? '🛡️' : service.icon === 'wrench' ? '🔧' : service.icon === 'apple' ? '🍎' : service.icon === 'carrot' ? '🥕' : service.icon === 'wheat' ? '🌾' : service.icon === 'flower' ? '🌺' : service.icon === 'flame' ? '🌶️' : service.icon === 'nut' ? '🥜' : service.icon === 'package' ? '📦' : '🌿'}</span>
                </div>
                <div className="text-center">
                  <div className={`font-bold text-lg ${isSelected ? 'text-[#166534]' : 'text-[#172B1D]'}`}>{service.telugu || service.name}</div>
                  <div className="text-xs text-[#64748B] mt-1">{service.name}</div>
                  <div className="text-[10px] text-[#64748B] mt-2">{serviceTeluguDescriptions[service.slug] || service.description}</div>
                </div>
                {isSelected && <Check size={20} className="text-[#166534]" />}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 mt-8">
          <button
            className={`flex-1 px-6 py-4 rounded-xl font-semibold text-lg transition-all ${listening ? 'bg-[#DC2626] text-white' : 'bg-[#166534] text-white'}`}
            onClick={listening ? stopListening : startListening}
            aria-label={listening ? 'Stop listening' : 'Start listening'}
          >
            {listening ? <MicOff size={24} strokeWidth={2.5} /> : <Mic size={24} strokeWidth={2.5} />}
            <span className="ml-2">{listening ? 'వింటున్నాం…' : 'మాట్లాడండి / Speak'}</span>
          </button>
          <button
            className="flex-1 px-6 py-4 rounded-xl font-semibold text-lg border border-[#DCFCE7]/50 text-[#64748B] hover:bg-[#DCFCE7]/30 transition-colors"
            onClick={() => speak(selectPrompt[lang] || selectPrompt.te)}
            aria-label="Repeat prompt"
          >
            <Volume2 size={20} />
          </button>
        </div>

        {speaking && (
          <div className="mt-4 flex items-center gap-2 text-[#64748B] text-sm">
            <Volume2 size={16} className="animate-pulse" />
            మాట్లాడುತ್ತున్నాం…
          </div>
        )}
      </div>
    </section>
  );
}