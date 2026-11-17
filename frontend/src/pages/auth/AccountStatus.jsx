import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Clock3, LockKeyhole } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import authContent from '../../data/authContent';

export default function AccountStatus() {
  const { lang } = useLanguage();
  const copy = authContent[lang] || authContent.en;
  const [params] = useSearchParams();
  const status = params.get('status');
  const details = status === 'pending'
    ? { icon: Clock3, title: copy.pendingTitle, description: copy.pendingDescription }
    : status === 'suspended'
      ? { icon: LockKeyhole, title: copy.suspendedTitle, description: copy.suspendedDescription }
      : { icon: AlertCircle, title: copy.unauthorizedTitle, description: copy.unauthorizedDescription };
  const Icon = details.icon;

  return (
    <section className="auth-card auth-card--compact auth-status-card">
      <span className="auth-card__icon"><Icon size={24} aria-hidden="true" /></span>
      <h1>{details.title}</h1>
      <p className="auth-description">{details.description}</p>
      <Link to="/login" className="auth-button auth-button--primary auth-button--full">{copy.backToLogin}</Link>
    </section>
  );
}
