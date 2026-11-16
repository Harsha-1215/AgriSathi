const tasks = [
  { color: '#1F4E5F', title: 'Irrigation check', desc: 'Due tomorrow — soil moisture running low' },
  { color: '#B87A18', title: 'Second fertilizer dose', desc: 'In 4 days — urea top-dressing stage' },
  { color: '#B23A1F', title: 'Pest inspection', desc: 'In 6 days — bollworm risk window opens' },
  { color: '#375A2C', title: 'Harvest window opens', desc: 'In 14 weeks — estimated from sowing date' }
];

export default function PlannerSection() {
  return (
    <section>
      <div className="wrap planner">
        <div>
          <span className="eyebrow"><span className="dot"></span> Farm Task Planner</span>
          <h2 style={{ fontSize: '2rem', margin: '0 0 16px' }}>Reminders that build themselves from your crop and sowing date.</h2>
          <p style={{ fontSize: '1rem', lineHeight: '1.6', color: '#4a3d2e' }}>Once a farmer selects their crop and the date they sowed it, AgriSathi automatically schedules the season ahead — irrigation, fertilization, pest inspection, and harvesting — and reminds the farmer by voice when each task is due.</p>
        </div>
        <div className="planner-card">
          <div className="cal-head"><span>COTTON · SOWN 12 JUN</span><span>WEEK 6</span></div>
          {tasks.map((task, i) => (
            <div key={i} className="task-row">
              <span className="task-dot" style={{ background: task.color }}></span>
              <div>
                <div className="t">{task.title}</div>
                <div className="d">{task.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}