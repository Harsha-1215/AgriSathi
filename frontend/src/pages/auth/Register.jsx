import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { AuthField, AuthSelect, FormProgress } from '../../components/auth/AuthControls';
import { useLanguage } from '../../context/LanguageContext';
import authContent from '../../data/authContent';
import authService, { getAuthError } from '../../services/authService';

const commonFields = ['fullName', 'mobile', 'email', 'password', 'confirmPassword'];
const requiredKeys = new Set(['fullName', 'mobile', 'password', 'confirmPassword', 'businessName', 'contactPerson', 'landArea', 'areaUnit', 'primaryCrop', 'state', 'district', 'qualification', 'specialization', 'serviceCategories', 'serviceCoverage', 'serviceDescription', 'buyerCategory', 'productInterests', 'sellerCategory', 'productCategories']);

function getStepFields(role, copy) {
  const steps = [{ title: copy.stepPersonal, fields: role === 'provider'
    ? ['businessName', 'contactPerson', 'mobile', 'email', 'password', 'confirmPassword']
    : commonFields }];

  if (role === 'farmer') {
    steps.push({ title: copy.stepFarm, fields: ['landArea', 'areaUnit', 'primaryCrop', 'otherCrops', 'soilType', 'irrigationType', 'experience', 'preferredLanguage'] });
    steps.push({ title: copy.stepLocation, fields: ['state', 'district', 'mandal', 'village', 'pinCode', 'farmLocation'] });
  } else if (role === 'provider') {
    steps.push({ title: copy.stepBusiness, fields: ['serviceCategories', 'serviceCoverage', 'serviceDescription', 'pricing', 'workingHours', 'businessDocuments'] });
    steps.push({ title: copy.stepLocation, fields: ['state', 'district', 'village', 'pinCode'] });
  } else if (role === 'buyer') {
    steps.push({ title: copy.stepBusiness, fields: ['buyerCategory', 'productInterests', 'organization', 'description'] });
    steps.push({ title: copy.stepLocation, fields: ['state', 'district', 'mandal', 'village', 'pinCode'] });
  } else if (role === 'seller') {
    steps.push({ title: copy.stepBusiness, fields: ['sellerCategory', 'productCategories', 'organization', 'description'] });
    steps.push({ title: copy.stepLocation, fields: ['state', 'district', 'mandal', 'village', 'pinCode'] });
  }
  steps.push({ title: copy.stepReview, fields: ['agreeTerms', 'notifications'] });
  return steps;
}

function textInputType(key) {
  if (key === 'email') return 'email';
  if (key === 'mobile') return 'tel';
  if (key === 'password' || key === 'confirmPassword') return 'password';
  if (key === 'landArea' || key === 'experience') return 'number';
  return 'text';
}

function getFieldRules(key, copy, getValues) {
  const rules = {};
  if (requiredKeys.has(key)) rules.required = copy.errors.required;
  if (key === 'mobile') rules.pattern = { value: /^\+?[0-9 ()-]{8,15}$/, message: copy.errors.invalidMobile };
  if (key === 'email') rules.pattern = { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: copy.errors.invalidEmail };
  if (key === 'password') rules.minLength = { value: 8, message: copy.errors.passwordLength };
  if (key === 'confirmPassword') rules.validate = (value) => value === getValues('password') || copy.errors.passwordMismatch;
  if (key === 'landArea' || key === 'experience') rules.min = { value: 0, message: copy.errors.required };
  if (key === 'pinCode') rules.pattern = { value: /^[0-9]{5,10}$/, message: copy.errors.required };
  return rules;
}

function MultiSelectField({ name, label, options, register, setValue, watch, error, required, copy }) {
  const selected = watch(name) || [];
  const validation = required ? { validate: (values) => (Array.isArray(values) && values.length > 0) || copy.errors.required } : {};
  const registration = register(name, validation);
  return (
    <fieldset className="auth-field auth-multi-field">
      <legend>{label}{required && <span aria-hidden="true"> *</span>}</legend>
      <div className="auth-choice-grid">
        {options.map((option) => (
          <label className="auth-check auth-check--choice" key={option}>
            <input
              type="checkbox"
              name={registration.name}
              ref={registration.ref}
              value={option}
              checked={selected.includes(option)}
              onBlur={registration.onBlur}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, option]
                  : selected.filter((item) => item !== option);
                setValue(name, next, { shouldDirty: true, shouldValidate: true });
              }}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {error && <span className="auth-field__error" role="alert">{error.message}</span>}
    </fieldset>
  );
}

function RenderField({ name, copy, methods }) {
  const { register, formState: { errors }, setValue, watch, getValues } = methods;
  const label = copy[name];
  const required = requiredKeys.has(name);
  const optionalLabel = copy.optional;
  const error = errors[name];
  const rules = getFieldRules(name, copy, getValues);
  const selectOptions = {
    areaUnit: copy.areaUnits,
    primaryCrop: copy.crops,
    soilType: copy.soilOptions,
    irrigationType: copy.irrigationOptions,
    specialization: copy.specializations,
    buyerCategory: copy.buyerCategories,
    sellerCategory: copy.sellerCategories,
    preferredLanguage: ['English', 'తెలుగు', 'हिन्दी'],
  };
  const multiOptions = {
    otherCrops: copy.crops,
    languages: ['English', 'తెలుగు', 'हिन्दी'],
    serviceCategories: copy.services,
    productInterests: copy.crops,
    productCategories: copy.crops,
  };

  if (multiOptions[name]) {
    return <MultiSelectField name={name} label={label} options={multiOptions[name]} register={register} setValue={setValue} watch={watch} error={error} required={required} copy={copy} />;
  }
  if (selectOptions[name]) {
    return <AuthSelect name={name} label={label} options={selectOptions[name]} register={register} error={error} required={required} requiredMessage={copy.errors.required} optionalLabel={optionalLabel} emptyLabel={copy.select} />;
  }
  if (name === 'certificate' || name === 'businessDocuments') {
    return (
      <div className="auth-field">
        <label htmlFor={name}>{label}<small>{` ${optionalLabel}`}</small></label>
        <input id={name} type="file" accept=".pdf,.jpg,.jpeg,.png" aria-invalid={Boolean(error)} {...register(name, {
          validate: (files) => !files?.length || files[0].size <= 5 * 1024 * 1024 || copy.errors.fileSize,
        })} />
        {error && <span className="auth-field__error" role="alert">{error.message}</span>}
        <small>{copy.fileHint}</small>
      </div>
    );
  }
  if (name === 'serviceDescription' || name === 'description' || name === 'farmLocation') {
    return (
      <div className="auth-field">
        <label htmlFor={name}>{label}{required && <span aria-hidden="true"> *</span>}{!required && <small>{optionalLabel}</small>}</label>
        <textarea id={name} rows={3} aria-invalid={Boolean(error)} {...register(name, rules)} />
        {error && <span className="auth-field__error" role="alert">{error.message}</span>}
      </div>
    );
  }
  return (
    <AuthField
      name={name}
      label={label}
      type={textInputType(name)}
      register={register}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      showPasswordLabel={copy.showPassword}
      hidePasswordLabel={copy.hidePassword}
      rules={rules}
      min={name === 'landArea' || name === 'experience' ? 0 : undefined}
      step={name === 'landArea' ? 'any' : undefined}
      autoComplete={name === 'password' ? 'new-password' : name === 'confirmPassword' ? 'new-password' : name}
    />
  );
}

export default function Register() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const copy = authContent[lang] || authContent.en;
  const roleKeys = Object.keys(copy.roles);
  const steps = useMemo(() => roleKeys.includes(role) ? getStepFields(role, copy) : [], [role, copy]);
  const [stepIndex, setStepIndex] = useState(0);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const methods = useForm({ mode: 'onTouched', defaultValues: { notifications: false, otherCrops: [], languages: [], serviceCategories: [], productInterests: [], productCategories: [] } });
  const { handleSubmit, trigger, register, formState: { errors } } = methods;
  const activeStep = steps[stepIndex];

  if (!activeStep) return <Navigate to="/register" replace state={{ message: copy.roleNotFound }} />;

  const goNext = async () => {
    const valid = await trigger(activeStep.fields);
    if (valid) setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const onSubmit = async (values) => {
    setServerError('');
    setSubmitting(true);
    const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [
      key,
      typeof FileList !== 'undefined' && value instanceof FileList ? value[0] : value,
    ]));
    payload.role = role;
    try {
      await authService.register(payload);
      navigate('/login', { replace: true, state: { notice: copy.registrationSuccess } });
    } catch (error) {
      setServerError(getAuthError(error, copy).message);
    } finally {
      setSubmitting(false);
    }
  };

  const finalStep = stepIndex === steps.length - 1;
  const fieldLabel = (name) => {
    const options = { agreeTerms: copy.terms, notifications: copy.notifications };
    return options[name] || copy[name];
  };

  return (
    <section className="auth-card auth-card--wide">
      <div className="auth-card__heading">
        <div>
          <p className="auth-eyebrow">{copy.roles[role][0]}</p>
          <h1>{copy.joinTitle}</h1>
          <p className="auth-description">{copy.joinDescription}</p>
        </div>
        <Link className="auth-back-link" to="/register">{copy.registerRoles}</Link>
      </div>
      <FormProgress steps={steps.map((step) => step.title)} activeIndex={stepIndex} label={copy.step} />
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="auth-form-grid">
          {activeStep.fields.map((name) => {
            if (name === 'agreeTerms' || name === 'notifications') {
              return (
                <label className="auth-check auth-check--wide" key={name}>
                  <input type="checkbox" {...register(name, name === 'agreeTerms' ? { required: copy.errors.terms } : {})} />
                  <span>{fieldLabel(name)}</span>
                </label>
              );
            }
            return <RenderField name={name} copy={copy} methods={methods} key={name} />;
          })}
        </div>
        {errors.agreeTerms && <p className="auth-field__error" role="alert">{errors.agreeTerms.message}</p>}
        {serverError && <p className="auth-alert auth-alert--error" role="alert">{serverError}</p>}
        <div className="auth-form__actions">
          {stepIndex > 0
            ? <button className="auth-button auth-button--secondary" type="button" onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}><ArrowLeft size={17} />{copy.back}</button>
            : <Link className="auth-button auth-button--secondary" to="/register"><ArrowLeft size={17} />{copy.back}</Link>}
          {finalStep
            ? <button className="auth-button auth-button--primary" type="submit" disabled={submitting}>{submitting ? copy.submitting : copy.submitRegistration}<Check size={17} /></button>
            : <button className="auth-button auth-button--primary" type="button" onClick={goNext}>{copy.next}<ArrowRight size={17} /></button>}
        </div>
      </form>
      <p className="auth-switch">{copy.alreadyAccount} <Link to="/login">{copy.login}</Link></p>
    </section>
  );
}
