import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Handshake, Sprout, Store } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import authContent from '../../data/authContent';
import Logo from '../../components/common/Logo';

const roleIcons = {
  farmer: Sprout,
  provider: BriefcaseBusiness,
  buyer: Handshake,
  seller: Store,
};

export default function RoleSelection() {
  const { lang } = useLanguage();
  const location = useLocation();
  const copy = authContent[lang] || authContent.en;

  return (
    <section className="auth-card auth-card--wide">
      <div className="auth-card__brand"><Logo size="small" /></div>
      <p className="auth-eyebrow">{copy.joinTitle}</p>
      <h1>{copy.roleTitle}</h1>
      <p className="auth-description">{copy.roleDescription}</p>
      {location.state?.message && <p className="auth-alert auth-alert--error" role="alert">{location.state.message}</p>}
      <div className="auth-role-grid">
        {Object.entries(copy.roles).map(([role, [title, description]]) => {
          const Icon = roleIcons[role];
          return (
            <Link to={`/register/${role}`} className="auth-role-card" key={role}>
              <span className="auth-role-card__icon"><Icon size={23} aria-hidden="true" /></span>
              <span className="auth-role-card__text"><strong>{title}</strong><small>{description}</small></span>
              <ArrowRight className="auth-role-card__arrow" size={19} aria-hidden="true" />
            </Link>
          );
        })}
      </div>
      <p className="auth-switch"><Link to="/register/voice">తెలుగు స్వరంతో నమోదు / Register with Telugu voice</Link></p>
      <p className="auth-switch">{copy.alreadyAccount} <Link to="/login">{copy.login}</Link></p>
    </section>
  );
}
