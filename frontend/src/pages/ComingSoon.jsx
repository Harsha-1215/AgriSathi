import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import homeContent from '../data/homeContent';
import { Clock, Home } from 'lucide-react';

export default function ComingSoon() {
  const { lang } = useLanguage();
  const copy = homeContent[lang] || homeContent.en;

  return (
    <div className="coming-soon">
      <div className="coming-soon__content">
        <div className="coming-soon__icon">
          <Clock size={30} aria-hidden="true" />
        </div>
        <h1>{copy.common.comingSoonTitle}</h1>
        <p>{copy.common.comingSoon}</p>
        <Link className="home-button home-button--primary" to="/"><Home size={17} aria-hidden="true" />{copy.common.home}</Link>
      </div>
    </div>
  );
}