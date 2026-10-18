// Single source of truth for memory allocation logic.
// Backend (server/) aur frontend (client/) dono isi file ko import karte hain,
// taaki dono jagah calculation ek jaisi rahe.

export const ALGORITHMS = Object.freeze(["firstFit", "bestFit", "worstFit", "nextFit"]);

export const ALGORITHM_LABELS = Object.freeze({
  firstFit: "First Fit",
  bestFit: "Best Fit",
  worstFit: "Worst Fit",
  nextFit: "Next Fit"
});

// Client aur server dono par same limits lagti hain.
export const LIMITS = Object.freeze({
  minBlocks: 1,
  maxBlocks: 20,
  minProcesses: 1,
  maxProcesses: 20
});

const round1 = value => Number(value.toFixed(1));

// Ek block me jo allocate ho chuka hai uska total size.
function totalUsed(memory) {
  return memory.reduce(
    (sum, block) => sum + block.allocated.reduce((inner, item) => inner + item.size, 0),
    0
  );
}

// Har step ke liye metrics: utilization, free memory, success rate, failures.
function buildMetrics(memory, allocations) {
  const totalMemory = memory.reduce((sum, block) => sum + block.size, 0);
  const usedMemory = totalUsed(memory);
  const allocatedProcesses = allocations.filter(item => item.allocated).length;
  const processedProcesses = allocations.length;

  return {
    allocatedProcesses,
    processedProcesses,
    failedProcesses: allocations
      .filter(item => !item.allocated)
      .map(item => ({ processId: item.processId, processSize: item.processSize })),
    successRate: processedProcesses ? round1((allocatedProcesses / processedProcesses) * 100) : 0,
    freeMemory: totalMemory - usedMemory,
    utilization: totalMemory ? round1((usedMemory / totalMemory) * 100) : 0
  };
}

export function validatePayload(body) {
  const errors = [];
  if (!body || typeof body !== "object") return ["Request body is required."];
  if (!ALGORITHMS.includes(body.algorithm)) errors.push("Select a valid algorithm.");
  if (!Array.isArray(body.blocks) || body.blocks.length < LIMITS.minBlocks || body.blocks.length > LIMITS.maxBlocks) {
    errors.push(`Provide ${LIMITS.minBlocks} to ${LIMITS.maxBlocks} memory blocks.`);
  }
  if (!Array.isArray(body.processes) || body.processes.length < LIMITS.minProcesses || body.processes.length > LIMITS.maxProcesses) {
    errors.push(`Provide ${LIMITS.minProcesses} to ${LIMITS.maxProcesses} processes.`);
  }
  for (const block of body.blocks || []) {
    if (!block.id || !Number.isFinite(block.size) || block.size <= 0) errors.push("Each block needs an ID and positive size.");
  }
  for (const process of body.processes || []) {
    if (!process.id || !Number.isFinite(process.size) || process.size <= 0) errors.push("Each process needs an ID and positive size.");
  }
  return errors;
}

export function simulateAllocation({ algorithm, blocks, processes }) {
  if (!ALGORITHMS.includes(algorithm)) throw new Error("Unsupported allocation algorithm.");

  // Variable partitioning: har block ka "remaining" counter chalta hai,
  // isliye ek baar allocate hone ke baad bacha hua space aage use ho sakta hai.
  const memory = blocks.map(block => ({ ...block, remaining: block.size, allocated: [] }));
  const allocations = [];
  const steps = [];
  let nextStart = 0;

  for (const process of processes) {
    // Step 1: sirf woh blocks jinme process fit ho sakta hai.
    const candidates = memory
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.remaining >= process.size);

    // Step 2: algorithm ke hisaab se block chuno.
    let chosen = null;
    if (algorithm === "firstFit") chosen = candidates[0] || null;
    if (algorithm === "bestFit") chosen = [...candidates].sort((a, b) => a.block.remaining - b.block.remaining)[0] || null;
    if (algorithm === "worstFit") chosen = [...candidates].sort((a, b) => b.block.remaining - a.block.remaining)[0] || null;
    if (algorithm === "nextFit" && memory.length) {
      chosen = [...candidates].sort((a, b) =>
        ((a.index - nextStart + memory.length) % memory.length) -
        ((b.index - nextStart + memory.length) % memory.length)
      )[0] || null;
    }

    // Step 3: remaining update.
    if (chosen) {
      chosen.block.remaining -= process.size;
      chosen.block.allocated.push({ processId: process.id, size: process.size });
      if (algorithm === "nextFit") nextStart = (chosen.index + 1) % memory.length;
    }

    allocations.push({
      processId: process.id,
      processSize: process.size,
      blockId: chosen?.block.id || null,
      remainingInBlock: chosen?.block.remaining ?? null,
      allocated: Boolean(chosen),
      // Fail hone par us waqt ka sabse bada free block - failure ka reason batane ke liye.
      largestFreeBlock: chosen ? null : memory.reduce((max, block) => Math.max(max, block.remaining), 0)
    });

    steps.push({
      processId: process.id,
      allocations: allocations.map(item => ({ ...item })),
      memory: memory.map(block => ({
        blockId: block.id,
        size: block.size,
        allocated: block.allocated.map(item => ({ ...item })),
        remaining: block.remaining
      })),
      metrics: buildMetrics(memory, allocations)
    });
  }

  const totalMemory = memory.reduce((sum, block) => sum + block.size, 0);

  return {
    algorithm,
    allocations,
    steps,
    summary: steps.at(-1)?.metrics || buildMetrics(memory, []),
    totalMemory,
    usedMemory: totalUsed(memory)
  };
}
