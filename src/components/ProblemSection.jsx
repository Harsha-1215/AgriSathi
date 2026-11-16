export default function ProblemSection() {
  const cards = [
    { title: 'Information exists, but arrives too late', desc: 'Crop advice, weather shifts, and price movements matter most in the moment — not buried in a report a farmer has to read and interpret alone.' },
    { title: 'Text-first apps exclude by design', desc: 'Menus, forms, and typed search assume comfort with reading and typing — a real barrier for illiterate and semi-literate users, not a small one.' },
    { title: 'Login itself is a wall', desc: 'Remembering passwords or typing usernames stops adoption before a farmer ever reaches the tools meant to help them.' }
  ];

  return (
    <section className="problem">
      <div className="wrap">
        <div className="section-head">
          <span className="kicker">The gap AgriSathi closes</span>
          <h2>Most farm apps assume you can read a menu and type a search.</h2>
          <p>Andhra Pradesh's rural economy runs on agriculture, yet the digital tools meant to serve it quietly leave out the farmers who can't read, write, or navigate a typical smartphone screen.</p>
        </div>
        <div className="problem-grid">
          {cards.map((card, i) => (
            <div key={i} className="problem-card">
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}