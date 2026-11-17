import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { AuthField } from '../../components/auth/AuthControls';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import authContent from '../../data/authContent';
import authService, { getAuthError } from '../../services/authService';

export default function VerifyOtp() {
  const { lang } = useLanguage();
  const copy = authContent[lang] || authContent.en;
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithRecoveryOtp } = useAuth();
  const flow = location.state;
  const identifier = flow?.identifier;
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [seconds, setSeconds] = useState(flow?.otpRequested ? 30 : 0);
  const [message, setMessage] = useState(flow?.otpRequested ? copy.otpSent : '');
  const [errorMessage, setErrorMessage] = useState(flow?.sendError || '');
  const { register, handleSubmit, formState: { errors } } = useForm({ mode: 'onTouched' });
  const purpose = flow?.purpose || 'password_reset';

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  if (!identifier) return <Navigate to="/forgot-password" replace />;
  if (purpose !== 'password_reset') return <Navigate to="/login" replace />;

  const resend = async () => {
    setSending(true);
    setMessage('');
    setErrorMessage('');
    try {
      await authService.sendOtp({ identifier, purpose });
      setMessage(copy.otpSent);
      setSeconds(30);
    } catch (error) {
      setErrorMessage(getAuthError(error, copy).message);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = async ({ otp }) => {
    setVerifying(true);
    setErrorMessage('');
    try {
      const authenticatedUser = await loginWithRecoveryOtp({ identifier, otp });
      navigate(`/${authenticatedUser.role}/dashboard`, { replace: true });
    } catch (error) {
      setErrorMessage(getAuthError(error, copy).message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <section className="auth-card auth-card--compact">
      <span className="auth-card__icon"><ShieldCheck size={24} aria-hidden="true" /></span>
      <p className="auth-eyebrow">AGRISATHI</p>
      <h1>{copy.recoveryOtpTitle}</h1>
      <p className="auth-description">{copy.recoveryOtpDescription}</p>
      <p className="auth-identifier">{identifier}</p>
      {message && <p className="auth-alert auth-alert--success" role="status">{message}</p>}
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField
          name="otp"
          label={copy.otpCode}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          register={register}
          error={errors.otp}
          required
          rules={{
            required: copy.errors.required,
            pattern: { value: /^[0-9]{6}$/, message: copy.invalidOtp },
          }}
        />
        {errorMessage && <p className="auth-alert auth-alert--error" role="alert">{errorMessage}</p>}
        <button className="auth-button auth-button--primary auth-button--full" type="submit" disabled={verifying}>
          {verifying ? copy.verifying : copy.verify}
        </button>
      </form>
      <div className="auth-resend">
        <button type="button" className="auth-text-button" onClick={resend} disabled={sending || seconds > 0}>
          {sending ? copy.sending : copy.resend}
        </button>
        {seconds > 0 && <span>{copy.resendIn} 00:{String(seconds).padStart(2, '0')}</span>}
      </div>
      <Link to="/login" className="auth-back-link"><ArrowLeft size={16} />{copy.backToLogin}</Link>
    </section>
  );
}
