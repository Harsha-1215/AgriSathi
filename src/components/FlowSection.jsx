const steps = [
  { num: '1', title: 'Look, don\'t type', desc: 'Facial recognition logs the farmer in — no password to remember or type.' },
  { num: '2', title: 'Speak the question', desc: 'The farmer taps the mic and asks in their regional language, naturally.' },
  { num: '3', title: 'AI understands and finds it', desc: 'The assistant matches the question to the right service — crop, price, weather, or scheme.' },
  { num: '4', title: 'Answer, spoken and shown', desc: 'The response is read aloud and shown as simple icons, so it\'s confirmed two ways.' }
];

export default function FlowSection() {
  return (
    <section className="flow">
      <div className="wrap">
        <div className="section-head">
          <span className="kicker">How a question gets answered</span>
          <h2>No typing. No menus to decode.</h2>
          <p>The interaction is built around speech and recognition from the very first step.</p>
        </div>
        <div className="flow-steps">
          {steps.map((step, i) => (
            <div key={i} className="flow-step">
              <div className="flow-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}