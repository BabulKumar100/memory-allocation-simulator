// Teeno memory modes (contiguous / paging / segmentation) ke liye shared constants
// aur metrics helpers. Yeh file isliye alag hai ki paging.js aur segmentation.js
// dono ise import kar sakein, aur allocation.js in dono ko - koi circular import na bane.
//
// Rule: is folder me koi bhi file server/ ke bahar import nahi karti.

export const ALGORITHMS = Object.freeze(["firstFit", "bestFit", "worstFit", "nextFit"]);

export const ALGORITHM_LABELS = Object.freeze({
  firstFit: "First Fit",
  bestFit: "Best Fit",
  worstFit: "Worst Fit",
  nextFit: "Next Fit"
});

// Contiguous = ek process ko ek hi contiguous block milta hai (variable partitioning).
// Paging     = fixed-size frames, process pages kisi bhi free frame me.
// Segmentation = process ke logical segments, har ek ko alag hole.
export const MODES = Object.freeze(["contiguous", "paging", "segmentation"]);

export const MODE_LABELS = Object.freeze({
  contiguous: "Contiguous",
  paging: "Paging",
  segmentation: "Segmentation"
});

// Client aur server dono par same limits lagti hain.
export const LIMITS = Object.freeze({
  minBlocks: 1,
  maxBlocks: 20,
  minProcesses: 1,
  maxProcesses: 20,
  minPhysicalMemory: 4,
  maxPhysicalMemory: 8192,
  minPageSize: 1,
  maxPageSize: 512,
  // Visualization readable rahe, isliye frames par cap.
  maxFrames: 64,
  maxSegmentsPerProcess: 6
});

export const round1 = value => Number(value.toFixed(1));

// Sab modes me common metrics: kitne allocate hue, success rate, free memory, utilization.
// Har engine apne mode-specific fields isme add karta hai.
export function commonMetrics({ allocations, totalMemory, usedMemory }) {
  const allocatedProcesses = allocations.filter(item => item.allocated).length;
  const processedProcesses = allocations.length;

  return {
    allocatedProcesses,
    processedProcesses,
    failedProcesses: allocations
      .filter(item => !item.allocated)
      .map(item => ({
        processId: item.processId,
        processSize: item.processSize,
        reason: item.failureReason || null
      })),
    successRate: processedProcesses ? round1((allocatedProcesses / processedProcesses) * 100) : 0,
    freeMemory: totalMemory - usedMemory,
    utilization: totalMemory ? round1((usedMemory / totalMemory) * 100) : 0
  };
}

export function emptySummary(extra) {
  return {
    ...commonMetrics({ allocations: [], totalMemory: extra.totalMemory, usedMemory: 0 }),
    ...extra
  };
}
