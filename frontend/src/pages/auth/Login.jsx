import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { AuthField } from '../../components/auth/AuthControls';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import authContent from '../../data/authContent';
import { getAuthError } from '../../services/authService';

export default function Login() {
  const { lang } = useLanguage();
  const copy = authContent[lang] || authContent.en;
  const { login, isAuthenticated, user, restoreError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ mode: 'onTouched' });

  if (isAuthenticated) {
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  const onSubmit = async ({ identifier, password, rememberMe }) => {
    setServerError('');
    setSubmitting(true);
    try {
      const authenticatedUser = await login({ identifier, password, rememberMe: Boolean(rememberMe) });
      const requestedPath = location.state?.from?.pathname;
      navigate(requestedPath && requestedPath.startsWith('/') ? requestedPath : `/${authenticatedUser.role}/dashboard`, { replace: true });
    } catch (error) {
      const authError = getAuthError(error, copy);
      const code = String(error?.response?.data?.code || error?.response?.data?.status || '').toLowerCase();
      if (code.includes('pending') || code.includes('suspend')) {
        navigate(`/account-status?status=${code.includes('suspend') ? 'suspended' : 'pending'}`, { replace: true });
      } else {
        setServerError(authError.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-card auth-card--compact">
      <span className="auth-card__icon"><LockKeyhole size={24} aria-hidden="true" /></span>
      <p className="auth-eyebrow">AGRISATHI</p>
      <h1>{copy.loginTitle}</h1>
      <p className="auth-description">{copy.loginDescription}</p>
      {location.state?.notice && <p className="auth-alert auth-alert--success" role="status">{location.state.notice}</p>}
      {location.state?.sessionExpired && <p className="auth-alert auth-alert--error" role="alert">{copy.sessionExpired}</p>}
      {restoreError && <p className="auth-alert auth-alert--error" role="alert">{getAuthError(restoreError, copy).message}</p>}
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField name="identifier" label={copy.identifier} register={register} error={errors.identifier} required rules={{ required: copy.errors.required }} autoComplete="username" />
        <AuthField name="password" label={copy.password} type="password" register={register} error={errors.password} required showPasswordLabel={copy.showPassword} hidePasswordLabel={copy.hidePassword} rules={{ required: copy.errors.required }} autoComplete="current-password" />
        <div className="auth-login-options">
          <label className="auth-check"><input type="checkbox" {...register('rememberMe')} /><span>{copy.rememberMe}</span></label>
          <Link to="/forgot-password">{copy.forgotPassword}</Link>
        </div>
        {serverError && <p className="auth-alert auth-alert--error" role="alert">{serverError}</p>}
        <button className="auth-button auth-button--primary auth-button--full" type="submit" disabled={submitting}>
          {submitting ? copy.sending : copy.loginButton}<ArrowRight size={17} />
        </button>
      </form>
      <p className="auth-switch">{copy.noAccount} <Link to="/register">{copy.createAccount}</Link></p>
    </section>
  );
}
