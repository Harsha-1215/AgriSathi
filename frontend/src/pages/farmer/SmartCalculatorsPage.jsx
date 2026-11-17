import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Calculator, Droplets, Download, Leaf, Plus, Printer,
  Ruler, Sprout, Trash2, TrendingUp, Volume2, Wallet,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import content from '../../data/farmingToolsContent';
import '../../styles/farming-tools.css';

const calculatorTypes = [
  { id: 'seed', icon: Sprout },
  { id: 'fertilizer', icon: Leaf },
  { id: 'pesticide', icon: Leaf },
  { id: 'irrigation', icon: Droplets },
  { id: 'spacing', icon: Ruler },
  { id: 'yield', icon: TrendingUp },
  { id: 'expenses', icon: Wallet },
  { id: 'profit-loss', icon: TrendingUp },
  { id: 'loan', icon: Calculator },
];

const areaUnits = ['squareMetres', 'squareFeet', 'squareYards', 'acres', 'cents', 'hectares', 'ares', 'guntha'];

const fieldsByType = {
  seed: ['areaValue', 'areaUnit', 'seedRateKgPerAcre', 'germinationPercent'],
  fertilizer: ['areaValue', 'areaUnit', 'nutrientRateKgPerAcre', 'nutrientPercentage'],
  pesticide: ['labelRate', 'labelRateUnit', 'waterLitres', 'areaValue', 'areaUnit', 'labelSource', 'labelConfirmed'],
  irrigation: ['areaValue', 'areaUnit', 'depthMm', 'efficiencyPercent', 'flowRateLitresPerMinute'],
  spacing: ['areaValue', 'areaUnit', 'rowSpacingCm', 'plantSpacingCm'],
  yield: ['areaValue', 'areaUnit', 'yieldKgPerAcre', 'pricePerKg'],
  expenses: [],
  'profit-loss': ['revenue', 'totalExpenses'],
  loan: ['principal', 'annualInterestPercent', 'termMonths', 'currency'],
};

const numericFields = new Set([
  'areaValue', 'seedRateKgPerAcre', 'germinationPercent', 'nutrientRateKgPerAcre',
  'nutrientPercentage', 'labelRate', 'waterLitres', 'depthMm', 'efficiencyPercent',
  'flowRateLitresPerMinute', 'rowSpacingCm', 'plantSpacingCm', 'yieldKgPerAcre',
  'pricePerKg', 'amount', 'revenue', 'totalExpenses', 'principal', 'annualInterestPercent',
  'termMonths',
]);

const fieldLabels = {
  areaValue: 'area', areaUnit: 'areaUnit', seedRateKgPerAcre: 'seedRateKgPerAcre',
  germinationPercent: 'germinationPercent', nutrientRateKgPerAcre: 'nutrientRateKgPerAcre',
  nutrientPercentage: 'nutrientPercentage', labelRate: 'labelRate', labelRateUnit: 'labelRateUnit',
  labelSource: 'labelSource', labelConfirmed: 'labelConfirmed', waterLitres: 'waterLitres',
  depthMm: 'depthMm', efficiencyPercent: 'efficiencyPercent',
  flowRateLitresPerMinute: 'flowRateLitresPerMinute', rowSpacingCm: 'rowSpacingCm',
  plantSpacingCm: 'plantSpacingCm', yieldKgPerAcre: 'yieldKgPerAcre',
  pricePerKg: 'pricePerKg', amount: 'amount', expenseCategory: 'expenseCategory',
  revenue: 'revenue', totalExpenses: 'totalExpenses', principal: 'principal',
  annualInterestPercent: 'annualInterestPercent', termMonths: 'termMonths', currency: 'currency',
};

function messageFrom(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function initialValues(type) {
  return {
    areaValue: '',
    areaUnit: 'acres',
    germinationPercent: '100',
    labelRateUnit: 'mlPerLitre',
    efficiencyPercent: '100',
    expenseCategory: '',
    currency: 'INR',
    ...(type === 'pesticide' ? { labelConfirmed: false } : {}),
  };
}

function humanize(value) {
  return value.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function displayValue(value, currency) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
  if (Array.isArray(value)) return value.map((item) => `${item.category}: ${Number(item.amount).toLocaleString()} ${currency}`).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function RecommendationSource({ source, label }) {
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return <a href={source} target="_blank" rel="noreferrer">{label}: {source}</a>;
  return <p>{label}: {source}</p>;
}

function Field({ name, value, onChange, copy, crops, required = true, disabled = false }) {
  const label = copy[fieldLabels[name]] || humanize(name);
  const isOptional = ['pricePerKg', 'flowRateLitresPerMinute', 'currency'].includes(name);
  if (name === 'areaUnit') {
    return (
      <label className="farming-tools__field">
        <span>{label}</span>
        <select value={value || 'acres'} onChange={(event) => onChange(name, event.target.value)}>
          {areaUnits.map((unit) => <option key={unit} value={unit}>{copy.units[unit]}</option>)}
        </select>
      </label>
    );
  }
  if (name === 'labelRateUnit') {
    return (
      <label className="farming-tools__field">
        <span>{label}</span>
        <select value={value || 'mlPerLitre'} onChange={(event) => onChange(name, event.target.value)}>
          {Object.entries(copy.labelUnits).map(([unit, unitLabel]) => <option key={unit} value={unit}>{unitLabel}</option>)}
        </select>
      </label>
    );
  }
  if (name === 'expenseCategory') {
    return (
      <label className="farming-tools__field">
        <span>{label}</span>
        <input value={value || ''} maxLength={80} onChange={(event) => onChange(name, event.target.value)} required={required} />
      </label>
    );
  }
  if (name === 'labelConfirmed') {
    return (
      <label className="farming-tools__check">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(name, event.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }
  if (name === 'currency') {
    return (
      <label className="farming-tools__field">
        <span>{label}</span>
        <input value={value || 'INR'} maxLength={8} onChange={(event) => onChange(name, event.target.value)} />
      </label>
    );
  }
  return (
    <label className="farming-tools__field">
      <span>{label}{isOptional ? ' (optional)' : ''}</span>
      <input
        type={numericFields.has(name) ? 'number' : 'text'}
        min={numericFields.has(name) ? (name === 'termMonths' ? '1' : '0') : undefined}
        step={numericFields.has(name) ? 'any' : undefined}
        value={value ?? ''}
        onChange={(event) => onChange(name, event.target.value)}
        required={required && !isOptional}
        disabled={disabled}
      />
    </label>
  );
}

function CalculatorResult({ record, copy }) {
  if (!record?.result) return null;
  const result = record.result;
  const currency = result.currency || 'INR';
  return (
    <section className="farming-tools__result" aria-live="polite">
      <div className="farming-tools__result-head">
        <div><span className="farming-tools__eyebrow">{copy.result}</span><h2>{record.title || copy.calculatorNames[record.calculatorType]}</h2></div>
        <div className="farming-tools__actions">
          <button type="button" onClick={() => window.print()} aria-label={copy.print}><Printer size={17} />{copy.print}</button>
          <button type="button" onClick={() => {
            if ('speechSynthesis' in window) {
              const speech = new SpeechSynthesisUtterance(Object.entries(result).filter(([key]) => key !== 'note').map(([key, value]) => `${humanize(key)}: ${displayValue(value, currency)}`).join('. '));
              window.speechSynthesis.speak(speech);
            }
          }} aria-label={copy.speak}><Volume2 size={17} />{copy.speak}</button>
        </div>
      </div>
      <dl className="farming-tools__result-grid">
        {Object.entries(result).filter(([key]) => !['note'].includes(key)).map(([key, value]) => (
          <div key={key}><dt>{humanize(key)}</dt><dd>{displayValue(value, currency)}{key.toLowerCase().includes('revenue') || key.toLowerCase().includes('expenses') || key.toLowerCase().includes('payment') || key === 'principal' ? ` ${currency}` : ''}</dd></div>
        ))}
      </dl>
      {result.note && <p className="farming-tools__note">{result.note}</p>}
    </section>
  );
}

export default function SmartCalculatorsPage() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const copy = content[lang] || content.en;
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeType, setActiveType] = useState(() => calculatorTypes.some(({ id }) => id === searchParams.get('type')) ? searchParams.get('type') : 'seed');
  const [values, setValues] = useState(() => initialValues('seed'));
  const [cropId, setCropId] = useState(searchParams.get('crop') || '');
  const [plotId, setPlotId] = useState('');
  const [expenseRows, setExpenseRows] = useState([{ category: '', amount: '' }]);
  const [historySearch, setHistorySearch] = useState('');
  const [currentRecord, setCurrentRecord] = useState(null);
  const [converterAmount, setConverterAmount] = useState('1');
  const [converterUnit, setConverterUnit] = useState('acres');
  const [conversion, setConversion] = useState(null);
  const [error, setError] = useState('');
  const region = user?.profile?.state || user?.state || '';

  const cropsQuery = useQuery({
    queryKey: ['crop-knowledge-list', lang],
    queryFn: async () => unwrapPayload(await api.get('/crop-knowledge/crops', { params: { language: lang, limit: 100 } })),
    retry: false,
  });
  const plotsQuery = useQuery({
    queryKey: ['land-measurements'],
    queryFn: async () => unwrapPayload(await api.get('/land-measurements')),
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: ['calculator-history', historySearch],
    queryFn: async () => unwrapPayload(await api.get('/calculators/history', { params: { q: historySearch || undefined, limit: 30 } })),
    retry: false,
  });
  const recommendationsQuery = useQuery({
    queryKey: ['calculator-recommendations', cropId, region],
    queryFn: async () => unwrapPayload(await api.get('/calculators/recommendations', { params: { cropId, state: region || undefined } })),
    enabled: Boolean(cropId),
    retry: false,
  });

  const plots = plotsQuery.data?.items || [];
  const crops = cropsQuery.data || [];
  const recommendations = recommendationsQuery.data || [];
  const typeCopy = copy.calculatorNames[activeType];
  const activeFields = fieldsByType[activeType];

  const updateValue = (name, value) => setValues((previous) => ({ ...previous, [name]: value }));
  const mutation = useMutation({
    mutationFn: async (payload) => unwrapPayload(await api.post(`/calculators/${activeType}/calculate`, payload)),
    onSuccess: (record) => {
      setCurrentRecord(record);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['calculator-history'] });
    },
    onError: (requestError) => setError(messageFrom(requestError, copy.requestError)),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/calculators/history/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calculator-history'] }),
    onError: (requestError) => setError(messageFrom(requestError, copy.requestError)),
  });
  const convertMutation = useMutation({
    mutationFn: async () => unwrapPayload(await api.post('/calculators/convert', {
      amount: converterAmount,
      fromUnit: converterUnit,
    })),
    onSuccess: setConversion,
    onError: (requestError) => setError(messageFrom(requestError, copy.conversionError)),
  });

  const selectCalculator = (id) => {
    setActiveType(id);
    setValues(initialValues(id));
    setExpenseRows([{ category: '', amount: '' }]);
    setCurrentRecord(null);
    setError('');
  };

  const selectPlot = (id) => {
    setPlotId(id);
    const plot = plots.find((item) => item.id === id);
    if (plot) setValues((previous) => ({ ...previous, areaValue: String(plot.areaAcres), areaUnit: 'acres' }));
  };

  const isAreaCalculator = ['seed', 'fertilizer', 'pesticide', 'irrigation', 'spacing', 'yield'].includes(activeType);
  const filteredFields = useMemo(() => activeFields.filter((field) => {
    if (activeType === 'pesticide') {
      if (field === 'waterLitres' && !['mlPerLitre', 'gPerLitre'].includes(values.labelRateUnit)) return false;
      if ((field === 'areaValue' || field === 'areaUnit') && !['mlPerAcre', 'gPerAcre'].includes(values.labelRateUnit)) return false;
    }
    return true;
  }), [activeFields, activeType, values.labelRateUnit]);

  const submit = (event) => {
    event.preventDefault();
    setError('');
    const payload = { ...values, cropId: cropId || undefined };
    if (activeType === 'expenses') {
      payload.items = expenseRows.map((item) => ({ category: item.category, amount: item.amount }));
      delete payload.amount;
      delete payload.expenseCategory;
    }
    if (activeType === 'pesticide' && !values.labelConfirmed) {
      setError(lang === 'te' ? 'ముందుగా ఉత్పత్తి లేబుల్‌ను ధృవీకరించండి.' : lang === 'hi' ? 'पहले उत्पाद लेबल की पुष्टि करें।' : 'Confirm the product label before calculating.');
      return;
    }
    payload.title = `${typeCopy}${cropId ? ` · ${crops.find((crop) => crop.id === cropId)?.displayName || cropId}` : ''}`;
    if (plotId) payload.plotId = plotId;
    mutation.mutate(payload);
  };

  const errorCopy = cropsQuery.isError ? copy.cropsError : plotsQuery.isError ? copy.savedPlotsError : historyQuery.isError ? copy.historyError : '';

  return (
    <main className="farming-tools">
      <header className="farming-tools__header">
        <Link to="/farmer/dashboard" aria-label={copy.dashboard}><Logo size="small" /></Link>
        <div className="farming-tools__header-actions"><ModuleLanguageSelector label={copy.language} /><Link className="farming-tools__back" to="/farmer/dashboard"><ArrowLeft size={17} />{copy.dashboard}</Link></div>
      </header>
      <div className="farming-tools__container">
        <div className="farming-tools__intro">
          <span className="farming-tools__intro-icon"><Calculator size={27} /></span>
          <div><p className="farming-tools__eyebrow">{copy.calculators}</p><h1>{copy.calculators}</h1><p>{copy.calculatorSubtitle}</p></div>
        </div>

        <div className="farming-tools__layout">
          <aside className="farming-tools__selector" aria-label={copy.selectCalculator}>
            <h2>{copy.selectCalculator}</h2>
            {calculatorTypes.map(({ id, icon: Icon }) => (
              <button key={id} type="button" className={activeType === id ? 'is-active' : ''} onClick={() => selectCalculator(id)}>
                <Icon size={18} /><span>{copy.calculatorNames[id]}</span>
              </button>
            ))}
            <Link to="/farmer/crop-knowledge"><BookOpen size={18} />{copy.knowledge}</Link>
          </aside>

          <section className="farming-tools__workspace">
            <div className="farming-tools__card">
              <h2>{typeCopy}</h2>
              <p>{copy.calculatorDescriptions[activeType]}</p>
              {errorCopy && <p className="farming-tools__warning" role="status">{errorCopy}</p>}
              <form className="farming-tools__form" onSubmit={submit}>
                <label className="farming-tools__field">
                  <span>{copy.crop}</span>
                  <select value={cropId} onChange={(event) => setCropId(event.target.value)}>
                    <option value="">{copy.noCrop}</option>
                    {crops.map((crop) => <option value={crop.id} key={crop.id}>{crop.displayName || crop.name}</option>)}
                  </select>
                </label>

                {isAreaCalculator && (
                  <label className="farming-tools__field">
                    <span>{copy.savedPlot}</span>
                    <select value={plotId} onChange={(event) => selectPlot(event.target.value)}>
                      <option value="">{copy.noPlot}</option>
                      {plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.plotName} · {Number(plot.areaAcres).toLocaleString(undefined, { maximumFractionDigits: 3 })} {copy.units.acres}</option>)}
                    </select>
                  </label>
                )}

                {filteredFields.map((field) => {
                  if (field === 'areaUnit' && !isAreaCalculator) return null;
                  if (field === 'areaValue' && !isAreaCalculator) return null;
                  if (activeType === 'pesticide' && ['areaValue', 'areaUnit'].includes(field) && ['mlPerAcre', 'gPerAcre'].includes(values.labelRateUnit)) {
                    return <Field key={field} name={field} value={values[field]} onChange={updateValue} copy={copy} disabled={!values[field] && Boolean(plotId)} />;
                  }
                  if (activeType === 'pesticide' && ['areaValue', 'areaUnit'].includes(field) && !['mlPerAcre', 'gPerAcre'].includes(values.labelRateUnit)) return null;
                  return <Field key={field} name={field} value={values[field]} onChange={updateValue} copy={copy} />;
                })}

                {activeType === 'expenses' && (
                  <div className="farming-tools__expense-list">
                    {expenseRows.map((row, index) => (
                      <div className="farming-tools__expense-row" key={`expense-${index}`}>
                        <Field name="expenseCategory" value={row.category} onChange={(_, value) => setExpenseRows((previous) => previous.map((item, rowIndex) => rowIndex === index ? { ...item, category: value } : item))} copy={copy} />
                        <Field name="amount" value={row.amount} onChange={(_, value) => setExpenseRows((previous) => previous.map((item, rowIndex) => rowIndex === index ? { ...item, amount: value } : item))} copy={copy} />
                        {expenseRows.length > 1 && <button className="farming-tools__remove" type="button" onClick={() => setExpenseRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={16} />{copy.removeExpense}</button>}
                      </div>
                    ))}
                    <button className="farming-tools__secondary" type="button" onClick={() => setExpenseRows((previous) => [...previous, { category: '', amount: '' }])}><Plus size={16} />{copy.addExpense}</button>
                  </div>
                )}
                <button className="farming-tools__primary" type="submit" disabled={mutation.isPending}>
                  <Calculator size={18} />{mutation.isPending ? copy.calculating : copy.calculate}
                </button>
                {error && <p className="farming-tools__error" role="alert">{error}</p>}
              </form>
            </div>

            {currentRecord && <CalculatorResult record={currentRecord} copy={copy} />}

            {cropId && (
              <section className="farming-tools__card farming-tools__recommendations">
                <div className="farming-tools__section-heading"><h2>{copy.verifiedRecommendations}</h2><Link to={`/farmer/crop-knowledge/${cropId}`}>{copy.knowledge}</Link></div>
                {recommendationsQuery.isPending ? <p>{copy.loading}</p> : recommendations.length === 0 ? <p>{copy.noRecommendations}</p> : recommendations.map((item) => (
                  <article key={item.id}>
                    <strong>{humanize(item.recommendationType)}</strong>
                    <pre>{JSON.stringify(item.details, null, 2)}</pre>
                    <RecommendationSource source={item.source} label={copy.source} />
                  </article>
                ))}
              </section>
            )}

            <section className="farming-tools__card farming-tools__converter">
              <h2>{copy.areaConverter}</h2>
              <form className="farming-tools__form" onSubmit={(event) => { event.preventDefault(); setError(''); convertMutation.mutate(); }}>
                <label className="farming-tools__field"><span>{copy.area}</span><input type="number" min="0.000001" step="any" required value={converterAmount} onChange={(event) => setConverterAmount(event.target.value)} /></label>
                <label className="farming-tools__field"><span>{copy.areaUnit}</span><select value={converterUnit} onChange={(event) => setConverterUnit(event.target.value)}>{areaUnits.map((unit) => <option key={unit} value={unit}>{copy.units[unit]}</option>)}</select></label>
                <button type="submit" className="farming-tools__secondary" disabled={convertMutation.isPending}>{copy.convert}</button>
              </form>
              {conversion && <dl className="farming-tools__result-grid">{Object.entries(conversion.conversions || {}).map(([unit, amount]) => <div key={unit}><dt>{copy.units[unit]}</dt><dd>{Number(amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}</dd></div>)}</dl>}
            </section>

            <aside className="farming-tools__disclaimer"><Leaf size={19} /><p>{copy.disclaimer}</p></aside>
          </section>

          <aside className="farming-tools__history">
            <div className="farming-tools__section-heading"><h2>{copy.history}</h2><Download size={18} /></div>
            <label className="farming-tools__field"><span>{copy.searchHistory}</span><input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} /></label>
            {historyQuery.isPending ? <p>{copy.loading}</p> : historyQuery.isError ? <p role="alert">{copy.historyError} <button type="button" onClick={() => historyQuery.refetch()}>{copy.retry}</button></p> : (historyQuery.data || []).length === 0 ? <p>{copy.noHistory}</p> : (
              <ul>
                {historyQuery.data.map((record) => (
                  <li key={record.id}>
                    <button type="button" className="farming-tools__history-open" onClick={() => setCurrentRecord(record)}>
                      <strong>{record.title}</strong><span>{new Date(record.createdAt).toLocaleDateString()}</span>
                    </button>
                    <button type="button" className="farming-tools__icon-button" aria-label={copy.delete} onClick={() => deleteMutation.mutate(record.id)} disabled={deleteMutation.isPending}><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
