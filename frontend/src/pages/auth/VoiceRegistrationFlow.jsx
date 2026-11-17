import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Home, ArrowLeft, Mic, Volume2 } from 'lucide-react';
import Logo from '../../components/common/Logo';
import VoiceConversationUI from '../../components/voice/VoiceConversationUI';

const ROLE_LABELS = {
  te: { farmer: 'రైతు', service_provider: 'సేవలందించేవారు' },
  en: { farmer: 'Farmer', service_provider: 'Service Provider' },
  hi: { farmer: 'किसान', service_provider: 'सेवा प्रदाता' },
};

export default function VoiceRegistrationFlow() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { lang, setLang } = useLanguage();
  const location = useLocation();
  const [sessionId, setSessionId] = useState(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [completed, setCompleted] = useState(false);

  const roleLabel = (ROLE_LABELS[lang] || ROLE_LABELS.en)[user?.role || 'farmer'];

  useEffect(() => {
    setLang('te');
    if (isAuthenticated && user) {
      navigate(`/${user.role}/dashboard`, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const pending = localStorage.getItem('agrisathi_interaction_mode_pending');
    const mode = localStorage.getItem('agrisathi_interaction_mode');
    if (pending === 'true' && mode === 'voice') {
      setVoiceMode(true);
    }
  }, []);

  const handleStartVoice = () => {
    setVoiceMode(true);
    localStorage.setItem('agrisathi_interaction_mode', 'voice');
    if (isAuthenticated) {
      // Already logged in, just show voice assistant
    }
  };

  const handleComplete = () => {
    setCompleted(true);
    navigate('/voice-services', { replace: true, state: { notice: 'వాయిస్ నమోదు విజయవంతం. సేవను ఎంచుకోండి.' } });
  };

  const handleCancel = () => {
    setVoiceMode(false);
    navigate('/register', { replace: true });
  };

  if (completed) return null;

  if (isAuthenticated && user) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-[#F8FAF7] p-4 text-[#172B1D]">
        <div className="text-center max-w-md">
          <div className="bg-[#166534] text-white rounded-2xl p-8 text-center shadow-xl">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-2xl font-bold mb-2">ఖాతా సృష్టించబడింది!</h2>
            <p className="text-[#DCFCE7]/90">మీ అగ్రిసాథి ఖాతా విజయవంతంగా సృష్టించబడింది. సేవను ఎంచుకోండి...</p>
          </div>
          <div className="mt-6 flex gap-3 justify-center">
            <button
              className="bg-[#166534] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#14532D] transition-colors"
              onClick={() => navigate('/voice-services', { replace: true })}
            >
                <Home size={18} /> సేవను ఎంచుకోండి
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!voiceMode) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-[#F8FAF7] p-4 text-[#172B1D]">
        <div className="text-center max-w-md">
          <Logo size="large" className="mb-6" />
          <h1 className="text-3xl md:text-4xl font-bold text-[#172B1D] mb-4">
            ఒక విధానాన్ని ఎంచుకోండి / Choose an option
          </h1>
          <p className="text-[#64748B] text-lg mb-8">
            మీరు చదువుకున్నారా? మీ నావిన్ ఎంపిక దేని ఆధారపడినదే కాదు.
          </p>
          <div className="flex flex-col gap-4">
            <button
              className="flex-1 bg-[#166534] text-white px-6 py-4 rounded-xl font-semibold text-lg shadow-lg hover:bg-[#14532D] transition-all"
              onClick={() => {
                localStorage.setItem('agrisathi_interaction_mode', 'normal');
                navigate('/register', { replace: true });
              }}
            >
              {'అవును, నేను చదువుకున్నాను'}
              <br />
              <span className="text-sm opacity-90">Educated ·Normal interface</span>
            </button>
            <button
              className="flex-1 bg-white border-2 border-[#166534] text-[#166534] px-6 py-4 rounded-xl font-semibold text-lg shadow-lg hover:bg-[#DCFCE7]/50 transition-all"
              onClick={handleStartVoice}
            >
              {'లేదు, నాకు చదువు లేదు'}
              <br />
              <span className="text-sm opacity-90">Not educated · Telugu voice mode</span>
            </button>
          </div>
          <p className="mt-6 text-xs text-[#64748B]">
            ఈ ఎంపిక మీ సామర్థ్యాన్ని నిర్ణయించదు; ఎప్పుడైనా మార్చుకోవచ్చు.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#F8FAF7] text-[#172B1D]">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Link to="/register" className="inline-flex items-center gap-2 text-[#166534] font-medium hover:text-[#14532D] transition-colors">
            <ArrowLeft size={18} /> తిరిగి నమోదు
          </Link>
          <div className="text-right">
            <div className="text-xs font-medium text-[#64748B]">అగ్రిసాథి స్వర నమోదు</div>
            <div className="text-sm font-bold">తెలుగు 목소리 రద్దు</div>
          </div>
        </div>

        <VoiceConversationUI
          sessionId={sessionId}
          language={lang}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>
    </section>
  );
}