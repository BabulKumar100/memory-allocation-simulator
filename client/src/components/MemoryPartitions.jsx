import { HardDrive, Plus, Trash2 } from "lucide-react";

// Sirf contiguous mode me dikhta hai: yahan memory pehle se named partitions me
// bati hui hoti hai (variable partitioning).
export default function MemoryPartitions({ blocks, input, onInput, onAdd, onRemove, max }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <HardDrive size={18}/><h2>Memory Partitions</h2>
        <span className="count-pill">{blocks.length} blocks</span>
      </div>
      <form className="add-row" onSubmit={event => { event.preventDefault(); onAdd(); }}>
        <input
          aria-label="Memory block size in KB"
          type="number"
          min="1"
          value={input}
          onChange={event => onInput(event.target.value)}
          placeholder="Size (KB)"
        />
        <button className="square-add" type="submit" aria-label="Add memory block"><Plus size={19}/></button>
      </form>
      <div className="partition-list">
        {blocks.map(block => (
          <button className="partition-chip" key={block.id} onClick={() => onRemove(block.id)} title="Click to remove">
            <span>{block.id}</span><b>{block.size} KB</b><Trash2 size={12}/>
          </button>
        ))}
        {!blocks.length && <p className="empty-note">No memory blocks added yet.</p>}
      </div>
      <p className="hint">Click a block chip to remove it. Maximum {max} blocks.</p>
    </section>
  );
}
