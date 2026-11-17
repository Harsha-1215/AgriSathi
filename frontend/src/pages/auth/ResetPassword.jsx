import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CheckCircle2 } from 'lucide-react';
import { AuthField } from '../../components/auth/AuthControls';
import { useLanguage } from '../../context/LanguageContext';
import authContent from '../../data/authContent';
import authService, { getAuthError } from '../../services/authService';

export default function ResetPassword() {
  const { lang } = useLanguage();
  const copy = authContent[lang] || authContent.en;
  const location = useLocation();
  const flow = location.state;
  const [errorMessage, setErrorMessage] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors } } = useForm({ mode: 'onTouched' });

  if (!flow?.resetToken) return <Navigate to="/forgot-password" replace />;

  const onSubmit = async ({ password }) => {
    setSubmitting(true);
    setErrorMessage('');
    try {
      await authService.resetPassword({ resetToken: flow.resetToken, password });
      setDone(true);
    } catch (error) {
      setErrorMessage(getAuthError(error, copy).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-card auth-card--compact">
      <span className="auth-card__icon"><CheckCircle2 size={24} aria-hidden="true" /></span>
      <p className="auth-eyebrow">AGRISATHI</p>
      <h1>{done ? copy.resetSuccessTitle : copy.resetTitle}</h1>
      <p className="auth-description">{done ? copy.resetSuccess : copy.resetDescription}</p>
      {!done && (
        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <AuthField name="password" label={copy.newPassword} type="password" register={register} error={errors.password} required showPasswordLabel={copy.showPassword} hidePasswordLabel={copy.hidePassword} rules={{ required: copy.errors.required, minLength: { value: 8, message: copy.errors.passwordLength } }} autoComplete="new-password" />
          <AuthField name="confirmPassword" label={copy.confirmPassword} type="password" register={register} error={errors.confirmPassword} required showPasswordLabel={copy.showPassword} hidePasswordLabel={copy.hidePassword} rules={{ required: copy.errors.required, validate: (value) => value === getValues('password') || copy.errors.passwordMismatch }} autoComplete="new-password" />
          {errorMessage && <p className="auth-alert auth-alert--error" role="alert">{errorMessage}</p>}
          <button className="auth-button auth-button--primary auth-button--full" type="submit" disabled={submitting}>{submitting ? copy.submitting : copy.resetPassword}</button>
        </form>
      )}
      {done && <Link to="/login" className="auth-button auth-button--primary auth-button--full">{copy.loginLink}</Link>}
    </section>
  );
}
