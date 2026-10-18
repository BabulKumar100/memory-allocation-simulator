export default function MemoryMap({ blocks, step, totalMemory }) {
  const allocations = step?.memory || [];
  if (!blocks.length) return <div className="memory-empty">Add memory partitions to visualize allocation.</div>;
  return (
    <div className="memory-map" role="img" aria-label="Memory partition visualization">
      {blocks.map(block => {
        const state = allocations.find(item => item.blockId === block.id);
        const allocated = state?.allocated || [];
        const used = allocated.reduce((sum, item) => sum + item.size, 0);
        const free = Math.max(0, block.size - used);

        return <div className="memory-block" key={block.id} style={{ flexGrow: block.size, flexBasis: 0 }}>
          <div className="block-top"><span>{block.size} KB</span></div>
          <div className="block-content">
            {allocated.map((item, i) => <div className="memory-segment allocated-segment" key={`${item.processId}-${i}`} style={{ flexGrow: item.size, flexBasis: 0 }} title={`${item.processId}: ${item.size} KB`}>
              <b>{item.processId}</b><small>{item.size} KB</small>
            </div>)}
            {free > 0 && (
              <div
                className={`memory-segment ${allocated.length ? "remaining-segment" : "free-segment"}`}
                style={{ flexGrow: free, flexBasis: 0 }}
                title={allocated.length
                  ? `${free} KB still available in this block for later processes`
                  : `${free} KB completely unused`}
              >
                <small>{allocated.length ? `Remaining ${free} KB` : "Free"}</small>
              </div>
            )}
          </div>
          {used > 0 && <div className="block-bottom"><span>{Math.round(used / block.size * 100)}% used</span></div>}
        </div>;
      })}
    </div>
  );
}