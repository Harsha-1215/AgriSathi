import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { AuthField } from '../../components/auth/AuthControls';
import { useLanguage } from '../../context/LanguageContext';
import authContent from '../../data/authContent';
import authService, { getAuthError } from '../../services/authService';

export default function ForgotPassword() {
  const { lang } = useLanguage();
  const copy = authContent[lang] || authContent.en;
  const location = useLocation();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const initialIdentifier = location.state?.identifier;
  const { register, handleSubmit, formState: { errors } } = useForm({
    mode: 'onTouched',
    defaultValues: { identifier: typeof initialIdentifier === 'string' && !initialIdentifier.includes('@') ? initialIdentifier : '' },
  });

  const onSubmit = async ({ identifier }) => {
    setErrorMessage('');
    setSubmitting(true);
    try {
      await authService.requestPasswordReset({ identifier });
      navigate('/verify-otp', { state: { identifier, purpose: 'password_reset', otpRequested: true } });
    } catch (error) {
      setErrorMessage(getAuthError(error, copy).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-card auth-card--compact">
      <span className="auth-card__icon"><KeyRound size={24} aria-hidden="true" /></span>
      <p className="auth-eyebrow">AGRISATHI</p>
      <h1>{copy.forgotTitle}</h1>
      <p className="auth-description">{copy.forgotDescription}</p>
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField
          name="identifier"
          label={copy.mobile}
          type="tel"
          inputMode="tel"
          register={register}
          error={errors.identifier}
          required
          rules={{
            required: copy.errors.required,
            pattern: { value: /^\+?[0-9 ()-]{8,18}$/, message: copy.errors.invalidMobile },
          }}
          autoComplete="tel"
        />
        {errorMessage && <p className="auth-alert auth-alert--error" role="alert">{errorMessage}</p>}
        <button className="auth-button auth-button--primary auth-button--full" type="submit" disabled={submitting}>{submitting ? copy.sending : copy.sendCode}</button>
      </form>
      <Link to="/login" className="auth-back-link"><ArrowLeft size={16} />{copy.backToLogin}</Link>
    </section>
  );
}
