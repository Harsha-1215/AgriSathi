const services = [
  { title: 'Crop recommendation', desc: 'Suggests suitable crops for the farmer\'s land and season, spoken in plain language.', bg: '#E8F0E4' },
  { title: 'Fertilizer guidance', desc: 'Tells farmers what to apply and when, matched to crop stage and soil needs.', bg: '#FBEFD9' },
  { title: 'Smart irrigation advice', desc: 'Recommends when and how much to water, reducing both waste and crop stress.', bg: '#DFEAF0' },
  { title: 'Plant disease detection', desc: 'Farmers photograph a leaf; the system identifies the disease and suggests treatment.', bg: '#F4DFD8' },
  { title: 'Live weather forecasting', desc: 'Local, timely forecasts to plan sowing, spraying, and harvest around the sky.', bg: '#DFEAF0' },
  { title: 'Market price tracking', desc: 'Live mandi prices so farmers know what their harvest is worth before they sell.', bg: '#E8F0E4' },
  { title: 'Government schemes', desc: 'Surfaces welfare schemes the farmer qualifies for, explained in their own language.', bg: '#FBEFD9' },
  { title: 'Agricultural marketplace', desc: 'A place to buy seeds and equipment, and sell produce directly, within the same app.', bg: '#F4DFD8' },
  { title: 'AI conversational assistant', desc: 'Answers open questions by voice, in the farmer\'s regional language, any time.', bg: '#DFEAF0' }
];

export default function ServicesSection() {
  return (
    <section id="services">
      <div className="wrap">
        <div className="section-head">
          <span className="kicker">One portal, every service</span>
          <h2>Everything a farming season needs, in one place.</h2>
          <p>AgriSathi brings together the tools farmers currently have to chase across offices, agents, and word of mouth.</p>
        </div>
        <div className="services-grid">
          {services.map((svc, i) => (
            <div key={i} className="service-card">
              <div className="service-icon" style={{ background: svc.bg }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={['#375A2C', '#B87A18', '#1F4E5F', '#B23A1F', '#1F4E5F', '#375A2C', '#375A2C', '#B23A1F', '#1F4E5F'][i]} strokeWidth="1.8">
                  <path d={['M12 21V9M12 9C12 5 8 4 5 4c0 4 2 6 7 5zM12 9c0-4 4-5 7-5 0 4-2 6-7 5z', 'M12 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z', 'M12 2s6 7 6 12a6 6 0 01-12 0c0-5 6-12 6-12z', 'M12 2s6 7 6 12a6 6 0 01-12 0c0-5 6-12 6-12z', 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4', 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4', 'M4 19V9l8-5 8 5v10M9 19v-6h6v6', 'M4 8h16M4 8l1 11h14l1-11M9 8V5h6v3', 'M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm5-4a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z'][i]} />
                </svg>
              </div>
              <h3>{svc.title}</h3>
              <p>{svc.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}