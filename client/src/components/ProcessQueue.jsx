import { Activity, Plus, Trash2 } from "lucide-react";

// Contiguous aur paging dono modes me same process queue use hoti hai
// (process ka ek hi size hota hai - page count engine khud nikalta hai).
export default function ProcessQueue({ processes, input, onInput, onAdd, onRemove, max }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <Activity size={18}/><h2>Process Queue</h2>
        <span className="count-pill">{processes.length} items</span>
      </div>
      <form className="add-row" onSubmit={event => { event.preventDefault(); onAdd(); }}>
        <input
          aria-label="Process size in KB"
          type="number"
          min="1"
          value={input}
          onChange={event => onInput(event.target.value)}
          placeholder="Size (KB)"
        />
        <button className="square-add" type="submit" aria-label="Add process"><Plus size={19}/></button>
      </form>
      <div className="item-list">
        {processes.map(process => (
          <div className="queue-item" key={process.id}>
            <span className="status-dot"/><strong>{process.id}</strong><b>{process.size} KB</b>
            <button className="delete-button" aria-label={`Remove ${process.id}`} onClick={() => onRemove(process.id)}>
              <Trash2 size={15}/>
            </button>
          </div>
        ))}
        {!processes.length && <p className="empty-note">No processes added yet.</p>}
      </div>
      <p className="hint">Maximum {max} processes.</p>
    </section>
  );
}
