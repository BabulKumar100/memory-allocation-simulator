// Memory visualization. Teeno modes ke liye same component chalta hai, kyunki
// har engine regions ko ek hi shape me deta hai:
//   { blockId, label, start?, size, allocated: [{ processId, size, detail }], remaining }
//
// Contiguous -> named partitions
// Paging     -> equal-size frames (isliye width bhi barabar dikhti hai)
// Segmentation -> address-ordered regions, yaani asli layout
export default function MemoryMap({ regions, dense = false }) {
  if (!regions?.length) return <div className="memory-empty">Add memory to visualize allocation.</div>;

  return (
    <div className={`memory-map${dense ? " dense" : ""}`} role="img" aria-label="Memory visualization">
      {regions.map(region => {
        const used = region.allocated.reduce((sum, item) => sum + item.size, 0);
        const free = Math.max(0, region.size - used);

        // Dense mode (bahut saare frames) me sirf label dikhate hain, size nahi.
        const topLabel = dense
          ? region.label
          : region.start != null
            ? `${region.start}–${region.start + region.size}`
            : `${region.size} KB`;

        return (
          <div className="memory-block" key={region.blockId} style={{ flexGrow: region.size, flexBasis: 0 }}>
            <div className="block-top"><span>{topLabel}</span></div>
            <div className="block-content">
              {region.allocated.map((item, index) => (
                <div
                  className="memory-segment allocated-segment"
                  key={`${item.processId}-${index}`}
                  style={{ flexGrow: item.size, flexBasis: 0 }}
                  title={`${item.processId}${item.detail ? ` (${item.detail})` : ""}: ${item.size} KB`}
                >
                  <b>{item.processId}</b>
                  <small>{dense ? item.detail : item.detail ? `${item.detail} · ${item.size} KB` : `${item.size} KB`}</small>
                </div>
              ))}
              {free > 0 && (
                <div
                  className={`memory-segment ${region.allocated.length ? "remaining-segment" : "free-segment"}`}
                  style={{ flexGrow: free, flexBasis: 0 }}
                  title={region.allocated.length
                    ? `${free} KB still free inside this region`
                    : `${free} KB free`}
                >
                  <small>{dense ? "" : `Free ${free} KB`}</small>
                </div>
              )}
            </div>
            {!dense && used > 0 && (
              <div className="block-bottom"><span>{Math.round(used / region.size * 100)}% used</span></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
