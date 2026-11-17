import { useLanguage } from '../context/LanguageContext';
import homeContent from '../data/homeContent';
import {
  AboutSection,
  AgriShortsSection,
  CTASection,
  FarmerFriendlySection,
  FeaturesSection,
  HeroSection,
  HowItWorksSection,
  KnowledgeSection,
  MarketplaceSection,
  SchemesSection,
  ServicesSection,
  TrustHighlights,
  VoiceAssistantSection,
  WhyChooseSection,
} from '../components/home/HomeSections';
import '../styles/home.css';

export default function Welcome() {
  const { lang } = useLanguage();
  const copy = homeContent[lang] || homeContent.en;

  return (
    <div className="home-page">
      <HeroSection copy={copy.hero} />
      <TrustHighlights items={copy.trust} />
      <AboutSection copy={copy.about} />
      <FeaturesSection copy={copy.features} exploreLabel={copy.common.explore} />
      <VoiceAssistantSection copy={copy.voice} />
      <HowItWorksSection copy={copy.steps} />
      <KnowledgeSection copy={copy.knowledge} />
      <AgriShortsSection copy={copy.shorts} />
      <SchemesSection copy={copy.schemes} />
      <MarketplaceSection copy={copy.marketplace} />
      <ServicesSection copy={copy.services} />
      <WhyChooseSection copy={copy.why} />
      <FarmerFriendlySection copy={copy.simple} />
      <CTASection copy={copy.cta} />
    </div>
  );
}
