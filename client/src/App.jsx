import { useState } from "react";
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Cpu, Download, Gauge,
  HardDrive, Info, Layers, MemoryStick, Play, RotateCcw, Settings2, Table, Terminal, TrendingUp
} from "lucide-react";
import { runSimulation } from "./services/api.js";
import {
  defaultBlocks, defaultProcesses, defaultPaging, defaultSegmentation, SEGMENT_NAMES
} from "./algorithms/defaultData.js";
import MemoryMap from "./components/MemoryMap.jsx";
import ProcessQueue from "./components/ProcessQueue.jsx";
import MemoryPartitions from "./components/MemoryPartitions.jsx";
import SegmentQueue from "./components/SegmentQueue.jsx";
import PageTable from "./components/PageTable.jsx";
import SegmentTable from "./components/SegmentTable.jsx";
import StatCard from "./components/StatCard.jsx";
import Logo from "./components/Logo.jsx";
import { formatTime, exportCSV } from "./services/helpers.js";
import { LIMITS, ALGORITHM_LABELS, MODE_LABELS } from "@shared/allocation.js";

const algorithms = Object.entries(ALGORITHM_LABELS).map(([id, label]) => ({ id, label }));
const modes = Object.entries(MODE_LABELS).map(([id, label]) => ({ id, label }));

// Memory visualization ke neeche mode-specific note.
const MODE_NOTES = {
  contiguous: "Variable partitioning — a block's leftover space stays available for later processes.",
  paging: "Static paging — fixed-size frames, any page can go into any free frame, so external fragmentation never appears.",
  segmentation: "Address-ordered regions — every segment must stay contiguous, so external fragmentation can appear."
};

const FAILED_NOTES = {
  contiguous: "No single block had enough contiguous free space for these processes.",
  paging: "These processes needed more frames than were free at that time.",
  segmentation: "Total free memory was enough, but no single hole was large enough for a required segment."
};

let rowSequence = 0;
const nextRowKey = () => `seg-${(rowSequence += 1)}`;

// Default segmentation workload ko flat rows me badalte hain, kyunki UI ek hi ordered list dikhata hai.
function initialSegmentRows() {
  return defaultSegmentation.operations.flatMap(operation =>
    operation.release
      ? [{ key: nextRowKey(), type: "release", processId: operation.id }]
      : operation.segments.map(segment => ({
          key: nextRowKey(),
          type: "alloc",
          processId: operation.id,
          segment: segment.name,
          size: segment.size
        })));
}

// Rows -> engine ka operation list. Ek hi process ke lagatar rows ek hi process ban jate hain.
function toOperations(rows) {
  const operations = [];
  for (const row of rows) {
    if (row.type === "release") {
      operations.push({ id: row.processId, release: true });
      continue;
    }
    const last = operations.at(-1);
    if (last && !last.release && last.id === row.processId) {
      last.segments.push({ name: row.segment, size: row.size });
    } else {
      operations.push({ id: row.processId, segments: [{ name: row.segment, size: row.size }] });
    }
  }
  return operations;
}

export default function App() {
  const [mode, setMode] = useState("contiguous");
  const [algorithm, setAlgorithm] = useState("firstFit");

  // Contiguous + paging: process queue shared hai (process ka ek hi total size hota hai).
  const [blocks, setBlocks] = useState(defaultBlocks);
  const [processes, setProcesses] = useState(defaultProcesses);
  const [blockInput, setBlockInput] = useState("");
  const [processInput, setProcessInput] = useState("");

  // Paging inputs.
  const [pagingMemory, setPagingMemory] = useState(defaultPaging.physicalMemory);
  const [pageSize, setPageSize] = useState(defaultPaging.pageSize);

  // Segmentation inputs.
  const [segmentRows, setSegmentRows] = useState(initialSegmentRows);
  const [segmentMemory, setSegmentMemory] = useState(defaultSegmentation.physicalMemory);

  const [result, setResult] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState([{ time: formatTime(), text: "System ready. Pick a mode, add inputs, then click Start.", type: "info" }]);
  const [error, setError] = useState("");

  const isPaging = mode === "paging";
  const isSegmentation = mode === "segmentation";
  const totalMemory = blocks.reduce((sum, block) => sum + block.size, 0);

  // Paging ka live frame preview (backend ke same formula se).
  const memoryValue = Number(pagingMemory);
  const pageValue = Number(pageSize);
  const pageValid = Number.isFinite(memoryValue) && Number.isFinite(pageValue) && pageValue > 0 && memoryValue >= pageValue;
  const frameCount = pageValid ? Math.floor(memoryValue / pageValue) : 0;
  const usableMemory = pageValid ? frameCount * pageValue : 0;
  const unusableMemory = pageValid ? memoryValue - usableMemory : 0;

  const current = result?.steps?.[step] || null;
  const done = Boolean(result && step >= result.steps.length - 1);
  const active = current || result?.steps?.[0];
  const metrics = current?.metrics || result?.summary || null;
  const allocations = current?.allocations || result?.allocations || [];

  const addLog = (text, type = "info") => setLogs(old => [{ time: formatTime(), text, type }, ...old].slice(0, 30));

  function clearResult() {
    setResult(null);
    setStep(0);
  }

  // ---------- contiguous / paging inputs ----------
  function addProcess() {
    const size = Number(processInput);
    if (!Number.isFinite(size) || size <= 0) return setError("Enter a valid process size greater than 0 KB.");
    if (processes.length >= LIMITS.maxProcesses) return setError(`Maximum ${LIMITS.maxProcesses} processes allowed.`);
    setProcesses(old => [...old, { id: `P${old.length + 1}`, size }]);
    setProcessInput("");
    setError("");
    clearResult();
    addLog(`Added process of ${size} KB.`);
  }

  function removeProcess(id) {
    setProcesses(old => old.filter(process => process.id !== id).map((process, index) => ({ ...process, id: `P${index + 1}` })));
    setError("");
    clearResult();
  }

  function addBlock() {
    const size = Number(blockInput);
    if (!Number.isFinite(size) || size <= 0) return setError("Enter a valid partition size greater than 0 KB.");
    if (blocks.length >= LIMITS.maxBlocks) return setError(`Maximum ${LIMITS.maxBlocks} memory blocks allowed.`);
    setBlocks(old => [...old, { id: `Block ${old.length + 1}`, size }]);
    setBlockInput("");
    setError("");
    clearResult();
    addLog(`Added memory block of ${size} KB.`);
  }

  function removeBlock(id) {
    setBlocks(old => old.filter(block => block.id !== id).map((block, index) => ({ ...block, id: `Block ${index + 1}` })));
    setError("");
    clearResult();
  }

  // ---------- segmentation inputs ----------
  function addSegment(row) {
    setSegmentRows(old => [...old, { ...row, key: nextRowKey(), type: "alloc" }]);
    setError("");
    clearResult();
    addLog(`Queued ${row.processId} · ${row.segment} (${row.size} KB).`);
  }

  function addRelease(processId) {
    setSegmentRows(old => [...old, { key: nextRowKey(), type: "release", processId }]);
    setError("");
    clearResult();
    addLog(`Queued release operation for ${processId}.`);
  }

  function removeSegmentRow(key) {
    setSegmentRows(old => old.filter(row => row.key !== key));
    setError("");
    clearResult();
  }

  // ---------- run ----------
  function preflight() {
    if (mode === "contiguous") {
      if (!blocks.length || !processes.length) return "Add at least one memory block and one process.";
      return "";
    }
    if (mode === "paging") {
      if (!processes.length) return "Add at least one process to the queue.";
      if (!Number.isFinite(memoryValue) || memoryValue < LIMITS.minPhysicalMemory || memoryValue > LIMITS.maxPhysicalMemory) {
        return `Physical memory must be between ${LIMITS.minPhysicalMemory} and ${LIMITS.maxPhysicalMemory} KB.`;
      }
      if (!Number.isFinite(pageValue) || pageValue < LIMITS.minPageSize || pageValue > LIMITS.maxPageSize) {
        return `Page size must be between ${LIMITS.minPageSize} and ${LIMITS.maxPageSize} KB.`;
      }
      if (pageValue > memoryValue) return "Page size cannot be larger than physical memory.";
      if (frameCount < 1) return "Page size is too large for the given physical memory.";
      if (frameCount > LIMITS.maxFrames) return `At most ${LIMITS.maxFrames} frames are supported; reduce memory or increase page size.`;
      return "";
    }
    if (!segmentRows.length) return "Add at least one segment row.";
    if (!segmentRows.some(row => row.type === "alloc")) return "Add at least one segment to allocate.";
    const size = Number(segmentMemory);
    if (!Number.isFinite(size) || size < LIMITS.minPhysicalMemory || size > LIMITS.maxPhysicalMemory) {
      return `Physical memory must be between ${LIMITS.minPhysicalMemory} and ${LIMITS.maxPhysicalMemory} KB.`;
    }
    return "";
  }

  function payload() {
    if (isPaging) return { mode, algorithm, physicalMemory: memoryValue, pageSize: pageValue, processes };
    if (isSegmentation) return { mode, algorithm, physicalMemory: Number(segmentMemory), processes: toOperations(segmentRows) };
    return { mode, algorithm, blocks, processes };
  }

  async function start() {
    const problem = preflight();
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      const data = await runSimulation(payload());
      setResult(data);
      setStep(0);
      addLog(`${MODE_LABELS[mode]} · ${ALGORITHM_LABELS[algorithm]} simulation started.`, "success");

      const summary = data.summary || {};
      addLog(`${summary.allocatedProcesses}/${summary.processedProcesses} process(es) placed · success rate ${summary.successRate}%.`);
      if (isPaging) addLog(`Frames used: ${summary.framesUsed}/${summary.frameCount} · internal fragmentation ${summary.internalFragmentation} KB.`);
      if (isPaging && summary.unusableMemory) addLog(`${summary.unusableMemory} KB is smaller than one page, so it stays unusable.`, "error");
      if (isSegmentation) {
        addLog(`Free ${summary.freeMemory} KB in ${summary.holesCount} hole(s) · largest hole ${summary.largestHole} KB.`);
        addLog(`External fragmentation: ${summary.externalFragmentation} KB (free memory − largest hole) · compactions: ${summary.compactions}.`);
      }
    } catch (e) {
      setError(e.message || "Simulation failed.");
      addLog("Could not reach API. Start the backend or check VITE_API_URL.", "error");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    clearResult();
    setError("");
    addLog("Simulation reset.");
  }

  function changeMode(id) {
    if (id === mode) return;
    setMode(id);
    clearResult();
    setError("");
    addLog(`Switched to ${MODE_LABELS[id]} mode.`);
  }

  function changeAlgorithm(id) {
    setAlgorithm(id);
    clearResult();
  }

  // ---------- per-mode stat cards ----------
  function statCards() {
    if (isPaging) {
      return <>
        <StatCard label="Allocated Processes" value={metrics ? `${metrics.allocatedProcesses}/${metrics.processedProcesses}` : "—"} sub="Successfully mapped to frames" icon={<CheckCircle2 size={17}/>} tone="cyan"/>
        <StatCard label="Frames Used" value={metrics ? `${metrics.framesUsed}/${metrics.frameCount}` : "—"} sub={`Each frame is ${result?.pageSize ?? pageValue} KB`} icon={<Layers size={17}/>} tone="blue"/>
        <StatCard label="Internal Fragmentation" value={metrics ? `${metrics.internalFragmentation} KB` : "—"} sub="Unused tail inside the last page of each process" icon={<Gauge size={17}/>} tone="purple"/>
        <StatCard label="Free Frames" value={metrics ? `${metrics.framesFree}` : "—"} sub={metrics ? `${metrics.framesFree * (result?.pageSize || 0)} KB still available` : "Available frames"} icon={<HardDrive size={17}/>} tone="green"/>
      </>;
    }
    if (isSegmentation) {
      return <>
        <StatCard label="Allocated Processes" value={metrics ? `${metrics.allocatedProcesses}/${metrics.processedProcesses}` : "—"} sub="Processes whose every segment fit" icon={<CheckCircle2 size={17}/>} tone="cyan"/>
        <StatCard label="Free Memory" value={metrics ? `${metrics.freeMemory} KB` : "—"} sub={metrics ? `Spread over ${metrics.holesCount} free hole(s)` : "Total unallocated memory"} icon={<HardDrive size={17}/>} tone="blue"/>
        <StatCard label="External Fragmentation" value={metrics ? `${metrics.externalFragmentation} KB` : "—"} sub={metrics ? `Free memory − largest hole (${metrics.largestHole} KB)` : "Free memory minus the largest hole"} icon={<Gauge size={17}/>} tone="purple"/>
        <StatCard label="Compactions" value={metrics ? metrics.compactions : "—"} sub={metrics ? `${metrics.segmentsResident} segment(s) resident` : "Only when a hole is too small"} icon={<Layers size={17}/>} tone="green"/>
      </>;
    }
    return <>
      <StatCard label="Allocated Processes" value={metrics ? `${metrics.allocatedProcesses}/${metrics.processedProcesses}` : "—"} sub="Successfully placed in memory" icon={<CheckCircle2 size={17}/>} tone="cyan"/>
      <StatCard label="Allocation Success Rate" value={metrics ? `${metrics.successRate}%` : "—"} sub={metrics ? `${metrics.failedProcesses.length} process(es) failed` : "Allocated / processed"} icon={<TrendingUp size={17}/>} tone="green"/>
      <StatCard label="Memory Utilization" value={metrics ? `${metrics.utilization}%` : "—"} sub="Allocated / total memory" icon={<Gauge size={17}/>} tone="purple"/>
      <StatCard label="Free Memory" value={metrics ? `${metrics.freeMemory} KB` : "—"} sub="Still available for allocation" icon={<HardDrive size={17}/>} tone="blue"/>
    </>;
  }

  // ---------- per-mode results table ----------
  function resultsTable() {
    if (isPaging) {
      return (
        <table>
          <thead><tr><th>Process</th><th>Size</th><th>Pages needed</th><th>Frames</th><th>Internal frag</th><th>Status</th></tr></thead>
          <tbody>{allocations.map(row => (
            <tr key={row.processId}>
              <td>{row.processId}</td>
              <td>{row.processSize} KB</td>
              <td className="mono">{row.pagesNeeded}</td>
              <td className="mono">{row.frames.length ? row.frames.map(frame => `F${frame}`).join(", ") : "—"}</td>
              <td className="mono">{row.allocated ? `${row.internalFragmentation} KB` : "—"}</td>
              <td><span className={row.allocated ? "status success" : "status failed"}>{row.allocated ? "Allocated" : "Not allocated"}</span></td>
            </tr>
          ))}</tbody>
        </table>
      );
    }
    if (isSegmentation) {
      return (
        <table>
          <thead><tr><th>Process</th><th>Requested</th><th>Segments placed</th><th>Placement (segment @ base)</th><th>Status</th></tr></thead>
          <tbody>{allocations.map((row, index) => (
            <tr key={`${row.processId}-${index}`}>
              <td>{row.processId}</td>
              <td>{row.processSize} KB</td>
              <td className="mono">{row.allocated ? row.segments.length : 0}</td>
              <td className="mono">{row.allocated ? row.segments.map(segment => `${segment.name} @ ${segment.base}`).join(", ") : "—"}</td>
              <td>
                <span className={row.released ? "status released" : row.allocated ? "status success" : "status failed"}>
                  {row.released ? "Released" : row.allocated ? (row.compacted ? "Allocated (compacted)" : "Allocated") : "Not allocated"}
                </span>
              </td>
            </tr>
          ))}</tbody>
        </table>
      );
    }
    return (
      <table>
        <thead><tr><th>Process</th><th>Size</th><th>Allocated Block</th><th>Remaining in block</th><th>Status</th></tr></thead>
        <tbody>{allocations.map(row => (
          <tr key={row.processId}>
            <td>{row.processId}</td>
            <td>{row.processSize} KB</td>
            <td>{row.blockId || "—"}</td>
            <td>{row.remainingInBlock == null ? "—" : `${row.remainingInBlock} KB`}</td>
            <td><span className={row.allocated ? "status success" : "status failed"}>{row.allocated ? "Allocated" : "Not allocated"}</span></td>
          </tr>
        ))}</tbody>
      </table>
    );
  }

  // Run se pehle ka initial layout, taaki visualization khaali na dikhe.
  // Shape wahi rehta hai jo engine steps me deta hai, isliye MemoryMap ko farq nahi padta.
  function previewRegions() {
    if (isPaging) {
      return Array.from({ length: Math.min(frameCount, LIMITS.maxFrames) }, (_, index) => ({
        blockId: `F${index}`, label: `F${index}`, size: pageValue, allocated: [], remaining: pageValue
      }));
    }
    if (isSegmentation) {
      const size = Number(segmentMemory);
      if (!Number.isFinite(size) || size <= 0) return [];
      return [{ blockId: "free-0", label: "Free memory", start: 0, size, allocated: [], remaining: size }];
    }
    return blocks.map(block => ({
      blockId: block.id, label: block.id, size: block.size, allocated: [], remaining: block.size
    }));
  }

  const regions = active?.memory?.length ? active.memory : previewRegions();

  // Prev/Next sirf allocation hi nahi, release aur compaction steps bhi dikhate hain —
  // isliye current step ka operation label bhi dikhana zaroori hai.
  function stepTag() {
    const operation = current?.operation;
    if (!operation) return `Step ${step + 1}`;
    if (operation.type === "free") return `Release · ${operation.processId}`;
    if (operation.compacted) return `Compaction + allocate · ${operation.processId}`;
    if (isPaging) return `Frame allocation · ${operation.processId}`;
    if (isSegmentation) return `Segment allocation · ${operation.processId}`;
    return `Allocation · ${operation.processId}`;
  }

  const memoryFooter = isPaging
    ? `Frames: ${result?.frameCount ?? frameCount} × ${result?.pageSize ?? (pageValue || 0)} KB`
    : isSegmentation
      ? `Physical Memory: ${result?.physicalMemory ?? (Number(segmentMemory) || 0)} KB${result ? ` · Free: ${result.summary.freeMemory} KB` : ""}`
      : `Total Memory: ${totalMemory} KB`;

  const resultsTitle = isPaging ? "Page Allocation Results" : isSegmentation ? "Segment Allocation Results" : "Allocation Results";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Logo size={26}/></div>
          <div><h1>Memory Allocator</h1><p>Simulate OS memory management: contiguous, paging and segmentation.</p></div>
        </div>
        <div className="topbar-controls">
          <nav className="mode-selector" aria-label="Memory management mode">
            {modes.map(item => (
              <button key={item.id} className={mode === item.id ? "mode-tab active" : "mode-tab"} onClick={() => changeMode(item.id)}>{item.label}</button>
            ))}
          </nav>
          <nav className="algorithm-tabs" aria-label="Allocation algorithm">
            {algorithms.map(item => (
              <button key={item.id} className={algorithm === item.id ? "tab active" : "tab"} onClick={() => changeAlgorithm(item.id)}>{item.label}</button>
            ))}
          </nav>
        </div>
      </header>

      {isPaging && <div className="info-strip">
        <Info size={15}/>
        <span><b>Static paging</b> — every page is allocated up front, so there is no page fault or page replacement (FIFO / LRU) handling. And because all frames are the same size, <b>Best Fit</b> and <b>Worst Fit</b> have no size-based choice left — they give the same result as <b>First Fit</b>. Only <b>Next Fit</b> differs, because it searches frames circularly from the last placement.</span>
      </div>}

      <div className="dashboard">
        <aside className="left-column">
          <section className="panel control-panel">
            <div className="panel-heading"><Settings2 size={18}/><h2>Simulation Control</h2><span className="pill">{MODE_LABELS[mode]}</span></div>
            <div className="button-row">
              <button className="btn btn-primary" onClick={start} disabled={busy}><Play size={15} fill="currentColor"/>{busy ? "Running..." : "Start"}</button>
              <button className="btn btn-secondary" onClick={reset}><RotateCcw size={15}/>Reset</button>
            </div>
            {error && <div className="error-message"><AlertCircle size={15}/>{error}</div>}
            {result && <>
              <div className="step-controls">
                <button className="icon-button" onClick={() => setStep(value => Math.max(0, value - 1))} disabled={step === 0} aria-label="Previous step"><ChevronLeft size={17}/></button>
                <span>Step {Math.min(step + 1, result.steps.length)} / {result.steps.length}</span>
                <button className="icon-button" onClick={() => setStep(value => Math.min(result.steps.length - 1, value + 1))} disabled={done} aria-label="Next step"><ChevronRight size={17}/></button>
                <button className="text-button" onClick={() => setStep(result.steps.length - 1)}>Finish</button>
              </div>
              <div className={current?.operation?.ok === false ? "step-caption failed" : "step-caption"}>
                <span className="step-tag">{stepTag()}</span>
                <span className="step-detail">{current?.operation?.detail || ""}</span>
              </div>
            </>}
          </section>

          {(mode === "contiguous" || isPaging) && (
            <ProcessQueue processes={processes} input={processInput} onInput={setProcessInput} onAdd={addProcess} onRemove={removeProcess} max={LIMITS.maxProcesses}/>
          )}

          {mode === "contiguous" && (
            <MemoryPartitions blocks={blocks} input={blockInput} onInput={setBlockInput} onAdd={addBlock} onRemove={removeBlock} max={LIMITS.maxBlocks}/>
          )}

          {isPaging && (
            <section className="panel">
              <div className="panel-heading"><Cpu size={18}/><h2>Memory Configuration</h2><span className="pill">Static Paging</span></div>
              <div className="config-row">
                <label>Physical Memory (KB)
                  <input type="number" min={LIMITS.minPhysicalMemory} max={LIMITS.maxPhysicalMemory} value={pagingMemory}
                    onChange={event => { setPagingMemory(event.target.value); clearResult(); }}/>
                </label>
                <label>Page Size (KB)
                  <input type="number" min={LIMITS.minPageSize} max={LIMITS.maxPageSize} value={pageSize}
                    onChange={event => { setPageSize(event.target.value); clearResult(); }}/>
                </label>
              </div>
              <div className="config-readout">
                <span>Generated frames: <b>{frameCount}</b></span>
                <span>Usable memory: <b>{usableMemory} KB</b></span>
                {unusableMemory > 0 && <span className="warn">Unusable: <b>{unusableMemory} KB</b> (smaller than one page)</span>}
              </div>
              <div className="frame-chips">
                {Array.from({ length: Math.min(frameCount, LIMITS.maxFrames) }, (_, index) => (
                  <span className="frame-chip" key={index}>F{index}</span>
                ))}
                {!frameCount && <p className="empty-note">Enter a valid memory size and page size to generate frames.</p>}
              </div>
              <p className="hint">
                Frames: {frameCount} × {pageValid ? pageValue : 0} KB.{frameCount > LIMITS.maxFrames ? ` Showing the first ${LIMITS.maxFrames}.` : ""} A process is split into pages of this same size, and each page can use any free frame.
              </p>
            </section>
          )}

          {isSegmentation && (
            <>
              <SegmentQueue rows={segmentRows} segmentNames={SEGMENT_NAMES} maxSegments={LIMITS.maxSegmentsPerProcess} maxProcesses={LIMITS.maxProcesses} onAdd={addSegment} onAddRelease={addRelease} onRemove={removeSegmentRow}/>
              <section className="panel">
                <div className="panel-heading"><HardDrive size={18}/><h2>Physical Memory</h2><span className="pill">Segmentation</span></div>
                <div className="config-row single">
                  <label>Total Size (KB)
                    <input type="number" min={LIMITS.minPhysicalMemory} max={LIMITS.maxPhysicalMemory} value={segmentMemory}
                      onChange={event => { setSegmentMemory(event.target.value); clearResult(); }}/>
                  </label>
                </div>
                <p className="hint">One continuous region, initially fully free. Each segment must stay contiguous, so holes appear when processes are released.</p>
              </section>
            </>
          )}
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
              <MemoryMap regions={regions} dense={isPaging}/>
            </div>
            <div className="memory-footer">
              <span className="model-note">{MODE_NOTES[mode]}</span>
              <span>{memoryFooter}</span>
            </div>
          </section>

          <section className="stats-grid">{statCards()}</section>

          {metrics?.failedProcesses?.length > 0 && <section className="panel failed-panel">
            <div className="panel-heading"><AlertCircle size={18}/><h2>Failed Processes</h2><span className="count-pill">{metrics.failedProcesses.length} failed</span></div>
            <div className="failed-list">
              {metrics.failedProcesses.map(item => (
                <div className="failed-item" key={item.processId}>
                  <span className="failed-id">{item.processId}</span>
                  <span className="failed-size">needs {item.processSize} KB</span>
                  <span className="failed-reason">{item.reason || "Not enough suitable free space."}</span>
                </div>
              ))}
            </div>
            <p className="hint">{FAILED_NOTES[mode]}</p>
          </section>}

          {isPaging && active?.pageTables && <section className="panel results-panel">
            <div className="panel-heading"><Table size={18}/><h2>Page Table</h2><span className="count-pill">{metrics?.pageTableSize ?? 0} pages</span></div>
            <PageTable pageTables={active.pageTables} pageSize={result?.pageSize || pageValue}/>
          </section>}

          {isSegmentation && active?.segmentTable && <section className="panel results-panel">
            <div className="panel-heading"><Table size={18}/><h2>Segment Table</h2><span className="count-pill">{active.segmentTable.length} resident</span></div>
            <SegmentTable segmentTable={active.segmentTable}/>
          </section>}

          {result && <section className="panel results-panel">
            <div className="panel-heading"><Layers size={18}/><h2>{resultsTitle}</h2><button className="export-button" onClick={() => exportCSV(result)}><Download size={14}/>Export CSV</button></div>
            <div className="table-wrap">{resultsTable()}</div>
          </section>}

          <section className="logs-panel">
            <div className="logs-heading"><span><Terminal size={14}/>System Logs</span><div><span className="live-dot"/>Live Output</div></div>
            <div className="logs-list">
              {logs.map((log, index) => <div className={`log-line ${log.type}`} key={`${log.time}-${index}`}><time>[{log.time}]</time><span>{log.text}</span></div>)}
            </div>
          </section>
        </section>
      </div>
      <footer className="app-footer"><span>Memory Allocator <b>•</b> OS Lab Simulator</span><span>Built for learning memory management</span></footer>
    </main>
  );
}
