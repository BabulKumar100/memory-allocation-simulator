import { useState } from "react";
import { MemoryStick, Settings2, Activity, HardDrive, Gauge, Layers, Play, RotateCcw, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Terminal, Download, TrendingUp } from "lucide-react";
import { runSimulation } from "./services/api.js";
import { defaultBlocks, defaultProcesses } from "./algorithms/defaultData.js";
import MemoryMap from "./components/MemoryMap.jsx";
import StatCard from "./components/StatCard.jsx";
import Logo from "./components/Logo.jsx";
import { formatTime, exportCSV } from "./services/helpers.js";
import { LIMITS, ALGORITHM_LABELS } from "@shared/allocation.js";

const algorithms = Object.entries(ALGORITHM_LABELS).map(([id, label]) => ({ id, label }));

export default function App() {
  const [algorithm, setAlgorithm] = useState("firstFit");
  const [blocks, setBlocks] = useState(defaultBlocks);
  const [processes, setProcesses] = useState(defaultProcesses);
  const [blockInput, setBlockInput] = useState("");
  const [processInput, setProcessInput] = useState("");
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState([{ time: formatTime(), text: "System ready. Add processes/partitions or click Start.", type: "info" }]);
  const [error, setError] = useState("");

  const totalMemory = blocks.reduce((sum, b) => sum + b.size, 0);
  const current = result?.steps?.[step] || null;
  const done = Boolean(result && step >= result.steps.length - 1);
  const addLog = (text, type = "info") => setLogs(old => [{ time: formatTime(), text, type }, ...old].slice(0, 30));

  function addProcess() {
    const size = Number(processInput);
    if (!Number.isFinite(size) || size <= 0) return setError("Enter a valid process size greater than 0 KB.");
    if (processes.length >= LIMITS.maxProcesses) return setError(`Maximum ${LIMITS.maxProcesses} processes allowed.`);
    setProcesses(old => [...old, { id: `P${old.length + 1}`, size }]);
    setProcessInput(""); setError(""); setResult(null);
    addLog(`Added process of ${size} KB.`);
  }
  function addBlock() {
    const size = Number(blockInput);
    if (!Number.isFinite(size) || size <= 0) return setError("Enter a valid partition size greater than 0 KB.");
    if (blocks.length >= LIMITS.maxBlocks) return setError(`Maximum ${LIMITS.maxBlocks} memory blocks allowed.`);
    setBlocks(old => [...old, { id: `Block ${old.length + 1}`, size }]);
    setBlockInput(""); setError(""); setResult(null);
    addLog(`Added memory block of ${size} KB.`);
  }
  function removeProcess(id) {
    setProcesses(old => old.filter(p => p.id !== id).map((p, i) => ({ ...p, id: `P${i + 1}` })));
    setResult(null); setError("");
  }
  function removeBlock(id) {
    setBlocks(old => old.filter(b => b.id !== id).map((b, i) => ({ ...b, id: `Block ${i + 1}` })));
    setResult(null); setError("");
  }
  async function start() {
    if (!blocks.length || !processes.length) return setError("Add at least one memory block and one process.");
    setBusy(true); setError("");
    try {
      const data = await runSimulation({ algorithm, blocks, processes });
      setResult(data); setStep(0);
      addLog(`${algorithms.find(a => a.id === algorithm)?.label} simulation started.`, "success");
    } catch (e) {
      setError(e.message || "Simulation failed.");
      addLog("Could not reach API. Start the backend or check VITE_API_URL.", "error");
    } finally { setBusy(false); }
  }
  function reset() {
    setResult(null); setStep(0); setError("");
    addLog("Simulation reset.");
  }
  function changeAlgorithm(id) {
    setAlgorithm(id); setResult(null); setStep(0);
  }
  const active = current || result?.steps?.[0];
  const metrics = current?.metrics || result?.summary || null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Logo size={26}/></div>
          <div><h1>Memory Allocator</h1><p>Simulate OS memory management algorithms efficiently.</p></div>
        </div>
        <nav className="algorithm-tabs" aria-label="Allocation algorithm">
          {algorithms.map(item => <button key={item.id} className={algorithm === item.id ? "tab active" : "tab"} onClick={() => changeAlgorithm(item.id)}>{item.label}</button>)}
        </nav>
      </header>

      <div className="dashboard">
        <aside className="left-column">
          <section className="panel control-panel">
            <div className="panel-heading"><Settings2 size={18}/><h2>Simulation Control</h2><span className="pill">Interactive</span></div>
            <div className="button-row">
              <button className="btn btn-primary" onClick={start} disabled={busy}><Play size={15} fill="currentColor"/>{busy ? "Running..." : "Start"}</button>
              <button className="btn btn-secondary" onClick={reset}><RotateCcw size={15}/>Reset</button>
            </div>
            {error && <div className="error-message"><AlertCircle size={15}/>{error}</div>}
            {result && <div className="step-controls">
              <button className="icon-button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}><ChevronLeft size={17}/></button>
              <span>Step {Math.min(step + 1, result.steps.length)} / {result.steps.length}</span>
              <button className="icon-button" onClick={() => setStep(s => Math.min(result.steps.length - 1, s + 1))} disabled={done}><ChevronRight size={17}/></button>
              <button className="text-button" onClick={() => setStep(result.steps.length - 1)}>Finish</button>
            </div>}
          </section>

          <section className="panel">
            <div className="panel-heading"><Activity size={18}/><h2>Process Queue</h2><span className="count-pill">{processes.length} items</span></div>
            <form className="add-row" onSubmit={e => { e.preventDefault(); addProcess(); }}>
              <input aria-label="Process size in KB" type="number" min="1" value={processInput} onChange={e => setProcessInput(e.target.value)} placeholder="Size (KB)"/>
              <button className="square-add" type="submit" aria-label="Add process"><Plus size={19}/></button>
            </form>
            <div className="item-list">
              {processes.map(p => <div className="queue-item" key={p.id}>
                <span className="status-dot"/><strong>{p.id}</strong><b>{p.size} KB</b>
                <button className="delete-button" aria-label={`Remove ${p.id}`} onClick={() => removeProcess(p.id)}><Trash2 size={15}/></button>
              </div>)}
              {!processes.length && <p className="empty-note">No processes added yet.</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading"><HardDrive size={18}/><h2>Memory Partitions</h2><span className="count-pill">{blocks.length} blocks</span></div>
            <form className="add-row" onSubmit={e => { e.preventDefault(); addBlock(); }}>
              <input aria-label="Memory block size in KB" type="number" min="1" value={blockInput} onChange={e => setBlockInput(e.target.value)} placeholder="Size (KB)"/>
              <button className="square-add" type="submit" aria-label="Add memory block"><Plus size={19}/></button>
            </form>
            <div className="partition-list">
              {blocks.map((b, i) => <button className="partition-chip" key={b.id} onClick={() => removeBlock(b.id)} title="Click to remove">
                <span>{b.id}</span><b>{b.size} KB</b><Trash2 size={12}/>
              </button>)}
              {!blocks.length && <p className="empty-note">No memory blocks added yet.</p>}
            </div>
            <p className="hint">Click a block chip to remove it.</p>
          </section>
        </aside>

        <section className="right-column">
          <section className="panel visualization-panel">
            <div className="panel-heading visualization-heading">
              <div className="heading-title"><MemoryStick size={18}/><h2>Memory Visualization</h2></div>
              <div className="legend">
                <span><i className="legend-empty"/>Empty</span>
                <span><i className="legend-allocated"/>Allocated</span>
                <span><i className="legend-remaining"/>Free / Remaining</span>
              </div>
            </div>
            <div className="memory-area">
              <MemoryMap blocks={blocks} step={current} totalMemory={totalMemory}/>
            </div>
            <div className="memory-footer">
              <span className="model-note">Variable partitioning — a block's leftover space stays available for later processes.</span>
              <span>Total Memory: <b>{totalMemory} KB</b></span>
            </div>
          </section>

          <section className="stats-grid">
            <StatCard label="Allocated Processes" value={metrics ? `${metrics.allocatedProcesses}/${metrics.processedProcesses}` : "—"} sub="Successfully placed in memory" icon={<CheckCircle2 size={17}/>} tone="cyan"/>
            <StatCard label="Allocation Success Rate" value={metrics ? `${metrics.successRate}%` : "—"} sub={metrics ? `${metrics.failedProcesses.length} process(es) failed` : "Allocated / processed"} icon={<TrendingUp size={17}/>} tone="green"/>
            <StatCard label="Memory Utilization" value={metrics ? `${metrics.utilization}%` : "—"} sub="Allocated / total memory" icon={<Gauge size={17}/>} tone="purple"/>
            <StatCard label="Free Memory" value={metrics ? `${metrics.freeMemory} KB` : "—"} sub="Still available for allocation" icon={<HardDrive size={17}/>} tone="blue"/>
          </section>

          {metrics?.failedProcesses?.length > 0 && <section className="panel failed-panel">
            <div className="panel-heading"><AlertCircle size={18}/><h2>Failed Processes</h2><span className="count-pill">{metrics.failedProcesses.length} failed</span></div>
            <div className="failed-list">
              {metrics.failedProcesses.map(item => {
                const row = (current?.allocations || result?.allocations || []).find(a => a.processId === item.processId);
                return <div className="failed-item" key={item.processId}>
                  <span className="failed-id">{item.processId}</span>
                  <span className="failed-size">needs {item.processSize} KB</span>
                  <span className="failed-reason">largest free block at that time: {row?.largestFreeBlock ?? "—"} KB</span>
                </div>;
              })}
            </div>
            <p className="hint">No single block had enough contiguous free space for these processes.</p>
          </section>}

          <section className="logs-panel">
            <div className="logs-heading"><span><Terminal size={14}/>System Logs</span><div><span className="live-dot"/>Live Output</div></div>
            <div className="logs-list">
              {logs.map((log, i) => <div className={`log-line ${log.type}`} key={`${log.time}-${i}`}><time>[{log.time}]</time><span>{log.text}</span></div>)}
            </div>
          </section>

          {result && <section className="panel results-panel">
            <div className="panel-heading"><Layers size={18}/><h2>Allocation Results</h2><button className="export-button" onClick={() => exportCSV(result)}><Download size={14}/>Export CSV</button></div>
            <div className="table-wrap"><table><thead><tr><th>Process</th><th>Size</th><th>Allocated Block</th><th>Remaining in block</th><th>Status</th></tr></thead>
              <tbody>{(current?.allocations || result.allocations).map(row => <tr key={row.processId}><td>{row.processId}</td><td>{row.processSize} KB</td><td>{row.blockId || "—"}</td><td>{row.remainingInBlock == null ? "—" : `${row.remainingInBlock} KB`}</td><td><span className={row.allocated ? "status success" : "status failed"}>{row.allocated ? "Allocated" : "Not allocated"}</span></td></tr>)}</tbody>
            </table></div>
          </section>}
        </section>
      </div>
      <footer className="app-footer"><span>Memory Allocator <b>•</b> OS Lab Simulator</span><span>Built for learning memory management</span></footer>
    </main>
  );
}