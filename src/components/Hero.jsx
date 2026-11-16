import { useState } from 'react';

export default function Hero({ openApp }) {
  const [showBubble, setShowBubble] = useState(false);

  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          <span className="eyebrow"><span className="dot"></span> Voice-first · Icon-led · Built for Andhra Pradesh</span>
          <h1 className="hero-title">Speak your question.<br />AgriSathi answers <em>out loud.</em></h1>
          <p className="hero-sub">A single portal for crop advice, fertilizer guidance, irrigation planning, disease detection, market prices, weather, and government schemes — accessible entirely by voice and simple icons, so literacy is never a barrier.</p>
          <div className="hero-ctas">
            <button className="btn btn-primary" onClick={openApp}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
              Login & get my farm plan
            </button>
            <button className="btn btn-ghost" onClick={() => { setShowBubble(true); setTimeout(() => setShowBubble(false), 4500); }}>Try the voice demo</button>
            <button className="btn btn-ghost" onClick={() => document.getElementById('services')?.scrollIntoView()}>See every service</button>
          </div>
        </div>

        <div className="phone">
          <div className="phone-notch"></div>
          <div className="phone-greet">
            <span className="who">Namaskaram, Rama garu</span>
            <div className="sub">Tap an icon, or just speak</div>
          </div>
          <div className="icon-grid">
            {['Crop', 'Fertilizer', 'Irrigation', 'Disease', 'Weather', 'Market'].map((svc, i) => (
              <div key={svc} className="icon-tile" tabIndex={0}>
                <svg viewBox="0 0 24 24" fill="none" stroke={['#375A2C', '#B87A18', '#1F4E5F', '#B23A1F', '#1F4E5F', '#375A2C'][i]} strokeWidth="1.8">
                  <path d={['M12 21V9M12 9C12 5 8 4 5 4c0 4 2 6 7 5zM12 9c0-4 4-5 7-5 0 4-2 6-7 5z', 'M12 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z', 'M12 2s6 7 6 12a6 6 0 01-12 0c0-5 6-12 6-12z', 'M12 2s6 7 6 12a6 6 0 01-12 0c0-5 6-12 6-12z', 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4', 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4'][i]} />
                </svg>
                <span className="lbl">{svc}</span>
              </div>
            ))}
          </div>
          <div className="mic-row">
            <button className="mic-btn" onClick={() => { setShowBubble(true); setTimeout(() => setShowBubble(false), 4500); }} aria-label="Try voice assistant">
              <span className="mic-pulse"></span>
              <span className="mic-pulse p2"></span>
              <svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm5-4a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"/></svg>
            </button>
            <span className="mic-caption">Tap and speak in your language</span>
            <div className={'speech-bubble ' + (showBubble ? 'show' : '')} id="bubble">
              <span className="q">You asked:</span>
              <span>"What fertilizer for my cotton crop this week?"</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}