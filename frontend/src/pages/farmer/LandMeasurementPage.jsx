import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownUp, Check, Compass, Crosshair, MapPin, Minus, Plus,
  Printer, Ruler, Save, Search, Share2, Trash2, Undo2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../context/LanguageContext';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import content from '../../data/landMeasurementContent';
import LandMeasurementMap from '../../components/land-measurement/LandMeasurementMap';
import '../../styles/land-measurement.css';

const shapeFields = {
  rectangle: ['length', 'width'],
  square: ['side'],
  triangle: ['base', 'height'],
  circle: ['radius'],
};
const unitLabels = {
  square_metre: 'squareMeters',
  square_foot: 'squareFeet',
  square_yard: 'squareYards',
  acre: 'acres',
  cent: 'cents',
  hectare: 'hectares',
  are: 'Ares',
  guntha: 'Guntha',
  bigha: 'Bigha',
};

function requestMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function areaValue(record, key) {
  if (key === 'areaSquareFeet' && record?.areaSquareFeet === undefined) {
    return Number(record?.areaSquareMeters || 0) / 0.09290304;
  }
  if (key === 'areaSquareYards' && record?.areaSquareYards === undefined) {
    return Number(record?.areaSquareMeters || 0) / 0.83612736;
  }
  const value = Number(record?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function distanceMeters(first, second) {
  const radians = (value) => (value * Math.PI) / 180;
  const dLat = radians(second[1] - first[1]);
  const dLon = radians(second[0] - first[0]);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(first[1])) * Math.cos(radians(second[1])) * Math.sin(dLon / 2) ** 2;
  const bounded = Math.min(1, Math.max(0, a));
  return 6371000 * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

function formatNumber(value, maximumFractionDigits = 3) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits });
}

export default function LandMeasurementPage() {
  const { lang } = useLanguage();
  const copy = content[lang] || content.en;
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('map');
  const [coordinates, setCoordinates] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const [draft, setDraft] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [plotName, setPlotName] = useState('');
  const [notes, setNotes] = useState('');
  const [shape, setShape] = useState('rectangle');
  const [dimensions, setDimensions] = useState({ length: '', width: '' });
  const [dimensionUnit, setDimensionUnit] = useState('metre');
  const [recordSearch, setRecordSearch] = useState('');
  const [recordSort, setRecordSort] = useState('newest');
  const [recordPage, setRecordPage] = useState(1);
  const [placeSearch, setPlaceSearch] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingBoundaryId, setEditingBoundaryId] = useState(null);
  const [editingManualId, setEditingManualId] = useState(null);
  const [converterValue, setConverterValue] = useState('1');
  const [fromUnit, setFromUnit] = useState('acre');
  const [toUnit, setToUnit] = useState('cent');
  const [region, setRegion] = useState('');
  const [conversion, setConversion] = useState(null);
  const watchIdRef = useRef(null);
  const lastPointRef = useRef(null);

  const recordsQuery = useQuery({
    queryKey: ['land-measurements', recordSearch, recordSort, recordPage],
    queryFn: async () => unwrapPayload(await api.get('/land-measurements', {
      params: {
        search: recordSearch || undefined,
        sortBy: recordSort.startsWith('area') ? 'area' : 'date',
        sortDirection: recordSort.endsWith('asc') || recordSort === 'oldest' ? 'asc' : 'desc',
        page: recordPage,
        limit: 100,
      },
    })),
    retry: false,
  });
  const unitsQuery = useQuery({
    queryKey: ['land-measurement-units'],
    queryFn: async () => unwrapPayload(await api.get('/land-measurements/units')),
    retry: false,
  });
  const placeQueryResult = useQuery({
    queryKey: ['land-measurement-place-search', placeQuery],
    queryFn: async () => unwrapPayload(await api.get('/weather/search', { params: { q: placeQuery } })),
    enabled: placeQuery.length >= 2,
    retry: false,
  });

  const records = recordsQuery.data?.items || [];
  const placeResults = placeQueryResult.data || [];
  const unitOptions = useMemo(() => unitsQuery.data || [], [unitsQuery.data]);
  const availableUnits = unitOptions.filter((unit) => unit.available);
  const areaSummary = draft?.calculation || selectedRecord;

  const calculateMutation = useMutation({
    mutationFn: async (data) => unwrapPayload(await api.post('/land-measurements/calculate', data)),
    onSuccess: (calculation) => {
      setDraft({
        method: 'manual',
        calculation,
        manual: { shape, dimensions: numericDimensions(), dimensionUnit },
        targetId: editingManualId,
        targetName: editingManualId ? selectedRecord?.plotName : undefined,
      });
      if (!editingManualId) setSelectedRecord(null);
      setError('');
      setNotice('');
    },
    onError: (requestError) => setError(requestMessage(requestError, copy.requestError)),
  });

  const boundaryMutation = useMutation({
    mutationFn: async (points) => unwrapPayload(await api.post('/land-measurements/boundaries', {
      boundaryCoordinates: points,
    })),
    onSuccess: (calculation) => {
      setDraft({
        method: mode,
        calculation,
        targetId: editingBoundaryId,
        targetName: editingBoundaryId ? selectedRecord?.plotName : undefined,
      });
      if (!editingBoundaryId) setSelectedRecord(null);
      setError('');
      setNotice('');
    },
    onError: (requestError) => setError(requestMessage(requestError, copy.invalidPolygon)),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft || (!draft.targetId && !plotName.trim())) throw new Error(copy.plotName);
      if (draft.targetId) {
        if (draft.method === 'manual') {
          return unwrapPayload(await api.put(`/land-measurements/${draft.targetId}`, {
            plotName: draft.targetName,
            measurementMethod: 'manual',
            manualMeasurement: draft.manual,
            notes: selectedRecord?.notes || null,
          }));
        }
        return unwrapPayload(await api.put(`/land-measurements/${draft.targetId}`, {
          plotName: draft.targetName,
          measurementMethod: 'map',
          boundaryCoordinates: draft.calculation.boundaryCoordinates || coordinates,
          notes: selectedRecord?.notes || null,
        }));
      }
      const base = { plotName: plotName.trim(), notes: notes.trim() || null };
      const payload = draft.method === 'manual'
        ? { ...base, measurementMethod: 'manual', ...draft.manual }
        : {
          ...base,
          measurementMethod: draft.method,
          boundaryCoordinates: draft.calculation.boundaryCoordinates || coordinates,
          ...(draft.method === 'gps' ? { gpsAccuracy } : {}),
        };
      return unwrapPayload(await api.post('/land-measurements', payload));
    },
    onSuccess: (record) => {
      setNotice(copy.saved);
      setError('');
      setSelectedRecord(record);
      setDraft(null);
      setEditingBoundaryId(null);
      setEditingManualId(null);
      setCoordinates(record.boundaryCoordinates || []);
      setPlotName('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['land-measurements'] });
    },
    onError: (requestError) => setError(requestMessage(requestError, requestError.message || copy.requestError)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }) => unwrapPayload(await api.put(`/land-measurements/${id}`, { plotName: name })),
    onSuccess: (record) => {
      setSelectedRecord(record);
      setEditingId(null);
      setNotice(copy.saved);
      queryClient.invalidateQueries({ queryKey: ['land-measurements'] });
    },
    onError: (requestError) => setError(requestMessage(requestError, copy.requestError)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/land-measurements/${id}`),
    onSuccess: () => {
      setSelectedRecord(null);
      setEditingBoundaryId(null);
      setEditingManualId(null);
      setNotice('');
      setCoordinates([]);
      setSelectedPoint(null);
      lastPointRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['land-measurements'] });
    },
    onError: (requestError) => setError(requestMessage(requestError, copy.requestError)),
  });

  useEffect(() => () => {
    if (watchIdRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    const bigha = unitOptions.find((unit) => unit.code === 'bigha' && unit.available);
    if (bigha?.region) setRegion(bigha.region);
  }, [unitOptions]);

  function numericDimensions() {
    return Object.fromEntries((shapeFields[shape] || []).map((field) => [field, Number(dimensions[field])]));
  }

  function stopGps() {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  function startGps() {
    if (!navigator.geolocation) {
      setError(copy.noGeolocation);
      return;
    }
    if (gpsStatus === 'finished') {
      setCoordinates([]);
      lastPointRef.current = null;
      setDraft(null);
      setSelectedRecord(null);
    }
    setError('');
    setMode('gps');
    setGpsStatus('running');
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords: point }) => {
        const current = { latitude: point.latitude, longitude: point.longitude };
        const coordinate = [point.longitude, point.latitude];
        setCurrentLocation(current);
        setGpsAccuracy(point.accuracy);
        if (!lastPointRef.current || distanceMeters(lastPointRef.current, coordinate) >= 5) {
          setCoordinates((previous) => {
            const next = [...previous, coordinate];
            lastPointRef.current = coordinate;
            return next;
          });
          setSelectedPoint(null);
          setDraft(null);
          setSelectedRecord(null);
        }
      },
      () => {
        setGpsStatus('idle');
        setError(copy.locationDenied);
        stopGps();
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  }

  function changeMode(nextMode) {
    stopGps();
    setGpsStatus('idle');
    if (nextMode !== mode || selectedRecord || editingBoundaryId) {
      setCoordinates([]);
      lastPointRef.current = null;
      setMapCenter(null);
      setSelectedPoint(null);
    }
    setMode(nextMode);
    setEditingBoundaryId(null);
    setEditingManualId(null);
    setDraft(null);
    setSelectedRecord(null);
    setError('');
    setNotice('');
  }

  function addMapPoint(point) {
    setCoordinates((previous) => [...previous, point]);
    lastPointRef.current = point;
    setSelectedPoint(null);
    setDraft(null);
    if (!editingBoundaryId) setSelectedRecord(null);
    setError('');
  }

  function removePoint(index) {
    setCoordinates((previous) => {
      const next = previous.filter((_, pointIndex) => pointIndex !== index);
      lastPointRef.current = next[next.length - 1] || null;
      return next;
    });
    setSelectedPoint(null);
    setDraft(null);
  }

  function undoPoint() {
    setCoordinates((previous) => {
      const next = previous.slice(0, -1);
      lastPointRef.current = next[next.length - 1] || null;
      return next;
    });
    setDraft(null);
    setSelectedPoint(null);
  }

  function clearPoints() {
    setCoordinates([]);
    lastPointRef.current = null;
    setDraft(null);
    setSelectedRecord(null);
    setEditingBoundaryId(null);
    setSelectedPoint(null);
    setGpsStatus('idle');
    stopGps();
  }

  function calculateBoundary() {
    setError('');
    setNotice('');
    if (coordinates.length < 3) {
      setError(copy.invalidPolygon);
      return;
    }
    if (mode === 'gps' && (!Number.isFinite(gpsAccuracy) || gpsAccuracy <= 0)) {
      setError(copy.gpsUnavailable);
      return;
    }
    stopGps();
    setGpsStatus('finished');
    boundaryMutation.mutate(coordinates);
  }

  function calculateManual(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    calculateMutation.mutate({
      shape,
      dimensions: numericDimensions(),
      dimensionUnit,
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError(copy.noGeolocation);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords: point }) => {
        setMapCenter({ latitude: point.latitude, longitude: point.longitude });
        setCurrentLocation({ latitude: point.latitude, longitude: point.longitude });
        setGpsAccuracy(point.accuracy);
        setError('');
      },
      () => setError(copy.locationDenied),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  function searchPlace(event) {
    event.preventDefault();
    setPlaceQuery(placeSearch.trim());
  }

  function selectPlace(place) {
    setMapCenter({ latitude: Number(place.latitude), longitude: Number(place.longitude) });
    setPlaceSearch('');
    setPlaceQuery('');
    setNotice(copy.locationSelected);
  }

  function selectRecord(record) {
    stopGps();
    setGpsStatus('idle');
    setMode(record.boundaryCoordinates?.length ? 'map' : 'manual');
    setSelectedRecord(record);
    setEditingBoundaryId(null);
    setEditingManualId(null);
    setSelectedPoint(null);
    setDraft(null);
    setCoordinates(record.boundaryCoordinates || []);
    lastPointRef.current = record.boundaryCoordinates?.[record.boundaryCoordinates.length - 1] || null;
    setGpsAccuracy(record.gpsAccuracy === null || record.gpsAccuracy === undefined ? null : Number(record.gpsAccuracy));
    if (record.centerLatitude !== null && record.centerLatitude !== undefined
      && record.centerLongitude !== null && record.centerLongitude !== undefined) {
      setMapCenter({ latitude: Number(record.centerLatitude), longitude: Number(record.centerLongitude) });
    } else {
      setMapCenter(null);
    }
    setError('');
  }

  async function shareSummary() {
    if (!areaSummary) return;
    const text = `${copy.reportTitle}: ${selectedRecord?.plotName || plotName || copy.title}\n${copy.result}: ${formatNumber(areaValue(areaSummary, 'areaAcres'))} ${copy.acres} (${formatNumber(areaValue(areaSummary, 'areaCents'))} ${copy.cents})\n${copy.surveyNote}`;
    try {
      if (navigator.share) await navigator.share({ title: copy.reportTitle, text });
      else {
        await navigator.clipboard.writeText(text);
        setNotice(copy.saved);
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') setError(copy.requestError);
    }
  }

  function speakSummary() {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      setError(copy.speechUnavailable);
      return;
    }
    const name = selectedRecord?.plotName || plotName || copy.title;
    const message = `${name}. ${copy.result}: ${formatNumber(areaValue(areaSummary, 'areaAcres'))} ${copy.acres}. ${formatNumber(areaValue(areaSummary, 'areaCents'))} ${copy.cents}. ${copy.surveyNote}`;
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(message);
    utterance.lang = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.onerror = () => setError(copy.speechUnavailable);
    window.speechSynthesis.speak(utterance);
  }

  function beginEdit(record) {
    setEditingId(record.id);
    setEditingName(record.plotName);
  }

  function editManualRecord() {
    if (!selectedRecord) return;
    setMode('manual');
    setEditingManualId(selectedRecord.id);
    setShape('rectangle');
    setDimensions({ length: '', width: '' });
    setDraft(null);
    setError('');
  }

  const recordSummary = recordsQuery.data?.summary;
  const activeMethod = draft?.method || selectedRecord?.measurementMethod || mode;
  const methodLabel = activeMethod === 'gps' ? copy.gps : activeMethod === 'map' ? copy.map : copy.manual;
  const mapCoordinates = selectedRecord && editingBoundaryId !== selectedRecord.id
    ? selectedRecord.boundaryCoordinates || []
    : coordinates;
  const loading = calculateMutation.isPending || boundaryMutation.isPending;

  return (
    <div className="agri-module-page land-page">
      <header className="module-topbar">
        <Link to="/farmer/dashboard" className="module-brand" aria-label="AGRISATHI dashboard"><Logo size="small" /></Link>
        <div className="module-topbar__title"><Ruler size={21} /><h1>{copy.title}</h1></div>
        <div className="module-topbar__actions">
          <ModuleLanguageSelector label={lang === 'te' ? 'భాష' : lang === 'hi' ? 'भाषा' : 'Language'} />
          <Link className="module-back-link" to="/farmer/dashboard">{copy.dashboard}</Link>
        </div>
      </header>

      <main className="land-layout">
        <section className="land-hero">
          <div><p className="module-eyebrow">{copy.title}</p><h2>{copy.subtitle}</h2><p>{copy.surveyNote}</p></div>
          <div className="land-hero__icon"><Ruler size={42} /></div>
        </section>

        <section className="land-mode-grid" aria-label={copy.title}>
          {[
            ['gps', Crosshair, copy.gps, copy.gpsDescription],
            ['map', MapPin, copy.map, copy.mapDescription],
            ['manual', Ruler, copy.manual, copy.manualDescription],
          ].map(([value, Icon, title, description]) => (
            <button type="button" className={`land-mode-card${mode === value ? ' is-active' : ''}`} key={value} onClick={() => changeMode(value)} aria-pressed={mode === value}>
              <span><Icon size={22} /></span><strong>{title}</strong><small>{description}</small>
            </button>
          ))}
        </section>

        {error && <p className="module-alert" role="alert">{error}</p>}
        {notice && <p className="module-success" role="status"><Check size={17} />{notice}</p>}

        {mode !== 'manual' ? (
          <section className="module-card land-map-card">
            <div className="module-card__heading"><h2><MapPin size={19} />{selectedRecord?.plotName || copy.map}</h2>
              <span className="land-point-count">{copy.points}: {mapCoordinates.length}</span>
            </div>
            {mode === 'map' && <>
              <form className="land-place-search" onSubmit={searchPlace}>
                <Search size={18} />
                <input value={placeSearch} onChange={(event) => setPlaceSearch(event.target.value)} placeholder={copy.mapSearch} maxLength={100} aria-label={copy.mapSearch} />
                <button type="submit" disabled={placeSearch.trim().length < 2}>{copy.search}</button>
                <button type="button" className="module-secondary-button" onClick={useCurrentLocation}><Compass size={17} />{copy.useDeviceLocation}</button>
              </form>
              {placeQueryResult.isError && <p className="module-alert" role="alert">{requestMessage(placeQueryResult.error, copy.requestError)} <button type="button" className="module-secondary-button" onClick={() => placeQueryResult.refetch()}>{copy.retry}</button></p>}
              {placeQuery && placeQueryResult.isPending && <p className="module-muted" role="status">{copy.loading}</p>}
              {placeQuery && !placeQueryResult.isPending && !placeResults.length && <p className="module-muted">{copy.searchNoResults}</p>}
              {!!placeResults.length && <ul className="land-place-results">{placeResults.map((place) => (
                <li key={`${place.latitude}-${place.longitude}`}><button type="button" onClick={() => selectPlace(place)}><MapPin size={16} /><span><strong>{place.name}</strong><small>{[place.admin1, place.country].filter(Boolean).join(', ')}</small></span></button></li>
              ))}</ul>}
            </>}
            <LandMeasurementMap
              coordinates={mapCoordinates}
              key={mapVersion}
              currentLocation={currentLocation}
              center={mapCenter}
              selectedPoint={selectedPoint}
              interactive={mode === 'map' && (!selectedRecord || editingBoundaryId === selectedRecord.id)}
              onAddPoint={mode === 'map' && (!selectedRecord || editingBoundaryId === selectedRecord.id) ? addMapPoint : undefined}
              onSelectPoint={setSelectedPoint}
              onMapError={() => setMapError(true)}
              label={copy.points}
              gpsLabel={copy.gpsLocation}
            />
            {mapError && <p className="module-alert" role="alert">{copy.mapError} <button type="button" className="module-secondary-button" onClick={() => { setMapError(false); setMapVersion((value) => value + 1); }}>{copy.retry}</button></p>}
            <p className="land-map-note">{mode === 'gps' ? copy.gpsDescription : copy.mapInstructions}</p>

            {mode === 'gps' && (
              <div className="land-gps-controls">
                {gpsStatus === 'idle' || gpsStatus === 'finished'
                  ? <button className="module-primary-button" type="button" onClick={startGps}><Crosshair size={18} />{copy.start}</button>
                  : gpsStatus === 'running'
                    ? <button className="module-secondary-button" type="button" onClick={() => { stopGps(); setGpsStatus('paused'); }}><Minus size={17} />{copy.pause}</button>
                    : <button className="module-primary-button" type="button" onClick={startGps}><Plus size={17} />{copy.resume}</button>}
                {gpsStatus !== 'idle' && gpsStatus !== 'finished' && <button className="module-secondary-button" type="button" onClick={calculateBoundary}>{copy.finish}</button>}
                <button className="module-secondary-button" type="button" disabled={!currentLocation} onClick={() => currentLocation && addMapPoint([currentLocation.longitude, currentLocation.latitude])}>{copy.addGpsPoint}</button>
                {gpsStatus === 'running' && <span className="land-accuracy">{copy.trackingLocation}</span>}
                {gpsAccuracy !== null && <span className="land-accuracy">{copy.accuracy}: {formatNumber(gpsAccuracy, 1)} m</span>}
              </div>
            )}

            <div className="land-map-actions">
              <button className="module-secondary-button" type="button" onClick={undoPoint} disabled={!mapCoordinates.length || (!!selectedRecord && editingBoundaryId !== selectedRecord.id)}><Undo2 size={17} />{copy.undo}</button>
              <button className="module-secondary-button" type="button" onClick={() => selectedPoint !== null && (!selectedRecord || editingBoundaryId === selectedRecord.id) && removePoint(selectedPoint)} disabled={selectedPoint === null || (!!selectedRecord && editingBoundaryId !== selectedRecord.id)}><Minus size={17} />{copy.removePoint}</button>
              <button className="module-secondary-button" type="button" onClick={clearPoints} disabled={!coordinates.length}><Trash2 size={17} />{copy.clear}</button>
              <button className="module-primary-button" type="button" onClick={calculateBoundary} disabled={loading || mapCoordinates.length < 3 || (!!selectedRecord && editingBoundaryId !== selectedRecord.id)}>
                <Ruler size={17} />{loading ? copy.loading : copy.calculate}
              </button>
            </div>
            {gpsAccuracy !== null && gpsAccuracy > 20 && mode === 'gps' && <p className="module-alert" role="alert">{copy.poorGps}</p>}
          </section>
        ) : (
          <section className="module-card land-manual-card">
            <div className="module-card__heading"><h2><Ruler size={19} />{editingManualId ? copy.replaceMeasurement : copy.manual}</h2></div>
            <form className="land-manual-form" onSubmit={calculateManual}>
              <label>{copy.shape}<select value={shape} onChange={(event) => {
                const nextShape = event.target.value;
                setShape(nextShape);
                setDimensions(Object.fromEntries(shapeFields[nextShape].map((field) => [field, ''])));
                setDraft(null);
              }}>{Object.keys(shapeFields).map((value) => <option key={value} value={value}>{copy[value]}</option>)}</select></label>
              <label>{copy.dimensionUnit}<select value={dimensionUnit} onChange={(event) => setDimensionUnit(event.target.value)}>
                {['metre', 'foot', 'yard'].map((value) => <option key={value} value={value}>{copy[value]}</option>)}
              </select></label>
              {shapeFields[shape].map((field) => <label key={field}>{copy[field]}
                <input type="number" min="0.001" max="1000000" step="any" required value={dimensions[field] || ''} onChange={(event) => setDimensions((previous) => ({ ...previous, [field]: event.target.value }))} />
              </label>)}
              <button className="module-primary-button" type="submit" disabled={calculateMutation.isPending}><Ruler size={17} />{calculateMutation.isPending ? copy.loading : copy.calculate}</button>
            </form>
          </section>
        )}

        {areaSummary && (
          <section className="module-card land-result-card" aria-live="polite">
            <div className="module-card__heading"><h2>{copy.result}</h2><span>{selectedRecord?.plotName || plotName || copy.title}</span></div>
            <div className="land-area-grid">
              {[
                ['areaSquareMeters', copy.squareMeters],
                ['areaAcres', copy.acres],
                ['areaCents', copy.cents],
                ['areaHectares', copy.hectares],
                ['areaSquareFeet', copy.squareFeet],
                ['areaSquareYards', copy.squareYards],
              ].map(([key, label]) => <div key={key}><strong>{formatNumber(areaValue(areaSummary, key), key === 'areaSquareMeters' ? 2 : 4)}</strong><span>{label}</span></div>)}
            </div>
            {draft && <form className="land-save-form" onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }}>
              {draft.targetId ? <strong>{draft.targetName}</strong> : <label>{copy.plotName}<input required maxLength={120} value={plotName} onChange={(event) => setPlotName(event.target.value)} placeholder={copy.plotNamePlaceholder} /></label>}
              {!draft.targetId && <label>{copy.notes}<input maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>}
              <button className="module-primary-button" type="submit" disabled={saveMutation.isPending}><Save size={17} />{saveMutation.isPending ? copy.saving : draft.targetId ? copy.update : copy.save}</button>
            </form>}
            <p className="land-method-note">{copy.method}: {methodLabel}
              {selectedRecord && <> · {copy.date}: {new Date(selectedRecord.createdAt).toLocaleDateString()}</>}
              {(selectedRecord?.gpsAccuracy || (draft?.method === 'gps' && gpsAccuracy)) && <> · {copy.accuracy}: {formatNumber(selectedRecord?.gpsAccuracy || gpsAccuracy, 1)} m</>}
            </p>
            {selectedRecord?.boundaryCoordinates?.length >= 3 && !editingBoundaryId && <button type="button" className="module-secondary-button" onClick={() => {
              setMode('map');
              setEditingBoundaryId(selectedRecord.id);
              setCoordinates(selectedRecord.boundaryCoordinates);
              setSelectedPoint(null);
              setDraft(null);
            }}>{copy.editBoundary}</button>}
            {selectedRecord?.measurementMethod === 'manual' && !editingManualId && <button type="button" className="module-secondary-button" onClick={editManualRecord}>{copy.replaceMeasurement}</button>}
            {draft?.calculation?.formula && <p className="land-method-note">{copy.formula}: {draft.calculation.formula}</p>}
            <p className="land-method-note">{copy.surveyNote}</p>
            <div className="land-report-actions">
              <button type="button" className="module-secondary-button" onClick={speakSummary}><Ruler size={17} />{copy.speak}</button>
              <button type="button" className="module-secondary-button" onClick={shareSummary}><Share2 size={17} />{copy.share}</button>
              <button type="button" className="module-secondary-button" onClick={() => window.print()}><Printer size={17} />{copy.print}</button>
            </div>
          </section>
        )}

        <section className="module-card land-converter-card">
          <div className="module-card__heading"><h2><ArrowDownUp size={19} />{copy.unitConverter}</h2></div>
          {unitsQuery.isPending && <p className="module-muted" role="status">{copy.loading}</p>}
          {unitsQuery.isError && <p className="module-alert" role="alert">{requestMessage(unitsQuery.error, copy.requestError)} <button type="button" className="module-secondary-button" onClick={() => unitsQuery.refetch()}>{copy.retry}</button></p>}
          <form className="land-converter-form" onSubmit={async (event) => {
            event.preventDefault();
            setConversion(null);
            setError('');
            try {
              const converted = unwrapPayload(await api.post('/land-measurements/convert', {
                value: Number(converterValue), fromUnit, toUnit, region: region.trim() || undefined,
              }));
              setConversion(converted);
            } catch (requestError) {
              setError(requestMessage(requestError, copy.requestError));
            }
          }}>
            <label>{copy.amount}<input type="number" min="0.000001" step="any" required value={converterValue} onChange={(event) => setConverterValue(event.target.value)} /></label>
            <label>{copy.fromUnit}<select value={fromUnit} onChange={(event) => setFromUnit(event.target.value)}>
              {availableUnits.map((unit) => <option key={unit.code} value={unit.code}>{copy[unitLabels[unit.code]] || unit.label}</option>)}
            </select></label>
            <label>{copy.toUnit}<select value={toUnit} onChange={(event) => setToUnit(event.target.value)}>
              {availableUnits.map((unit) => <option key={unit.code} value={unit.code}>{copy[unitLabels[unit.code]] || unit.label}</option>)}
            </select></label>
            {unitOptions.find((unit) => unit.code === 'bigha')?.available && (fromUnit === 'bigha' || toUnit === 'bigha')
              ? <label>{copy.region}<input value={region} onChange={(event) => setRegion(event.target.value)} /></label>
              : null}
            <button type="submit" className="module-primary-button" disabled={!availableUnits.length}><ArrowDownUp size={17} />{copy.convert}</button>
          </form>
          {unitOptions.find((unit) => unit.code === 'bigha' && !unit.available) && <p className="land-method-note">{copy.bighaUnavailable}</p>}
          {conversion && <div className="land-conversion-result" role="status">
            <strong>{formatNumber(conversion.value, 6)} {copy[unitLabels[conversion.toUnit]] || conversion.toUnit}</strong>
            <span>{formatNumber(conversion.areaSquareMeters, 2)} {copy.squareMeters}</span>
            <small>{conversion.formula}</small>
          </div>}
        </section>

        <section className="module-card land-records-card">
          <div className="module-card__heading"><h2><MapPin size={19} />{copy.records}</h2>
            {recordSummary && <span>{recordSummary.plotCount} · {formatNumber(recordSummary.areaAcres, 3)} {copy.acres}</span>}
          </div>
          <div className="land-record-filters">
            <label className="land-record-search"><Search size={17} /><input value={recordSearch} onChange={(event) => { setRecordSearch(event.target.value); setRecordPage(1); }} placeholder={copy.searchPlots} aria-label={copy.searchPlots} /></label>
            <label className="land-record-sort">{copy.sortBy}<select value={recordSort} onChange={(event) => { setRecordSort(event.target.value); setRecordPage(1); }}>
              <option value="newest">{copy.newest}</option>
              <option value="oldest">{copy.oldest}</option>
              <option value="area-desc">{copy.largest}</option>
              <option value="area-asc">{copy.smallest}</option>
            </select></label>
          </div>
          {recordsQuery.isPending ? <p className="module-muted" role="status">{copy.loading}</p>
            : recordsQuery.isError ? <p className="module-alert" role="alert">{requestMessage(recordsQuery.error, copy.requestError)} <button type="button" onClick={() => recordsQuery.refetch()}>{copy.search}</button></p>
              : records.length === 0 ? <p className="module-muted">{recordSearch ? copy.noResults : copy.noRecords}</p>
                : <ul className="land-record-list">{records.map((record) => (
                  <li key={record.id} className={selectedRecord?.id === record.id ? 'is-selected' : ''}>
                    {editingId === record.id
                      ? <form onSubmit={(event) => { event.preventDefault(); updateMutation.mutate({ id: record.id, name: editingName.trim() }); }}>
                        <input required maxLength={120} value={editingName} onChange={(event) => setEditingName(event.target.value)} aria-label={copy.plotName} />
                        <button className="module-secondary-button" type="submit" disabled={updateMutation.isPending}>{copy.save}</button>
                        <button className="module-secondary-button" type="button" onClick={() => setEditingId(null)}>{copy.clear}</button>
                      </form>
                      : <button type="button" className="land-record-main" onClick={() => selectRecord(record)}>
                        <span><strong>{record.plotName}</strong><small>{formatNumber(areaValue(record, 'areaAcres'), 3)} {copy.acres} · {record.measurementMethod}</small></span>
                        <small>{new Date(record.createdAt).toLocaleDateString()}</small>
                      </button>}
                    <div className="land-record-actions">
                      <button type="button" className="module-secondary-button" onClick={() => beginEdit(record)}>{copy.edit}</button>
                      <button type="button" className="module-secondary-button" onClick={() => {
                        if (window.confirm(copy.confirmDelete)) deleteMutation.mutate(record.id);
                      }} disabled={deleteMutation.isPending}><Trash2 size={16} />{copy.delete}</button>
                    </div>
                  </li>
                ))}</ul>}
          {recordsQuery.data?.total > 100 && <div className="land-pagination">
            <button type="button" className="module-secondary-button" onClick={() => setRecordPage((page) => Math.max(1, page - 1))} disabled={recordPage === 1}>{copy.previous}</button>
            <span>{recordPage} / {Math.ceil(recordsQuery.data.total / 100)}</span>
            <button type="button" className="module-secondary-button" onClick={() => setRecordPage((page) => page + 1)} disabled={recordPage >= Math.ceil(recordsQuery.data.total / 100)}>{copy.next}</button>
          </div>}
          {selectedRecord && <button type="button" className="module-secondary-button land-clear-selection" onClick={() => { setSelectedRecord(null); setEditingBoundaryId(null); setCoordinates([]); setMapCenter(null); }}>{copy.clear}</button>}
          <p className="land-method-note">{copy.surveyNote}</p>
        </section>
      </main>
    </div>
  );
}
