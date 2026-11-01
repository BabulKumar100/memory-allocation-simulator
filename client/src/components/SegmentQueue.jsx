import { useState } from "react";
import { Layers, Plus, RotateCcw, Trash2 } from "lucide-react";

// Segmentation mode me queue flat rows ki ordered list hai, kyunki operations ka
// order matter karta hai:
//   alloc row   -> { type: "alloc", processId, segment, size }
//   release row -> { type: "release", processId }
// Engine ko yeh rows grouped operations me badal kar bheje jate hain (dekhein App.jsx).
export default function SegmentQueue({ rows, segmentNames, maxSegments, maxProcesses, onAdd, onAddRelease, onRemove }) {
  const [processId, setProcessId] = useState("");
  const [segment, setSegment] = useState(segmentNames[0]);
  const [size, setSize] = useState("");
  const [releaseTarget, setReleaseTarget] = useState("");
  const [error, setError] = useState("");

  // Release sirf un processes par lag sakta hai jinke segments queue me hain.
  const processIds = [...new Set(rows.filter(row => row.type === "alloc").map(row => row.processId))];

  function submitSegment(event) {
    event.preventDefault();
    const id = processId.trim().toUpperCase();
    const value = Number(size);
    if (!id) return setError("Enter a process ID, for example P1.");
    if (!Number.isFinite(value) || value <= 0) return setError("Enter a segment size greater than 0 KB.");
    if (!rows.some(row => row.processId === id) && processIds.length >= maxProcesses) {
      return setError(`Maximum ${maxProcesses} processes allowed.`);
    }
    const owned = rows.filter(row => row.type === "alloc" && row.processId === id).length;
    if (owned >= maxSegments) return setError(`${id} already has ${maxSegments} segments.`);

    setError("");
    onAdd({ processId: id, segment, size: value });
    setProcessId(id);
    setSize("");
  }

  function submitRelease(event) {
    event.preventDefault();
    const target = releaseTarget || processIds[0];
    if (!target) return setError("Nothing to release yet — add a segment first.");
    setError("");
    onAddRelease(target);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <Layers size={18}/><h2>Segment Queue</h2>
        <span className="count-pill">{rows.length} operations</span>
      </div>

      <form className="add-row segmented" onSubmit={submitSegment}>
        <input aria-label="Process ID" className="short-input" value={processId} onChange={event => setProcessId(event.target.value)} placeholder="P1"/>
        <select aria-label="Segment name" value={segment} onChange={event => setSegment(event.target.value)}>
          {segmentNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <input aria-label="Segment size in KB" type="number" min="1" value={size} onChange={event => setSize(event.target.value)} placeholder="Size (KB)"/>
        <button className="square-add" type="submit" aria-label="Add segment"><Plus size={19}/></button>
      </form>

      <form className="add-row release-row" onSubmit={submitRelease}>
        <select aria-label="Process to release" value={releaseTarget} onChange={event => setReleaseTarget(event.target.value)} disabled={!processIds.length}>
          {!processIds.length && <option value="">No process yet</option>}
          {processIds.map(id => <option key={id} value={id}>Release {id}</option>)}
        </select>
        <button className="btn btn-secondary small-btn" type="submit" disabled={!processIds.length}><RotateCcw size={14}/>Add release</button>
      </form>

      {error && <p className="hint warn-text">{error}</p>}

      <div className="item-list">
        {rows.map(row => (
          <div className={`queue-item ${row.type}`} key={row.key}>
            {row.type === "release" ? <>
              <span className="op-badge free">FREE</span>
              <strong>{row.processId}</strong>
              <span className="segment-note">release operation</span>
            </> : <>
              <span className="status-dot"/>
              <strong>{row.processId}</strong>
              <span className="segment-name">{row.segment}</span>
              <b>{row.size} KB</b>
            </>}
            <button className="delete-button" aria-label="Remove row" onClick={() => onRemove(row.key)}><Trash2 size={15}/></button>
          </div>
        ))}
        {!rows.length && <p className="empty-note">No segments queued yet.</p>}
      </div>

      <p className="hint">Rows run in order. Add a release row to free a process and create holes — that is where external fragmentation and compaction become visible. Max {maxSegments} segments per process.</p>
    </section>
  );
}
