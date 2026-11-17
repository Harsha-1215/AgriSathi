import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity, Bell, BookOpen, Calculator, CloudSun, Coins, House, Landmark, LogOut, Menu, Mic, PlayCircle, Ruler,
  PawPrint, ScanSearch, ShoppingBasket, Sprout, Truck, UserRound, Video, Volume2, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import authContent from '../../data/authContent';
import dashboardContent from '../../data/dashboardContent';
import Logo from '../../components/common/Logo';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';

const resourceDefinitions = [
  { key: 'dashboard', endpoint: '/farmers/dashboard', icon: House },
  { key: 'profile', endpoint: '/farmers/profile', icon: UserRound },
  { key: 'farms', endpoint: '/farms', icon: Sprout },
  { key: 'crops', endpoint: '/farms/crops', icon: Sprout },
  { key: 'weather', endpoint: '/weather/current', icon: CloudSun },
  { key: 'land', endpoint: '/land-measurements', icon: Ruler },
  { key: 'market', endpoint: '/market-prices/highlights', icon: ShoppingBasket },
  { key: 'alerts', endpoint: '/notifications', icon: Bell },
  { key: 'activities', endpoint: '/crop-activities/upcoming', icon: Activity },
  { key: 'expenses', endpoint: '/farm-expenses/summary', icon: Coins },
  { key: 'services', endpoint: '/services/nearby', icon: Truck },
  { key: 'videos', endpoint: '/videos/recommended', icon: PlayCircle },
];

const navItems = [
  ['overview', 'overview', House],
  ['farms', 'farms', Sprout],
  ['crops', 'crops', Sprout],
  ['weather', 'weather', CloudSun],
  ['market', 'market', ShoppingBasket],
  ['alerts', 'alerts', Bell],
  ['activities', 'activities', Activity],
  ['expenses', 'expenses', Coins],
  ['services', 'services', Truck],
  ['videos', 'videos', PlayCircle],
];
const advancedResourceKeys = new Set(['expenses', 'services', 'videos']);

function readStoredMode() {
  try {
    return localStorage.getItem('agrisathi_dashboard_mode') === 'advanced';
  } catch {
    return false;
  }
}

function toRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function pick(value, keys) {
  const record = toRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  }
  return undefined;
}

function getItems(value, keys) {
  if (Array.isArray(value)) return value;
  const record = toRecord(value);
  if (!record) return [];
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key];
  }
  const nested = toRecord(record.data);
  if (nested) {
    for (const key of keys) {
      if (Array.isArray(nested[key])) return nested[key];
    }
  }
  return [];
}

function ResourcePanel({ id, title, icon: Icon, query, empty, children, className = '' }) {
  return (
    <section className={`dashboard-panel ${className}`} id={id} aria-labelledby={`${id}-title`}>
      <div className="dashboard-panel__heading">
        <span className="dashboard-panel__icon"><Icon size={20} aria-hidden="true" /></span>
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      {query.isPending ? (
        <p className="dashboard-state" role="status">{children.loading}</p>
      ) : query.isError ? (
        <div className="dashboard-state dashboard-state--error" role="alert">
          <p>{children.error}</p>
          <button type="button" onClick={() => query.refetch()}>{children.retry}</button>
        </div>
      ) : children.content(query.data) || <p className="dashboard-state">{empty}</p>}
    </section>
  );
}

function InfoList({ items, titleKeys, subtitleKeys, amountKeys, dateKeys, copy, fallback }) {
  const rows = items.map((item, index) => ({
    key: String(pick(item, ['id', '_id', 'uuid']) || `${pick(item, titleKeys) || pick(item, subtitleKeys) || 'item'}-${index}`),
    title: pick(item, titleKeys),
    subtitle: pick(item, subtitleKeys),
    amount: pick(item, amountKeys),
    date: pick(item, dateKeys),
  })).filter((item) => item.title || item.subtitle || item.amount !== undefined || item.date !== undefined);
  if (!rows.length) return <p className="dashboard-state">{fallback}</p>;
  return (
    <ul className="dashboard-data-list">
      {rows.map(({ key, title, subtitle, amount, date }) => (
        <li key={key}>
          <div><strong>{title || subtitle || copy.details}</strong>{title && subtitle && <small>{subtitle}</small>}</div>
          {amount !== undefined && <span>{String(amount)}</span>}
          {date !== undefined && <time>{String(date)}</time>}
        </li>
      ))}
    </ul>
  );
}

function KeyValues({ values }) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) return null;
  return (
    <dl className="dashboard-key-values">
      {entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}
    </dl>
  );
}

function getUserName(user, fallback) {
  return pick(user, ['displayName', 'fullName', 'name', 'businessName', 'mobile', 'email']) || fallback;
}

export default function FarmerDashboard() {
  const { lang } = useLanguage();
  const authCopy = authContent[lang] || authContent.en;
  const copy = dashboardContent[lang] || dashboardContent.en;
  const { user, logout, invalidateSession } = useAuth();
  const [advanced, setAdvanced] = useState(readStoredMode);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const userKey = String(pick(user, ['id', '_id', 'userId', 'email']) || 'session');
  const results = useQueries({
    queries: resourceDefinitions.map(({ key, endpoint }) => ({
      queryKey: ['farmer-dashboard', userKey, key],
      queryFn: async () => unwrapPayload(await api.get(endpoint)),
      enabled: !advancedResourceKeys.has(key) || advanced,
      retry: false,
      staleTime: 60_000,
    })),
  });
  const resources = useMemo(() => Object.fromEntries(resourceDefinitions.map(({ key }, index) => [key, results[index]])), [results]);
  const hasUnauthorizedResponse = results.some((result) => result.error?.response?.status === 401);
  const simpleSections = new Set(['overview', 'farms', 'crops', 'weather', 'market', 'alerts', 'activities']);

  useEffect(() => {
    if (hasUnauthorizedResponse) invalidateSession();
  }, [hasUnauthorizedResponse, invalidateSession]);

  const setMode = (value) => {
    setAdvanced(value);
    try {
      localStorage.setItem('agrisathi_dashboard_mode', value ? 'advanced' : 'simple');
    } catch {
      setLogoutError(copy.modeSaveError);
    }
  };

  const onLogout = async () => {
    setLogoutError('');
    try {
      await logout();
    } catch {
      setLogoutError(authCopy.errors.network);
    }
  };

  const profile = resources.profile.data;
  const dashboardData = resources.dashboard.data;
  const displayedName = getUserName(user, copy.account);
  const overviewValues = {
    [copy.farms]: pick(dashboardData, ['farmCount', 'totalFarms']),
    [copy.crop]: pick(dashboardData, ['cropCount', 'activeCrops']),
    [copy.activities]: pick(dashboardData, ['upcomingActivities', 'upcomingActivityCount']),
    [copy.amount]: pick(dashboardData, ['monthlyExpenses', 'expenseTotal']),
    [lang === 'te' ? 'కొలిచిన భూమి (ఎకరాలు)' : lang === 'hi' ? 'मापी गई भूमि (एकड़)' : 'Measured land (acres)']: resources.land.data?.summary?.areaAcres,
    [lang === 'te' ? 'భద్రపరచిన పొలాలు' : lang === 'hi' ? 'सहेजे खेत' : 'Saved plots']: resources.land.data?.summary?.plotCount,
  };
  const hasOverviewValues = Object.values(overviewValues).some((value) => value !== undefined);
  const farmList = getItems(resources.farms.data, ['farms', 'items', 'results']);
  const cropList = getItems(resources.crops.data, ['crops', 'items', 'results']);
  const alertList = getItems(resources.alerts.data, ['notifications', 'alerts', 'items', 'results']);
  const activityList = getItems(resources.activities.data, ['activities', 'items', 'results']);
  const marketList = getItems(resources.market.data, ['prices', 'items', 'markets', 'results']);
  const serviceList = getItems(resources.services.data, ['services', 'providers', 'items', 'results']);
  const videoList = getItems(resources.videos.data, ['videos', 'items', 'results']);

  return (
    <div className={`farmer-dashboard${advanced ? ' farmer-dashboard--advanced' : ''}`}>
      <aside className={`dashboard-sidebar${mobileNavOpen ? ' is-open' : ''}`}>
        <div className="dashboard-sidebar__brand"><Link to="/"><Logo size="small" /></Link><button className="dashboard-icon-button dashboard-sidebar__close" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X /></button></div>
        <div className="dashboard-sidebar__label">{copy.dashboard}</div>
        <nav className="dashboard-nav" id="dashboard-navigation" aria-label={copy.dashboard}>
          {navItems.filter(([key]) => advanced || simpleSections.has(key)).map(([key, id, Icon]) => (
            <a href={`#dashboard-${id}`} key={key} onClick={() => setMobileNavOpen(false)}><Icon size={18} aria-hidden="true" /><span>{copy[key]}</span></a>
          ))}
        </nav>
        <div className="dashboard-sidebar__bottom">
          <Link to="/"><House size={18} aria-hidden="true" /><span>{copy.account}</span></Link>
          <button type="button" onClick={onLogout}><LogOut size={18} aria-hidden="true" /><span>{copy.logout}</span></button>
        </div>
      </aside>
      {mobileNavOpen && <button className="dashboard-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="dashboard-icon-button dashboard-menu-toggle" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open menu" aria-expanded={mobileNavOpen} aria-controls="dashboard-navigation"><Menu /></button>
          <div className="dashboard-topbar__title"><span className="dashboard-topbar__subtitle">{copy.dashboard}</span><strong>{copy.welcome}, {displayedName}</strong></div>
          <div className="dashboard-topbar__actions">
            <button type="button" className={`dashboard-mode-toggle${advanced ? ' is-active' : ''}`} onClick={() => setMode(!advanced)} aria-pressed={advanced}>
              {advanced ? copy.simpleMode : copy.advancedMode}
            </button>
            <a className="dashboard-icon-button dashboard-notification-button" href="#dashboard-alerts" aria-label={copy.alerts}>
              <Bell size={19} aria-hidden="true" />{alertList.length > 0 && <span>{alertList.length}</span>}
            </a>
            <button className="dashboard-user-chip" type="button" onClick={onLogout} aria-label={`${copy.logout}: ${displayedName}`}><span><UserRound size={17} aria-hidden="true" /></span><strong>{displayedName}</strong><LogOut size={16} aria-hidden="true" /></button>
          </div>
        </header>
        <main className="dashboard-content" id="dashboard-overview">
          <div className="dashboard-welcome">
            <div><p className="auth-eyebrow">{copy.dashboard}</p><h1>{copy.welcome}, {displayedName}</h1><p>{copy.overviewDescription}</p></div>
            <button className="dashboard-refresh" type="button" onClick={() => results.forEach((result, index) => {
              const { key } = resourceDefinitions[index];
              if (!advancedResourceKeys.has(key) || advanced) result.refetch();
            })}>{copy.refresh}</button>
          </div>
          <div className="dashboard-module-shortcuts" aria-label={copy.dashboard}>
            <Link to="/farmer/voice-assistant"><Mic size={19} aria-hidden="true" /><span><strong>{copy.voiceTitle}</strong><small>{copy.voiceOpen}</small></span></Link>
            <Link to="/farmer/crop-doctor"><ScanSearch size={19} aria-hidden="true" /><span><strong>{copy.cropDoctor}</strong><small>{copy.voiceOpen}</small></span></Link>
            <Link to="/farmer/weather"><CloudSun size={19} aria-hidden="true" /><span><strong>{copy.weatherModule}</strong><small>{copy.voiceOpen}</small></span></Link>
            <Link to="/farmer/land-measurement"><Ruler size={19} aria-hidden="true" /><span><strong>{lang === 'te' ? 'భూమి కొలత' : lang === 'hi' ? 'भूमि माप' : 'Land measurement'}</strong><small>{resources.land.data?.summary ? `${Number(resources.land.data.summary.areaAcres).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${lang === 'te' ? 'ఎకరాలు' : lang === 'hi' ? 'एकड़' : 'acres'} · ${resources.land.data.summary.plotCount}` : copy.voiceOpen}</small></span></Link>
            <Link to="/farmer/calculators"><Calculator size={19} aria-hidden="true" /><span><strong>{lang === 'te' ? 'వ్యవసాయ కాలిక్యులేటర్లు' : lang === 'hi' ? 'खेती कैलकुलेटर' : 'Farming calculators'}</strong><small>{copy.voiceOpen}</small></span></Link>
            <Link to="/farmer/crop-knowledge"><BookOpen size={19} aria-hidden="true" /><span><strong>{lang === 'te' ? 'పంటల విజ్ఞాన కేంద్రం' : lang === 'hi' ? 'फसल ज्ञान केंद्र' : 'Crop knowledge hub'}</strong><small>{copy.voiceOpen}</small></span></Link>
            <Link to="/farmer/agri-shorts"><Video size={19} aria-hidden="true" /><span><strong>{lang === 'te' ? 'అగ్రి షార్ట్స్' : lang === 'hi' ? 'एग्री शॉर्ट्स' : 'Agri Shorts'}</strong><small>{copy.voiceOpen}</small></span></Link>
            <Link to="/farmer/government-schemes"><Landmark size={19} aria-hidden="true" /><span><strong>{lang === 'te' ? 'ప్రభుత్వ పథకాలు' : lang === 'hi' ? 'सरकारी योजनाएँ' : 'Government schemes'}</strong><small>{copy.voiceOpen}</small></span></Link>
            <Link to="/farmer/marketplace"><ShoppingBasket size={19} aria-hidden="true" /><span><strong>{lang === 'te' ? 'వ్యవసాయ మార్కెట్' : lang === 'hi' ? 'कृषि बाज़ार' : 'Agricultural marketplace'}</strong><small>{copy.voiceOpen}</small></span></Link>
            <Link to="/farmer/livestock"><PawPrint size={19} aria-hidden="true" /><span><strong>{lang === 'te' ? 'పశువుల మార్కెట్' : lang === 'hi' ? 'पशुधन बाज़ार' : 'Livestock marketplace'}</strong><small>{copy.voiceOpen}</small></span></Link>
          </div>
          {logoutError && <p className="auth-alert auth-alert--error" role="alert">{logoutError}</p>}
          {profile && <div className="dashboard-profile-summary"><UserRound size={18} aria-hidden="true" /><strong>{getUserName(profile, displayedName)}</strong><span>{String(pick(profile, ['district', 'location', 'village']) || '')}</span></div>}
          {resources.profile.isError && <p className="auth-alert auth-alert--error" role="alert">{copy.loadError} <button type="button" onClick={() => resources.profile.refetch()}>{copy.retry}</button></p>}
          {resources.dashboard.isError && <p className="auth-alert auth-alert--error" role="alert">{copy.loadError} <button type="button" onClick={() => resources.dashboard.refetch()}>{copy.retry}</button></p>}
          {dashboardData && hasOverviewValues && (
            <div className="dashboard-highlights">
              <KeyValues values={overviewValues} />
            </div>
          )}
          <div className="dashboard-grid">
            <ResourcePanel id="dashboard-farms" title={copy.farms} icon={Sprout} query={resources.farms} empty={copy.noFarms} children={{
              loading: copy.loading, error: copy.loadError, retry: copy.retry,
              content: (data) => {
                const items = farmList.length ? farmList : cropList;
                if (!items.length) return null;
                return <InfoList items={items} titleKeys={['name', 'farmName', 'cropName', 'crop']} subtitleKeys={['crop', 'area', 'location', 'status']} amountKeys={[]} dateKeys={[]} copy={copy} fallback={copy.noFarms} />;
              },
            }} />
            <ResourcePanel id="dashboard-crops" title={copy.crops} icon={Sprout} query={resources.crops} empty={copy.noCrops} children={{
              loading: copy.loading, error: copy.loadError, retry: copy.retry,
              content: () => <InfoList items={cropList} titleKeys={['name', 'cropName', 'crop', 'variety']} subtitleKeys={['farmName', 'season', 'status']} amountKeys={[]} dateKeys={[]} copy={copy} fallback={copy.noCrops} />,
            }} />
            <ResourcePanel id="dashboard-weather" title={copy.weather} icon={CloudSun} query={resources.weather} empty={copy.noWeather} className="dashboard-panel--weather" children={{
              loading: copy.loading, error: copy.loadError, retry: copy.retry,
              content: (data) => {
                const values = {
                  [copy.temperature]: pick(data, ['temperature', 'temp', 'tempC', 'temperatureC']),
                  [copy.condition]: pick(data, ['condition', 'description', 'weather']),
                  [copy.humidity]: pick(data, ['humidity', 'humidityPercent']),
                  [copy.rainfall]: pick(data, ['rainfall', 'precipitation']),
                  [copy.wind]: pick(data, ['windSpeed', 'wind', 'windKph']),
                };
                return Object.values(values).some((value) => value !== undefined) ? <KeyValues values={values} /> : null;
              },
            }} />
            <ResourcePanel id="dashboard-market" title={copy.market} icon={ShoppingBasket} query={resources.market} empty={copy.noMarket} children={{
              loading: copy.loading, error: copy.loadError, retry: copy.retry,
              content: (data) => {
                const items = marketList.length ? marketList : (pick(data, ['price', 'modalPrice', 'commodity', 'crop']) !== undefined ? [data] : []);
                return items.length ? <InfoList items={items} titleKeys={['commodity', 'crop', 'name', 'item']} subtitleKeys={['marketName', 'market', 'unit']} amountKeys={['price', 'modalPrice', 'value', 'minPrice']} dateKeys={['updatedAt', 'date']} copy={copy} fallback={copy.noMarket} /> : null;
              },
            }} />
            <ResourcePanel id="dashboard-alerts" title={copy.alerts} icon={Bell} query={resources.alerts} empty={copy.noAlerts} children={{
              loading: copy.loading, error: copy.loadError, retry: copy.retry,
              content: (data) => <InfoList items={alertList} titleKeys={['title', 'subject', 'type']} subtitleKeys={['message', 'body', 'description']} amountKeys={[]} dateKeys={['createdAt', 'date']} copy={copy} fallback={copy.noAlerts} />,
            }} />
            <ResourcePanel id="dashboard-activities" title={copy.activities} icon={Activity} query={resources.activities} empty={copy.noActivities} children={{
              loading: copy.loading, error: copy.loadError, retry: copy.retry,
              content: (data) => <InfoList items={activityList} titleKeys={['title', 'activity', 'name', 'crop']} subtitleKeys={['crop', 'description', 'status']} amountKeys={[]} dateKeys={['dueDate', 'scheduledAt', 'date']} copy={copy} fallback={copy.noActivities} />,
            }} />
            {advanced && <>
              <ResourcePanel id="dashboard-expenses" title={copy.expenses} icon={Coins} query={resources.expenses} empty={copy.noExpenses} children={{
                loading: copy.loading, error: copy.loadError, retry: copy.retry,
                content: (data) => {
                  const values = { [copy.amount]: pick(data, ['total', 'totalAmount', 'monthlyTotal', 'amount']), [copy.date]: pick(data, ['period', 'month', 'updatedAt']) };
                  const expenses = getItems(data, ['expenses', 'items', 'categories']);
                  if (expenses.length) return <InfoList items={expenses} titleKeys={['category', 'name', 'description']} subtitleKeys={['date', 'description']} amountKeys={['amount', 'total', 'value']} dateKeys={['date']} copy={copy} fallback={copy.noExpenses} />;
                  return Object.values(values).some((value) => value !== undefined) ? <KeyValues values={values} /> : null;
                },
              }} />
              <ResourcePanel id="dashboard-services" title={copy.services} icon={Truck} query={resources.services} empty={copy.noServices} children={{
                loading: copy.loading, error: copy.loadError, retry: copy.retry,
                content: () => <InfoList items={serviceList} titleKeys={['name', 'providerName', 'serviceName']} subtitleKeys={['serviceType', 'category', 'location', 'distance']} amountKeys={['price', 'startingPrice']} dateKeys={[]} copy={copy} fallback={copy.noServices} />,
              }} />
              <ResourcePanel id="dashboard-videos" title={copy.videos} icon={PlayCircle} query={resources.videos} empty={copy.noVideos} children={{
                loading: copy.loading, error: copy.loadError, retry: copy.retry,
                content: () => videoList.length ? <ul className="dashboard-video-list">{videoList.map((video, index) => {
                  const title = pick(video, ['title', 'name']);
                  const url = pick(video, ['url', 'videoUrl', 'link']);
                  if (!title) return null;
                  return <li key={String(pick(video, ['id', '_id']) || `${title}-${index}`)}><PlayCircle size={18} aria-hidden="true" /><span>{String(title)}</span>{url && /^https?:\/\//i.test(String(url)) && <a href={String(url)} target="_blank" rel="noreferrer">{copy.openVideo}</a>}</li>;
                })}</ul> : null,
              }} />
            </>}
            <section className="dashboard-panel dashboard-voice-panel">
              <div className="dashboard-panel__heading"><span className="dashboard-panel__icon"><Volume2 size={20} aria-hidden="true" /></span><h2>{copy.voiceTitle}</h2></div>
              <p>{copy.voiceUnavailable}</p>
              <Link to="/farmer/voice-assistant" className="dashboard-voice-button"><Volume2 size={18} aria-hidden="true" />{copy.voiceOpen}</Link>
            </section>
          </div>
          <p className="dashboard-mode-note">{copy.modeSaved}</p>
          <div className="dashboard-mobile-nav" aria-label={copy.dashboard}>
            {navItems.slice(0, 5).map(([key, id, Icon]) => <a href={`#dashboard-${id}`} key={key} aria-label={copy[key]}><Icon size={19} aria-hidden="true" /><span>{copy[key]}</span></a>)}
            <button type="button" onClick={onLogout} aria-label={copy.logout}><LogOut size={19} aria-hidden="true" /><span>{copy.logout}</span></button>
          </div>
        </main>
      </div>
    </div>
  );
}
