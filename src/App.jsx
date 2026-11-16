import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ProblemSection from './components/ProblemSection';
import ServicesSection from './components/ServicesSection';
import FlowSection from './components/FlowSection';
import PlannerSection from './components/PlannerSection';
import AccessibilitySection from './components/AccessibilitySection';
import {
  AP_DISTRICTS, SOILS, SEASONS, WATER, CROPS, FERT_REF, IRRIGATION_REF,
  CROP_DURATION, PRICE_REF, PRICE_COMMODITY_MAP, DISEASE_REF, SCHEMES, TILES, STR
} from './data';

const WEATHER_API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY';
const MARKET_API_KEY = '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571';
const MARKET_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const PLANT_HEALTH_API_KEY = 'YOUR_PLANT_ID_API_KEY';

function hasRealKey(k) { return !!k && k.indexOf('YOUR_') !== 0; }

function cacheGet(key) {
  try { return JSON.parse(localStorage.getItem('agrisathi_cache_' + key) || 'null'); }
  catch (e) { return null; }
}
function cacheSet(key, value) {
  try { localStorage.setItem('agrisathi_cache_' + key, JSON.stringify({ value, ts: Date.now() })); }
  catch (e) {}
}
function cacheAgeLabel(ts, lang) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 60) return mins + (lang === 'te' ? ' ని' : 'm');
  return Math.round(mins / 60) + (lang === 'te' ? ' గం' : 'h');
}

async function fetchLiveWeather(dist, lang) {
  const fallback = { temp: 32, hum: 60, wind: 10, rainMm: 0, desc: lang === 'te' ? 'పాక్షిక మేఘావృతం' : 'Partly cloudy', live: false };
  if (!dist || !hasRealKey(WEATHER_API_KEY) || !navigator.onLine) {
    const cached = cacheGet('weather_' + (dist ? dist.id : 'default'));
    if (cached) return { ...cached.value, live: false, cachedAge: cacheAgeLabel(cached.ts, lang) };
    return fallback;
  }
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${dist.lat}&lon=${dist.lon}&units=metric&lang=${lang === 'te' ? 'te' : 'en'}&appid=${WEATHER_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather api error ' + res.status);
    const data = await res.json();
    const result = {
      temp: Math.round(data.main.temp),
      hum: data.main.humidity,
      wind: Math.round((data.wind && data.wind.speed || 0) * 3.6),
      rainMm: (data.rain && (data.rain['1h'] || data.rain['3h'])) || 0,
      desc: (data.weather && data.weather[0] && data.weather[0].description) || fallback.desc,
      live: true
    };
    cacheSet('weather_' + dist.id, result);
    return result;
  } catch (e) {
    const cachedFallback = cacheGet('weather_' + (dist ? dist.id : 'default'));
    if (cachedFallback) return { ...cachedFallback.value, live: false, cachedAge: cacheAgeLabel(cachedFallback.ts, lang) };
    return fallback;
  }
}

async function fetchLiveMarketPrice(cropId, lang) {
  const fb = PRICE_REF[cropId] || { price: 0, unit: 'quintal', trend: 'stable' };
  const commodity = PRICE_COMMODITY_MAP[cropId];
  if (!commodity || !hasRealKey(MARKET_API_KEY) || !navigator.onLine) {
    const cached = cacheGet('price_' + cropId);
    if (cached) return { ...cached.value, live: false, cachedAge: cacheAgeLabel(cached.ts, lang) };
    return { live: false, ...fb };
  }
  try {
    const url = `https://api.data.gov.in/resource/${MARKET_RESOURCE_ID}?api-key=${MARKET_API_KEY}&format=json&limit=50&filters[state.keyword]=Andhra%20Pradesh&filters[commodity.keyword]=${encodeURIComponent(commodity)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('market api error ' + res.status);
    const data = await res.json();
    const records = (data && data.records) || [];
    if (records.length === 0) {
      const cachedEmpty = cacheGet('price_' + cropId);
      if (cachedEmpty) return { ...cachedEmpty.value, live: false, cachedAge: cacheAgeLabel(cachedEmpty.ts, lang) };
      return { live: false, ...fb };
    }
    records.sort((a, b) => new Date(b.arrival_date) - new Date(a.arrival_date));
    const latestDate = records[0].arrival_date;
    const latestRecords = records.filter(r => r.arrival_date === latestDate);
    const avgPrice = Math.round(latestRecords.reduce((s, r) => s + parseFloat(r.modal_price || 0), 0) / latestRecords.length);
    let trend = 'stable';
    const olderRecords = records.filter(r => r.arrival_date !== latestDate);
    if (olderRecords.length) {
      const prevDate = olderRecords[0].arrival_date;
      const prevRecords = olderRecords.filter(r => r.arrival_date === prevDate);
      const avgPrev = prevRecords.reduce((s, r) => s + parseFloat(r.modal_price || 0), 0) / prevRecords.length;
      if (avgPrice > avgPrev * 1.02) trend = 'rising';
      else if (avgPrice < avgPrev * 0.98) trend = 'falling';
    }
    const result = { price: avgPrice, unit: fb.unit, trend, live: true, asOf: latestDate };
    cacheSet('price_' + cropId, result);
    return result;
  } catch (e) {
    const cachedFallback = cacheGet('price_' + cropId);
    if (cachedFallback) return { ...cachedFallback.value, live: false, cachedAge: cacheAgeLabel(cachedFallback.ts, lang) };
    return { live: false, ...fb };
  }
}

function T(key, vars, lang) {
  const s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
  if (vars) {
    Object.keys(vars).forEach(k => { s.replace('{' + k + '}', vars[k]); });
  }
  return s;
}
function L(obj, lang) { return obj[lang] || obj.en; }

function recommendCrops(soil, season, water) {
  const table = {
    black: { kharif: ['cotton', 'groundnut', 'redgram', 'sesame', 'sunflower', 'chilli'], rabi: ['chilli', 'bengalgram', 'sunflower', 'groundnut'], summer: ['groundnut', 'sunflower', 'sesame'] },
    red: { kharif: ['groundnut', 'redgram', 'blackgram', 'greengram', 'maize', 'chilli'], rabi: ['chilli', 'bengalgram', 'maize', 'sunflower', 'tobacco'], summer: ['groundnut', 'sesame', 'maize'] },
    alluvial: { kharif: ['paddy', 'sugarcane', 'maize', 'greengram', 'chilli', 'turmeric', 'banana'], rabi: ['paddy', 'chilli', 'maize', 'bengalgram'], summer: ['paddy', 'maize', 'sesame'] },
    sandy: { kharif: ['groundnut', 'sesame', 'redgram', 'sunflower'], rabi: ['groundnut', 'sunflower', 'bengalgram'], summer: ['groundnut', 'sesame'] }
  };
  let list = (table[soil] && table[soil][season]) ? table[soil][season].slice() : ['groundnut', 'chilli'];
  if (water === 'rainfed') {
    const thirsty = { paddy: 1, sugarcane: 1, banana: 1, turmeric: 1 };
    list = list.filter(c => !thirsty[c]);
  }
  if (list.length === 0) list = ['groundnut'];
  return list;
}

function App() {
  const [lang, setLang] = useState(() => {
    const btn = document.querySelector('.lang-switch button.active');
    return (btn && btn.textContent === 'తెలుగు') ? 'te' : 'en';
  });
  const [loggedIn, setLoggedIn] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [profile, setProfile] = useState({
    name: '', mobile: '', loginMethod: '', district: '', soil: '', season: '', water: '', crop: '', landSize: 2, sowDays: 20
  });
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [modal, setModal] = useState({ open: false, title: '', body: '', speech: '' });
  const [showBubble, setShowBubble] = useState(false);

  const steps = [
    { id: 'lang', render: () => null },
    { id: 'loginMethod', render: () => null },
    { id: 'loginDetails', render: () => null },
    { id: 'district', render: () => null },
    { id: 'soil', render: () => null },
    { id: 'season', render: () => null },
    { id: 'water', render: () => null },
    { id: 'crop', render: () => null },
    { id: 'landSize', render: () => null },
    { id: 'sowDays', render: () => null, skip: () => profile.crop === 'none' || !profile.crop },
    { id: 'confirm', render: () => null }
  ];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrisathi_state') || 'null');
      if (saved) {
        setLang(saved.lang || 'en');
        setLoggedIn(saved.loggedIn || false);
        setRemindersOn(saved.remindersOn || false);
        setProfile({ ...profile, ...saved.profile });
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('agrisathi_state', JSON.stringify({ lang, loggedIn, remindersOn, profile })); }
    catch (e) {}
  }, [lang, loggedIn, remindersOn, profile]);

  const speak = useCallback((text) => {
    if (lang !== 'en' && text && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === 'te' ? 'te-IN' : 'en-IN';
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
  }, [lang]);

  const switchLang = useCallback((newLang) => {
    setLang(newLang);
    document.querySelectorAll('.lang-switch button').forEach(b => {
      b.classList.toggle('active', (newLang === 'te') === (b.textContent === 'తెలుగు'));
    });
    document.querySelectorAll('[data-en]').forEach(el => {
      el.innerHTML = el.getAttribute('data-' + newLang);
    });
  }, []);

  const openApp = useCallback(() => {
    setOverlayOpen(true);
    setStepIndex(0);
  }, []);

  const closeApp = useCallback(() => {
    setOverlayOpen(false);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const doLogout = useCallback(() => {
    setLoggedIn(false);
    setStepIndex(0);
  }, []);

  const goNext = useCallback(() => {
    let next = stepIndex + 1;
    while (next < steps.length && steps[next].skip && steps[next].skip()) next++;
    if (next >= steps.length) {
      setLoggedIn(true);
      setOverlayOpen(false);
    } else {
      setStepIndex(next);
    }
  }, [stepIndex, profile]);

  const goBack = useCallback(() => {
    let prev = stepIndex - 1;
    while (prev > 0 && steps[prev] && steps[prev].skip && steps[prev].skip()) prev--;
    setStepIndex(Math.max(0, prev));
  }, [stepIndex]);

  const doFaceCapture = useCallback(() => {
    speak(T('faceScanning', {}, lang));
    setTimeout(() => {
      speak(T('faceDone', {}, lang));
      setTimeout(() => {}, 800);
    }, 1600);
  }, [speak, lang]);

  const [mobile, setMobile] = useState('');
  const kp = useCallback((d) => {
    if (mobile.length >= 10) return;
    setMobile(m => m + d);
  }, [mobile]);
  const kpBack = useCallback(() => {
    setMobile(m => m.slice(0, -1));
  }, []);
  const kpDone = useCallback(() => {
    if (mobile.length < 10) return;
    setProfile(p => ({ ...p, mobile }));
    goNext();
  }, [mobile, goNext]);

  const pickLoginMethod = useCallback((m) => {
    setProfile(p => ({ ...p, loginMethod: m }));
    goNext();
  }, [goNext]);

  const pickChoice = useCallback((field, value, options) => {
    setProfile(p => ({ ...p, [field]: value }));
    const opt = options.find(o => o.id === value);
    if (opt) speak(L(opt, lang));
    setTimeout(goNext, 500);
  }, [goNext, speak, lang]);

  const [landSize, setLandSize] = useState(2);
  const landStep = useCallback((dir) => {
    setLandSize(s => Math.max(1, Math.min(50, s + dir)));
  }, []);
  const [sowDays, setSowDays] = useState(20);
  const sowStep = useCallback((dir) => {
    setSowDays(s => Math.max(0, Math.min(300, s + dir)));
  }, []);

  const finishOnboarding = useCallback(() => {
    setLoggedIn(true);
    setOverlayOpen(false);
  }, []);

  const openService = useCallback((id) => {
    const p = profile;
    const cropObj = CROPS.find(c => c.id === p.crop);
    const cropName = cropObj ? L(cropObj, lang) : '';
    const soilObj = SOILS.find(c => c.id === p.soil);
    const seasonObj = SEASONS.find(c => c.id === p.season);
    const distObj = AP_DISTRICTS.find(c => c.id === p.district);

    if (id === 'crop') {
      const recs = recommendCrops(p.soil, p.season, p.water);
      const html = `<p style="margin:0 0 14px; color:#5a4c3a;">${T('cropRecFor', { soil: soilObj ? L(soilObj, lang) : '', season: seasonObj ? L(seasonObj, lang) : '' }, lang)}</p>` +
        recs.map(cid => {
          const c = CROPS.find(x => x.id === cid);
          return `<div class="result-card"><h4>${c.em} ${L(c, lang)}</h4><p>${L(IRRIGATION_REF[cid], lang)}</p></div>`;
        }).join('');
      setModal({ open: true, title: T('cropRecTitle', {}, lang), body: html, speech: T('cropRecTitle', {}, lang) + '. ' + recs.map(cid => L(CROPS.find(x => x.id === cid), lang)).join(', ') });
      return;
    }
    if (id === 'fertilizer') {
      if (!p.crop || p.crop === 'none') {
        setModal({ open: true, title: T('tFert', {}, lang), body: `<p>${T('noneCropNote', {}, lang)}</p>`, speech: T('noneCropNote', {}, lang) });
        return;
      }
      const f = FERT_REF[p.crop];
      const html2 = `<div class="result-card"><h4>${T('fertType', {}, lang)}</h4><p>${L(f.type, lang)}</p></div>` +
        `<div class="result-card"><h4>${T('fertDose', {}, lang)}</h4><p>${L(f.dose, lang)}</p></div>` +
        `<div class="result-card"><h4>${T('fertSched', {}, lang)}</h4><p>${L(f.sched, lang)}</p></div>`;
      setModal({ open: true, title: T('fertTitle', { crop: cropName }, lang), body: html2, speech: T('fertTitle', { crop: cropName }, lang) + '. ' + L(f.type, lang) + '. ' + L(f.dose, lang) + '. ' + L(f.sched, lang) });
      return;
    }
    if (id === 'irrigation') {
      if (!p.crop || p.crop === 'none') {
        setModal({ open: true, title: T('tIrri', {}, lang), body: `<p>${T('noneCropNote', {}, lang)}</p>`, speech: T('noneCropNote', {}, lang) });
        return;
      }
      const txt = L(IRRIGATION_REF[p.crop], lang);
      setModal({ open: true, title: T('irriTitle', { crop: cropName }, lang), body: `<div class="result-card"><p>${txt}</p></div>`, speech: T('irriTitle', { crop: cropName }, lang) + '. ' + txt });
      return;
    }
    if (id === 'disease') {
      const html3 = `<p style="margin:0 0 14px; color:#5a4c3a;">${T('diseaseNote', {}, lang)}</p>` +
        `<div style="text-align:center; margin-bottom:16px;"><input type="file" accept="image/*" id="diseaseFile" style="display:none;" onChange="analyzeDisease()"><button class="btn btn-primary" onClick="document.getElementById('diseaseFile').click()">${T('uploadBtn', {}, lang)}</button></div>` +
        `<div id="diseaseResult"></div>`;
      setModal({ open: true, title: T('diseaseTitle', {}, lang), body: html3, speech: T('diseaseTitle', {}, lang) });
      return;
    }
    if (id === 'weather') {
      const wtitle = T('weatherTitle', { district: distObj ? L(distObj, lang) : '' }, lang);
      setModal({ open: true, title: wtitle, body: `<p style="color:#5a4c3a;">${T('loadingWeather', {}, lang)}</p>`, speech: '' });
      fetchLiveWeather(distObj, lang).then(w => {
        const tag = w.live ? `<span class="tag-rising" style="font-size:0.72rem;">${T('liveTag', {}, lang)}</span>` : `<span style="font-size:0.68rem; color:#8a7a63;">${w.cachedAge ? T('offlineNote', { time: w.cachedAge }, lang) : T('demoTag', {}, lang)}</span>`;
        const html4 = `<div class="result-card"><p>${T('tempLbl', {}, lang)}: ${w.temp}°C · ${T('humLbl', {}, lang)}: ${w.hum}% · ${T('rainLbl', {}, lang)}: ${w.rainMm} mm · ${T('windLbl', {}, lang)}: ${w.wind} km/h</p>` +
          `<p style="text-transform:capitalize; margin:6px 0 0;">${w.desc}</p><p style="margin:8px 0 0;">${tag}</p></div>`;
        setModal(m => ({ ...m, body: html4 }));
        speak(wtitle + '. ' + T('tempLbl', {}, lang) + ' ' + w.temp + '. ' + T('humLbl', {}, lang) + ' ' + w.hum + '. ' + w.desc);
      });
      return;
    }
    if (id === 'price') {
      if (!p.crop || p.crop === 'none') {
        setModal({ open: true, title: T('tPrice', {}, lang), body: `<p>${T('noneCropNote', {}, lang)}</p>`, speech: T('noneCropNote', {}, lang) });
        return;
      }
      const ptitle = T('priceTitle', { crop: cropName }, lang);
      setModal({ open: true, title: ptitle, body: `<p style="color:#5a4c3a;">${T('loadingPrice', {}, lang)}</p>`, speech: '' });
      fetchLiveMarketPrice(p.crop, lang).then(pr => {
        const trendKey = pr.trend === 'rising' ? 'trendRising' : (pr.trend === 'falling' ? 'trendFalling' : 'trendStable');
        const tag = pr.live ? `<span class="tag-rising" style="font-size:0.72rem;">${T('liveTag', {}, lang)}${pr.asOf ? ' · ' + T('asOfLbl', {}, lang) + ' ' + pr.asOf : ''}</span>` : `<span style="font-size:0.68rem; color:#8a7a63;">${pr.cachedAge ? T('offlineNote', { time: pr.cachedAge }, lang) : T('demoTag', {}, lang)}</span>`;
        const html5 = `<div class="result-card"><h4>₹${pr.price} ${T('perUnit', { unit: pr.unit }, lang)}</h4><p class="tag-${pr.trend}">${T(trendKey, {}, lang)}</p><p style="margin-top:6px;">${tag}</p></div>`;
        setModal(m => ({ ...m, body: html5 }));
        speak(ptitle + '. ₹' + pr.price + ' ' + T('perUnit', { unit: pr.unit }, lang) + '. ' + T(trendKey, {}, lang));
      });
      return;
    }
    if (id === 'scheme') {
      const html6 = SCHEMES.map(s => {
        const ok = s.eligible(p);
        return `<div class="result-card"><h4>${L(s.name, lang)}</h4><p>${L(s.benefit, lang)}</p><p class="${ok ? 'tag-rising' : 'tag-falling'}">${T(ok ? 'eligibleYes' : 'eligibleNo', {}, lang)}</p></div>`;
      }).join('');
      setModal({ open: true, title: T('schemeTitle', {}, lang), body: html6, speech: T('schemeTitle', {}, lang) + '. ' + SCHEMES.map(s => L(s.name, lang)).join(', ') });
      return;
    }
    if (id === 'market') {
      const mtitle = T('marketTitle', {}, lang);
      setModal({ open: true, title: mtitle, body: `<p style="color:#5a4c3a;">${T('loadingPrice', {}, lang)}</p>`, speech: '' });
      const listedCrops = [p.crop && p.crop !== 'none' ? p.crop : 'paddy', 'groundnut'].filter((c, i, arr) => arr.indexOf(c) === i);
      Promise.all(listedCrops.map(c => fetchLiveMarketPrice(c, lang))).then(prices => {
        const html7 = `<p style="margin:0 0 14px; color:#5a4c3a;">${T('marketDemo', { district: distObj ? L(distObj, lang) : '' }, lang)}</p>` +
          listedCrops.map((c, i) => {
            const cObj = CROPS.find(x => x.id === c);
            const pr = prices[i];
            const tag = pr.live ? T('liveTag', {}, lang) : (pr.cachedAge ? T('offlineNote', { time: pr.cachedAge }, lang) : T('demoTag', {}, lang));
            return `<div class="result-card"><h4>${cObj.em} ${L(cObj, lang)} — ₹${pr.price}/${pr.unit}</h4><p style="font-size:0.7rem; color:#8a7a63;">${tag}</p></div>`;
          }).join('') +
          `<div style="text-align:center; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">` +
          `<button class="btn btn-primary" onClick="alert('${T('marketSell', {}, lang)}')">${T('marketSell', {}, lang)}</button>` +
          `<a class="btn btn-ghost" style="text-decoration:none;" href="https://www.enam.gov.in" target="_blank" rel="noopener">${T('enamLinkBtn', {}, lang)}</a>` +
          `</div><p style="font-size:0.7rem; color:#8a7a63; margin-top:10px; text-align:center;">${T('enamNote', {}, lang)}</p>`;
        setModal({ ...modal, body: html7 });
        speak(mtitle);
      });
      return;
    }
    if (id === 'expert') {
      const ehtml = `<p style="margin:0 0 14px; color:#5a4c3a;">${T('expertBody', {}, lang)}</p>` +
        `<div style="text-align:center; display:flex; flex-direction:column; gap:10px;">` +
        `<a class="btn btn-primary" style="text-decoration:none; justify-content:center;" href="tel:18001801551">${T('callExpertBtn', {}, lang)}</a>` +
        `<a class="btn btn-ghost" style="text-decoration:none; justify-content:center;" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(T('whatsappExpertMsg', {}, lang))}">${T('whatsappExpertBtn', {}, lang)}</a>` +
        `</div>`;
      setModal({ open: true, title: T('expertTitle', {}, lang), body: ehtml, speech: T('expertTitle', {}, lang) + '. ' + T('expertBody', {}, lang) });
      return;
    }
    if (id === 'community') {
      const communityPosts = [];
      const newPost = prompt(T('communityPlaceholder', {}, lang));
      if (newPost) {
        communityPosts.push({ text: newPost, name: profile.name || T('farmer', {}, lang), ts: Date.now() });
        localStorage.setItem('agrisathi_community_' + (profile.district || 'general'), JSON.stringify(communityPosts.slice(-30)));
      }
      return;
    }
    if (id === 'plan') {
      if (!p.crop || p.crop === 'none') {
        setModal({ open: true, title: T('tPlan', {}, lang), body: `<p>${T('planNoSow', {}, lang)}</p>`, speech: T('planNoSow', {}, lang) });
        return;
      }
      const duration = CROP_DURATION[p.crop] || 120;
      const tasks = [
        { label: T('taskIrri', {}, lang), day: Math.min(p.sowDays + 7, duration) },
        { label: T('taskFert', {}, lang), day: Math.min(p.sowDays + 20, duration) },
        { label: T('taskPest', {}, lang), day: Math.min(p.sowDays + 35, duration) },
        { label: T('taskHarvest', {}, lang), day: duration }
      ];
      const html8 = `<p style="margin:0 0 14px; color:#5a4c3a;">${T('planSownDaysAgo', { n: p.sowDays }, lang)}</p>` +
        tasks.map(t => {
          const remaining = t.day - p.sowDays;
          const when = remaining <= 0 ? (lang === 'te' ? 'ఇప్పుడు' : 'now') : (lang === 'te' ? (remaining + ' రోజుల్లో') : ('in ' + remaining + ' days'));
          return `<div class="result-card"><h4>${t.label}</h4><p>${when}</p></div>`;
        }).join('') +
        `<div style="text-align:center; margin-top:8px;"><button id="reminderBtn" class="btn btn-ghost" style="font-size:0.82rem; padding:9px 16px;" onClick="enableReminders()">${remindersOn ? T('remindersOnBtn', {}, lang) : T('remindersOffBtn', {}, lang)}</button></div>`;
      setModal({ open: true, title: T('planTitle', { crop: cropName }, lang), body: html8, speech: T('planTitle', { crop: cropName }, lang) });
      return;
    }
  }, [profile, lang, speak, remindersOn]);

  const closeModal = useCallback(() => {
    setModal({ open: false, title: '', body: '', speech: '' });
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const isLangStep = stepIndex === 0;
  const isLoginMethodStep = stepIndex === 1;
  const isLoginDetailsStep = stepIndex === 2;
  const isChoiceStep = [3, 4, 5, 6, 7].includes(stepIndex);
  const isLandSizeStep = stepIndex === 8;
  const isSowStep = stepIndex === 9;
  const isConfirmStep = stepIndex === 10;

  let stepTitle = '', stepHint = '';
  if (isLangStep) { stepTitle = T('langTitle', {}, lang); stepHint = T('langHint', {}, lang); }
  else if (isLoginMethodStep) { stepTitle = T('loginTitle', {}, lang); stepHint = T('loginHint', {}, lang); }
  else if (isLoginDetailsStep) { stepTitle = profile.loginMethod === 'face' ? T('faceTitle', {}, lang) : T('userTitle', {}, lang); stepHint = profile.loginMethod === 'face' ? T('faceHint', {}, lang) : T('userLabel', {}, lang); }
  else if (isChoiceStep) {
    const keys = ['askDistrict', 'askSoil', 'askSeason', 'askWater', 'askCrop'];
    const idx = stepIndex - 3;
    stepTitle = T(keys[idx], {}, lang);
  }
  else if (isLandSizeStep) { stepTitle = T('landTitle', {}, lang); stepHint = T('landHint', {}, lang); }
  else if (isSowStep) { stepTitle = T('sowTitle', {}, lang); stepHint = T('sowHint', {}, lang); }
  else if (isConfirmStep) { stepTitle = T('confirmTitle', {}, lang); stepHint = T('confirmHint', {}, lang); }

  return (
    <div className="grain-bg">
      <Header lang={lang} switchLang={switchLang} openApp={openApp} />

      <main id="top">
        <Hero openApp={openApp} />
        <ProblemSection />
        <ServicesSection />
        <FlowSection />
        <PlannerSection />
        <AccessibilitySection />
      </main>

      <footer>
        <div className="wrap">
          <div className="footer-top">
            <div>
              <h2>Starting in Andhra Pradesh. Built to travel further.</h2>
              <p>AgriSathi is designed first for Telugu-speaking farmers, with a voice and icon framework built to extend to other Indian states and regional languages as it grows.</p>
              <div className="scale-badges">
                <span className="badge now">Andhra Pradesh · Telugu — live focus</span>
                <span className="badge">Next states — planned</span>
                <span className="badge">More regional languages — planned</span>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => { setShowBubble(true); setTimeout(() => setShowBubble(false), 4500); }}>Try the voice demo</button>
          </div>
          <div className="foot-bottom">
            <span>AgriSathi — One Platform for Every Farmer's Need</span>
            <span>Concept front end · not a live agricultural advisory service</span>
          </div>
        </div>
      </footer>

      {overlayOpen && (
        <div className="app-overlay open">
          <div className="app-topbar">
            <span className="mono" style={{ fontWeight: 700 }}>AgriSathi</span>
            <button className="close-app" onClick={closeApp} aria-label="Close">✕</button>
          </div>

          {!loggedIn && (
            <div className="app-body">
              <div className="wiz-progress">{(stepIndex + 1)} / {steps.length}</div>
              <div>
                {isLangStep && (
                  <>
                    <h2 className="wiz-title">{T('langTitle', {}, lang)}</h2>
                    <p className="wiz-sub">{T('langHint', {}, lang)}</p>
                    <div className="choice-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <button className="choice-tile" onClick={() => { switchLang('en'); goNext(); }}><span className="em">🇬🇧</span><span>English</span></button>
                      <button className="choice-tile" onClick={() => { switchLang('te'); goNext(); }}><span className="em">🇮🇳</span><span>తెలుగు</span></button>
                    </div>
                  </>
                )}
                {isLoginMethodStep && (
                  <>
                    <h2 className="wiz-title">{T('loginTitle', {}, lang)}</h2>
                    <p className="wiz-sub">{T('loginHint', {}, lang)}</p>
                    <div className="choice-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <button className="choice-tile" onClick={() => pickLoginMethod('face')}><span className="em">🙂</span><span>{T('loginFace', {}, lang)}</span></button>
                      <button className="choice-tile" onClick={() => pickLoginMethod('pass')}><span className="em">⌨️</span><span>{T('loginPass', {}, lang)}</span></button>
                    </div>
                  </>
                )}
                {isLoginDetailsStep && (
                  <>
                    <h2 className="wiz-title">{profile.loginMethod === 'face' ? T('faceTitle', {}, lang) : T('userTitle', {}, lang)}</h2>
                    <p className="wiz-sub">{profile.loginMethod === 'face' ? T('faceHint', {}, lang) : T('userLabel', {}, lang)}</p>
                    {profile.loginMethod === 'face' ? (
                      <>
                        <div className="face-box">🙂</div>
                        <div style={{ textAlign: 'center', marginBottom: 20 }}><button className="btn btn-primary" onClick={doFaceCapture}>{T('faceCapture', {}, lang)}</button></div>
                      </>
                    ) : (
                      <>
                        <input className="simple-input" placeholder={T('userLabel', {}, lang)} />
                        <input className="simple-input" type="password" placeholder={T('passLabel', {}, lang)} />
                        <div style={{ textAlign: 'center', marginBottom: 16 }}><button className="btn btn-primary" onClick={goNext}>{T('loginBtn', {}, lang)}</button></div>
                      </>
                    )}
                  </>
                )}
                {isChoiceStep && (() => {
                  const fields = ['district', 'soil', 'season', 'water', 'crop'];
                  const keys = ['askDistrict', 'askSoil', 'askSeason', 'askWater', 'askCrop'];
                  const opts = [AP_DISTRICTS, SOILS, SEASONS, WATER, CROPS];
                  const idx = stepIndex - 3;
                  return (
                    <>
                      <h2 className="wiz-title">{T(keys[idx], {}, lang)}</h2>
                      <div className="choice-grid">
                        {opts[idx].map(o => (
                          <button key={o.id} className={'choice-tile' + (profile[fields[idx]] === o.id ? ' selected' : '')} onClick={() => pickChoice(fields[idx], o.id, opts[idx])}>
                            <span className="em">{o.em || '📍'}</span>
                            <span>{L(o, lang)}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}
                {isLandSizeStep && (
                  <>
                    <h2 className="wiz-title">{T('landTitle', {}, lang)}</h2>
                    <p className="wiz-sub">{T('landHint', {}, lang)}</p>
                    <div className="stepper">
                      <button onClick={() => landStep(-1)}>−</button>
                      <span className="val">{landSize} {lang === 'te' ? 'ఎకరాలు' : 'acres'}</span>
                      <button onClick={() => landStep(1)}>+</button>
                    </div>
                    <div style={{ textAlign: 'center', marginBottom: 14 }}><button className="btn btn-primary" onClick={() => { setProfile(p => ({ ...p, landSize })); goNext(); }}>{T('confirmBtn', {}, lang)}</button></div>
                  </>
                )}
                {isSowStep && (
                  <>
                    <h2 className="wiz-title">{T('sowTitle', {}, lang)}</h2>
                    <p className="wiz-sub">{T('sowHint', {}, lang)}</p>
                    <div className="stepper">
                      <button onClick={() => sowStep(-5)}>−</button>
                      <span className="val">{sowDays}</span>
                      <button onClick={() => sowStep(5)}>+</button>
                    </div>
                    <div style={{ textAlign: 'center', marginBottom: 14 }}><button className="btn btn-primary" onClick={() => { setProfile(p => ({ ...p, sowDays })); goNext(); }}>{T('confirmBtn', {}, lang)}</button></div>
                  </>
                )}
                {isConfirmStep && (() => {
                  const p = profile;
                  const dist = AP_DISTRICTS.find(d => d.id === p.district);
                  const soil = SOILS.find(d => d.id === p.soil);
                  const season = SEASONS.find(d => d.id === p.season);
                  const water = WATER.find(d => d.id === p.water);
                  const crop = CROPS.find(d => d.id === p.crop);
                  const unit = lang === 'te' ? ' ఎకరాలు' : ' acres';
                  const rows = [
                    [T('fDistrict', {}, lang), dist ? L(dist, lang) : '—'],
                    [T('fSoil', {}, lang), soil ? L(soil, lang) : '—'],
                    [T('fSeason', {}, lang), season ? L(season, lang) : '—'],
                    [T('fWater', {}, lang), water ? L(water, lang) : '—'],
                    [T('fCrop', {}, lang), crop ? L(crop, lang) : '—'],
                    [T('fLand', {}, lang), p.landSize + unit]
                  ];
                  if (p.crop && p.crop !== 'none') rows.push([T('fSow', {}, lang), p.sowDays]);
                  return (
                    <>
                      <h2 className="wiz-title">{T('confirmTitle', {}, lang)}</h2>
                      <p className="wiz-sub">{T('confirmHint', {}, lang)}</p>
                      <ul className="confirm-list">
                        {rows.map((r, i) => (
                          <li key={i}><span>{r[0]}</span><span>{r[1]}</span></li>
                        ))}
                      </ul>
                      <div style={{ textAlign: 'center' }}><button className="btn btn-primary" onClick={finishOnboarding}>{T('confirmBtn', {}, lang)}</button></div>
                    </>
                  );
                })()}
                <div className="wiz-nav">
                  <button className="btn btn-ghost" onClick={goBack}>{T('back', {}, lang)}</button>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          {loggedIn && (
            <div className="app-body">
              <div className="dash-header">
                <h2>{T('greeting', { name: profile.name || T('farmer', {}, lang) }, lang)}</h2>
                <p>{T('dashHint', {}, lang)}</p>
                <button className="btn btn-ghost" onClick={doLogout} style={{ marginTop: 14, padding: '7px 18px', fontSize: '0.75rem' }}>{T('startOver', {}, lang)}</button>
              </div>
              <div className="dash-profile-strip">
                {(() => {
                  const dist = AP_DISTRICTS.find(d => d.id === profile.district);
                  const soil = SOILS.find(d => d.id === profile.soil);
                  const crop = CROPS.find(d => d.id === profile.crop);
                  const unit = lang === 'te' ? ' ఎకరాలు' : ' ac';
                  const chips = [dist ? L(dist, lang) : '', soil ? L(soil, lang) : '', profile.landSize + unit, crop ? L(crop, lang) : ''].filter(Boolean);
                  return chips.map((c, i) => <span key={i} className="chip">{c}</span>);
                })()}
              </div>
              {profile.crop && profile.crop !== 'none' && (
                <div className="dash-notif">
                  <span>🔔</span>
                  <span>{T('notif', { crop: L(CROPS.find(c => c.id === profile.crop), lang) }, lang)}</span>
                </div>
              )}
              <div className="dash-tiles">
                {TILES.map(t => (
                  <div key={t.id} className="dash-tile" onClick={() => openService(t.id)}>
                    <span className="em">{t.em}</span>
                    <span className="lbl">{T(t.key, {}, lang)}</span>
                    <span className="hint">{T(t.hint, {}, lang)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {modal.open && (
        <div className="svc-modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="svc-modal">
            <div className="svc-modal-head">
              <h2>{modal.title}</h2>
              <button onClick={closeModal} aria-label="Close">✕</button>
            </div>
            <button className="speaker" onClick={() => speak(modal.speech)} aria-label="Listen">🔊</button>
            <div dangerouslySetInnerHTML={{ __html: modal.body }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;