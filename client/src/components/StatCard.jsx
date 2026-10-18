export default function StatCard({ label, value, sub, icon, tone = "cyan" }) {
  return <div className={`stat-card ${tone}`}>
    <div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div>
    <strong>{value}</strong><small>{sub}</small>
  </div>;
}