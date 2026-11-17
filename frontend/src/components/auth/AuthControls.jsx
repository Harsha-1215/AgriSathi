import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function AuthField({
  name,
  label,
  type = 'text',
  register,
  error,
  required = false,
  optionalLabel,
  showPasswordLabel = 'Show password',
  hidePasswordLabel = 'Hide password',
  rules = {},
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);
  const inputType = type === 'password' && visible ? 'text' : type;
  const passwordActions = type === 'password';

  return (
    <div className="auth-field">
      <label htmlFor={name}>
        {label}{required && <span aria-hidden="true"> *</span>}
        {!required && optionalLabel && <small>{` ${optionalLabel}`}</small>}
      </label>
      <div className={`auth-field__control${passwordActions ? ' auth-field__control--password' : ''}`}>
        <input
          id={name}
          type={inputType}
          autoComplete={inputProps.autoComplete || (type === 'password' ? 'current-password' : undefined)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          {...register(name, rules)}
          {...inputProps}
        />
        {passwordActions && (
          <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? hidePasswordLabel : showPasswordLabel}>
            {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
          </button>
        )}
      </div>
      {error && <span className="auth-field__error" id={`${name}-error`} role="alert">{error.message}</span>}
    </div>
  );
}

export function AuthSelect({ name, label, options, register, error, required = false, requiredMessage, optionalLabel, emptyLabel, ...selectProps }) {
  return (
    <div className="auth-field">
      <label htmlFor={name}>{label}{required && <span aria-hidden="true"> *</span>}{!required && optionalLabel && <small>{` ${optionalLabel}`}</small>}</label>
      <select id={name} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} {...register(name, { required: required ? requiredMessage : false })} {...selectProps}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option value={option} key={option}>{option}</option>)}
      </select>
      {error && <span className="auth-field__error" id={`${name}-error`} role="alert">{error.message}</span>}
    </div>
  );
}

export function FormProgress({ steps, activeIndex, label }) {
  const percentage = Math.round(((activeIndex + 1) / steps.length) * 100);
  return (
    <div className="auth-progress" aria-label={`${label} ${activeIndex + 1} of ${steps.length}`}>
      <div className="auth-progress__labels">
        {steps.map((step, index) => (
          <span className={index <= activeIndex ? 'is-current' : ''} key={step}>{step}</span>
        ))}
      </div>
      <div className="auth-progress__track" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={activeIndex + 1} aria-label={label}>
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
