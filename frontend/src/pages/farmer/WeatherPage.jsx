import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Check, Cloud, CloudDrizzle, CloudRain, CloudSun, Droplets, ExternalLink,
  LocateFixed, MapPin, Search, Sun, Thermometer, Wind,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../context/LanguageContext';
import moduleContent from '../../data/moduleContent';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';

function errorText(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function weatherIcon(code) {
  if ([0, 1].includes(code)) return Sun;
  if ([2, 3, 45, 48].includes(code)) return CloudSun;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([95, 96, 99].includes(code)) return CloudDrizzle;
  return Cloud;
}

function dayName(value, days) {
  const date = new Date(`${value}T12:00:00`);
  return `${days[date.getDay()]} ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

function WeatherContent({ value }) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    return <ul>{value.map((item, index) => <li key={index}><WeatherContent value={item} /></li>)}</ul>;
  }
  if (typeof value === 'object') {
    return <dl>{Object.entries(value).map(([key, item]) => (
      <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ')}</dt><dd><WeatherContent value={item} /></dd></div>
    ))}</dl>;
  }
  return <span>{String(value)}</span>;
}

export default function WeatherPage() {
  const { lang } = useLanguage();
  const copy = moduleContent[lang]?.weather || moduleContent.en.weather;
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const locationsQuery = useQuery({
    queryKey: ['weather-locations'],
    queryFn: async () => unwrapPayload(await api.get('/weather/locations')),
    retry: false,
  });
  const preferencesQuery = useQuery({
    queryKey: ['weather-preferences'],
    queryFn: async () => unwrapPayload(await api.get('/weather/preferences')),
    retry: false,
  });
  const searchResultsQuery = useQuery({
    queryKey: ['weather-location-search', searchQuery],
    queryFn: async () => unwrapPayload(await api.get('/weather/search', { params: { q: searchQuery } })),
    enabled: searchQuery.length >= 2,
    retry: false,
  });

  const locations = locationsQuery.data || [];
  useEffect(() => {
    if (!selectedLocation && locations.length) {
      setSelectedLocation(locations.find((item) => item.isDefault) || locations[0]);
    }
  }, [locations, selectedLocation]);

  const params = useMemo(() => selectedLocation ? {
    latitude: selectedLocation.latitude,
    longitude: selectedLocation.longitude,
  } : undefined, [selectedLocation]);
  const currentQuery = useQuery({
    queryKey: ['weather-current', params],
    queryFn: async () => unwrapPayload(await api.get('/weather/current', { params })),
    retry: false,
  });
  const forecastQuery = useQuery({
    queryKey: ['weather-forecast', params],
    queryFn: async () => unwrapPayload(await api.get('/weather/forecast', { params: { ...params, days: 7 } })),
    retry: false,
  });
  const advisoryQuery = useQuery({
    queryKey: ['weather-advisory', params],
    queryFn: async () => unwrapPayload(await api.get('/weather/advisory', { params })),
    retry: false,
  });
  const alertsQuery = useQuery({
    queryKey: ['weather-alerts', params],
    queryFn: async () => unwrapPayload(await api.get('/weather/alerts', { params })),
    retry: false,
  });

  const saveLocation = useMutation({
    mutationFn: async (location) => unwrapPayload(await api.post('/weather/locations', {
      locationName: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      district: location.admin1 || null,
      state: location.admin1 || null,
      isDefault: true,
    })),
    onSuccess: (location) => {
      setSelectedLocation(location);
      setSearchQuery('');
      setSearchText('');
      setNotice(copy.saved);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['weather-locations'] });
    },
    onError: (requestError) => setError(errorText(requestError, copy.error)),
  });

  const current = currentQuery.data;
  const forecast = forecastQuery.data?.days || [];
  const advisories = advisoryQuery.data?.advisories || [];
  const cropGuidance = advisoryQuery.data?.cropGuidance;
  const results = searchResultsQuery.data || [];
  const preferences = preferencesQuery.data;

  function runSearch(event) {
    event.preventDefault();
    setNotice('');
    setError('');
    setSearchQuery(searchText.trim());
  }

  function useCurrentLocation() {
    setError('');
    setNotice('');
    if (!navigator.geolocation) {
      setError(copy.locationDenied);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => saveLocation.mutate({
        name: 'My current location',
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
      () => setError(copy.locationDenied),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  async function setDefaultLocation(id) {
    const location = locations.find((item) => item.id === id);
    if (!location) return;
    try {
      const saved = unwrapPayload(await api.patch(`/weather/locations/${id}/default`));
      setSelectedLocation(saved);
      queryClient.invalidateQueries({ queryKey: ['weather-locations'] });
    } catch (requestError) {
      setError(errorText(requestError, copy.error));
    }
  }

  async function toggleNotifications(event) {
    if (!preferences) return;
    const enabled = event.target.checked;
    try {
      await api.put('/weather/preferences', {
        enabled,
        rainfallAlerts: preferences.rainfallAlerts,
        windAlerts: preferences.windAlerts,
        temperatureAlerts: preferences.temperatureAlerts,
        severeWeatherAlerts: preferences.severeWeatherAlerts,
      });
      queryClient.invalidateQueries({ queryKey: ['weather-preferences'] });
    } catch (requestError) {
      event.target.checked = !enabled;
      setError(errorText(requestError, copy.error));
    }
  }

  function retryWeather() {
    currentQuery.refetch();
    forecastQuery.refetch();
    advisoryQuery.refetch();
    alertsQuery.refetch();
  }

  return (
    <div className="agri-module-page weather-page">
      <header className="module-topbar">
        <Link to="/farmer/dashboard" className="module-brand" aria-label="AGRISATHI dashboard"><Logo size="small" /></Link>
        <div className="module-topbar__title"><CloudSun size={21} /><h1>{copy.title}</h1></div>
        <div className="module-topbar__actions"><ModuleLanguageSelector label={lang === 'te' ? 'భాష' : lang === 'hi' ? 'भाषा' : 'Language'} /><Link className="module-back-link" to="/farmer/dashboard">{copy.dashboard}</Link></div>
      </header>

      <main className="weather-layout">
        <section className="weather-hero">
          <div><p className="module-eyebrow">{copy.location}</p><h2>{selectedLocation?.locationName || current?.location || copy.title}</h2><p>{copy.subtitle}</p></div>
          <div className="weather-hero__icon"><CloudSun size={56} /></div>
        </section>

        <section className="module-card weather-location-card">
          <div className="module-card__heading"><h2><MapPin size={19} />{copy.location}</h2>
            {locations.length > 0 && <select className="weather-location-select" value={selectedLocation?.id || ''} onChange={(event) => setDefaultLocation(event.target.value)} aria-label={copy.location}>
              {locations.map((item) => <option key={item.id} value={item.id}>{item.locationName}{item.isDefault ? ` (${copy.defaultLocation})` : ''}</option>)}
            </select>}
          </div>
          <div className="weather-location-actions">
            <form className="weather-search" onSubmit={runSearch}>
              <Search size={18} />
              <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={copy.searchPlaceholder} maxLength={100} aria-label={copy.searchPlaceholder} />
              <button type="submit" disabled={searchText.trim().length < 2}>{copy.search}</button>
            </form>
            <button type="button" className="module-secondary-button" onClick={useCurrentLocation} disabled={saveLocation.isPending}><LocateFixed size={17} />{copy.useCurrent}</button>
          </div>
          {searchQuery && searchResultsQuery.isPending && <p className="module-muted" role="status">{copy.loading}</p>}
          {searchQuery && searchResultsQuery.isError && <p className="module-alert" role="alert">{errorText(searchResultsQuery.error, copy.error)}</p>}
          {searchQuery && !searchResultsQuery.isPending && !searchResultsQuery.isError && !results.length && <p className="module-muted">{copy.noResults}</p>}
          {results.length > 0 && <ul className="weather-search-results">
            {results.map((item) => <li key={`${item.name}-${item.latitude}-${item.longitude}`}>
              <div><strong>{item.name}</strong><span>{[item.admin1, item.country].filter(Boolean).join(', ')}</span></div>
              <button type="button" onClick={() => saveLocation.mutate(item)} disabled={saveLocation.isPending}><Check size={16} />{copy.saveLocation}</button>
            </li>)}
          </ul>}
          {notice && <p className="module-success" role="status"><Check size={16} />{notice}</p>}
          {error && <p className="module-alert" role="alert">{error}</p>}
        </section>

        {!selectedLocation && !current && !currentQuery.isPending && <p className="weather-location-prompt"><MapPin size={21} />{copy.chooseLocation}</p>}
        {currentQuery.isPending ? <div className="module-card module-loading" role="status">{copy.loading}</div>
          : currentQuery.isError ? <div className="module-alert weather-error" role="alert">{errorText(currentQuery.error, copy.error)} <button type="button" onClick={retryWeather}>{copy.retry}</button></div>
            : current && <section className="module-card weather-current-card">
              <div className="module-card__heading"><h2><Thermometer size={19} />{copy.current}</h2><span className="weather-source">{copy.source}: {current.source}</span></div>
              <div className="weather-current-main">
                {(() => { const Icon = weatherIcon(current.weatherCode); return <Icon size={56} />; })()}
                <strong>{current.temperatureC}°C</strong>
                <span>{current.condition}</span>
              </div>
              <div className="weather-metrics">
                <div><Thermometer size={18} /><span>{copy.feelsLike}</span><strong>{current.feelsLikeC}°C</strong></div>
                <div><Droplets size={18} /><span>{copy.humidity}</span><strong>{current.humidityPercent}%</strong></div>
                <div><CloudRain size={18} /><span>{copy.rain}</span><strong>{current.precipitationMm} mm</strong></div>
                <div><Wind size={18} /><span>{copy.wind}</span><strong>{current.windSpeedKph} km/h</strong></div>
              </div>
              <p className="weather-updated">{copy.updated}: {current.observedAt}</p>
            </section>}

        <div className="weather-secondary-grid">
          <section className="module-card weather-forecast-card">
            <div className="module-card__heading"><h2><Cloud size={19} />{copy.forecast}</h2><span className="weather-source">{forecastQuery.data?.source || ''}</span></div>
            {forecastQuery.isPending ? <p className="module-muted" role="status">{copy.loading}</p>
              : forecastQuery.isError ? <div className="module-alert" role="alert">{errorText(forecastQuery.error, copy.error)} <button type="button" onClick={() => forecastQuery.refetch()}>{copy.retry}</button></div>
                : <div className="weather-forecast-list">{forecast.map((day) => {
                  const Icon = weatherIcon(day.weatherCode);
                  return <article key={day.date}><span>{dayName(day.date, copy.days)}</span><Icon size={23} /><strong>{day.maximumC}° / {day.minimumC}°</strong><small>{day.condition}</small><small>{copy.rainChance}: {day.precipitationProbabilityPercent}%</small></article>;
                })}</div>}
          </section>

          <section className="module-card weather-advisory-card">
            <div className="module-card__heading"><h2><LeafIcon />{copy.advisory}</h2></div>
            {advisoryQuery.isPending ? <p className="module-muted" role="status">{copy.loading}</p>
              : advisoryQuery.isError ? <div className="module-alert" role="alert">{errorText(advisoryQuery.error, copy.error)} <button type="button" onClick={() => advisoryQuery.refetch()}>{copy.retry}</button></div>
                : advisories.length ? <ul>{advisories.map((item, index) => <li key={`${item.type}-${index}`}>{item.message}<small>{copy.source}: {item.basedOn}</small></li>)}</ul>
                  : <p className="module-muted">{copy.adviceNote}</p>}
            {cropGuidance && <div className="weather-crop-guidance">
              <h3>{copy.cropGuidance}{cropGuidance.crop?.name ? `: ${cropGuidance.crop.name}` : ''}</h3>
              {cropGuidance.references?.length ? <ul>{cropGuidance.references.map((reference, index) => {
                const source = reference.source;
                const isUrl = typeof source === 'string' && /^https?:\/\//i.test(source);
                return <li key={reference.id || `${reference.title || reference.recommendationType}-${index}`}>
                  <strong>{reference.title || reference.recommendationType}</strong>
                  <WeatherContent value={reference.content || reference.details} />
                  {source && <small>{copy.source}: {isUrl ? <a href={source} target="_blank" rel="noreferrer"><ExternalLink size={13} />{source}</a> : source}</small>}
                </li>;
              })}</ul> : <p className="module-muted">{copy.noCropGuidance}</p>}
            </div>}
            <p className="weather-note">{copy.adviceNote}</p>
          </section>
        </div>

        <section className="module-card weather-alert-card">
          <div className="module-card__heading"><h2><Bell size={19} />{copy.alerts}</h2>
            {preferences && <label className="weather-alert-toggle"><input type="checkbox" checked={preferences.enabled} onChange={toggleNotifications} />{copy.enableAlerts}</label>}
          </div>
          {alertsQuery.isError ? <p className="module-muted">{alertsQuery.error?.response?.status === 503 ? copy.noAlerts : errorText(alertsQuery.error, copy.error)}</p>
            : alertsQuery.isPending ? <p className="module-muted" role="status">{copy.loading}</p>
              : alertsQuery.data?.alerts?.length ? <ul>{alertsQuery.data.alerts.map((alert, index) => <li key={`${alert.title}-${index}`}><strong>{alert.title}</strong><p>{alert.description}</p><span>{alert.severity}</span></li>)}</ul>
                : <p className="module-muted">{copy.noAlerts}</p>}
          <p className="weather-note">{copy.preferenceNote}</p>
          <p className="weather-source">{copy.source}: {alertsQuery.data?.source || 'Not configured'}</p>
        </section>
      </main>
    </div>
  );
}

function LeafIcon() {
  return <CloudSun size={19} aria-hidden="true" />;
}
