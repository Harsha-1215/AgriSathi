const accessItems = [
  { title: 'Facial-recognition login', desc: 'No usernames, no passwords — a farmer\'s face is their key.' },
  { title: 'Voice in the regional language', desc: 'Every service can be asked for and heard back, spoken and understood natively.' },
  { title: 'Icon-first navigation', desc: 'Every service is a picture before it\'s a word, so recognition doesn\'t depend on reading.' }
];

export default function AccessibilitySection() {
  return (
    <section style={{ background: 'var(--cream-deep)' }}>
      <div className="wrap">
        <div className="section-head">
          <span className="kicker">Built to be used by everyone</span>
          <h2>Designed around the farmer who has never used an app before.</h2>
          <p>Every design decision starts from the same question: does this still work for someone who can't read the screen?</p>
        </div>
        <div className="access-grid">
          {accessItems.map((item, i) => (
            <div key={i} className="access-card">
              <div className="access-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#2B2118" strokeWidth="1.8">
                  <path d={['M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z', 'M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm5-4a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z', 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4'][i]} />
                </svg>
              </div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}