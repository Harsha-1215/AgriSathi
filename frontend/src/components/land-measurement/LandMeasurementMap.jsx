import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const INDIA_CENTER = [20.5937, 78.9629];
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL
  || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = import.meta.env.VITE_MAP_TILE_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function LandMeasurementMap({
  coordinates,
  currentLocation,
  center,
  selectedPoint,
  interactive = false,
  onAddPoint,
  onSelectPoint,
  onMapError,
  label,
  gpsLabel,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const onAddPointRef = useRef(onAddPoint);
  const onSelectPointRef = useRef(onSelectPoint);
  const onMapErrorRef = useRef(onMapError);

  useEffect(() => {
    onAddPointRef.current = onAddPoint;
  }, [onAddPoint]);

  useEffect(() => {
    onSelectPointRef.current = onSelectPoint;
  }, [onSelectPoint]);

  useEffect(() => {
    onMapErrorRef.current = onMapError;
  }, [onMapError]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    try {
      const map = L.map(containerRef.current, { zoomControl: true }).setView(INDIA_CENTER, 5);
      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: TILE_ATTRIBUTION,
      }).addTo(map).on('tileerror', () => onMapErrorRef.current?.());
      map.on('click', (event) => {
        if (onAddPointRef.current) onAddPointRef.current([event.latlng.lng, event.latlng.lat]);
      });
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    } catch {
      onMapErrorRef.current?.();
    }

    return () => {
      layersRef.current.forEach((layer) => layer.remove());
      layersRef.current = [];
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !center || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return;
    mapRef.current.setView([center.latitude, center.longitude], 15);
  }, [center?.latitude, center?.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];

    const validPoints = coordinates.filter((point) => Array.isArray(point) && point.length === 2);
    const latLngs = validPoints.map(([longitude, latitude]) => [latitude, longitude]);
    if (latLngs.length >= 3) {
      const polygon = L.polygon(latLngs, {
        color: '#166534',
        weight: 3,
        fillColor: '#22c55e',
        fillOpacity: 0.18,
      }).addTo(map);
      layersRef.current.push(polygon);
    }

    validPoints.forEach(([longitude, latitude], index) => {
      const selected = selectedPoint === index;
      const marker = L.circleMarker([latitude, longitude], {
        radius: selected ? 9 : 7,
        color: selected ? '#9a3412' : '#14532d',
        weight: 2,
        fillColor: selected ? '#fb923c' : '#22c55e',
        fillOpacity: 1,
      }).addTo(map);
      marker.bindTooltip(`${label} ${index + 1}`);
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event.originalEvent);
        marker.openTooltip();
        if (interactive && onSelectPointRef.current) onSelectPointRef.current(index);
      });
      layersRef.current.push(marker);
    });

    if (currentLocation && Number.isFinite(currentLocation.latitude) && Number.isFinite(currentLocation.longitude)) {
      const marker = L.circleMarker([currentLocation.latitude, currentLocation.longitude], {
        radius: 8,
        color: '#1d4ed8',
        weight: 3,
        fillColor: '#60a5fa',
        fillOpacity: 0.9,
      }).addTo(map);
      marker.bindTooltip(gpsLabel);
      marker.on('click', (event) => L.DomEvent.stopPropagation(event.originalEvent));
      layersRef.current.push(marker);
    }

    if (latLngs.length > 1 && !center) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24], maxZoom: 17 });
    } else if (latLngs.length === 1 && !center) {
      map.setView(latLngs[0], 16);
    }
  }, [coordinates, currentLocation, center, interactive, label, selectedPoint, gpsLabel]);

  return <div ref={containerRef} className="land-map" role="application" aria-label="Interactive field boundary map" />;
}
