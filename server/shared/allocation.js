// Memory allocation ka entry point.
//
// Yahan teeno modes ka dispatcher hai:
//   contiguous   -> isi file me (variable partitioning, purana behaviour)
//   paging       -> ./paging.js
//   segmentation -> ./segmentation.js
//
// Single source of truth: server aur React client dono isi module ko import karte hain,
// isliye calculation kabhi mismatch nahi hoti.
//
// Yeh file server/ ke andar isliye rakhi gayi hai ki deployment me sirf server/ folder
// bhejna padta hai. Agar yeh server/ ke bahar hoti, to container me module milta hi nahi
// aur runtime par ERR_MODULE_NOT_FOUND aata. Client ise "@shared/allocation.js" alias se
// import karta hai (dekhein client/vite.config.js).

import {
  ALGORITHMS,
  ALGORITHM_LABELS,
  MODES,
  MODE_LABELS,
  LIMITS,
  commonMetrics,
  emptySummary
} from "./common.js";
import { simulatePaging } from "./paging.js";
import { simulateSegmentation } from "./segmentation.js";

export { ALGORITHMS, ALGORITHM_LABELS, MODES, MODE_LABELS, LIMITS };

// Ek block me jo allocate ho chuka hai uska total size.
function totalUsed(memory) {
  return memory.reduce(
    (sum, block) => sum + block.allocated.reduce((inner, item) => inner + item.size, 0),
    0
  );
}

// ---------- Contiguous allocation (variable partitioning) ----------

export function simulateContiguous({ algorithm, blocks, processes }) {
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

    // Fail hone par us waqt ka sabse bada free block - failure ka reason batane ke liye.
    const largestFreeBlock = chosen ? null : memory.reduce((max, block) => Math.max(max, block.remaining), 0);

    allocations.push({
      processId: process.id,
      processSize: process.size,
      blockId: chosen?.block.id || null,
      remainingInBlock: chosen?.block.remaining ?? null,
      allocated: Boolean(chosen),
      largestFreeBlock,
      failureReason: chosen
        ? null
        : `No single block had ${process.size} KB; the largest free block was ${largestFreeBlock} KB.`
    });

    steps.push({
      processId: process.id,
      // Step caption ke liye - UI isse "Allocation: P1 -> Block 2" jaisa label dikhata hai.
      operation: {
        type: "alloc",
        processId: process.id,
        ok: Boolean(chosen),
        detail: chosen
          ? `${process.size} KB placed in ${chosen.block.id} (${chosen.block.remaining} KB left there)`
          : `No block had ${process.size} KB; largest free block was ${largestFreeBlock} KB`
      },
      allocations: allocations.map(item => ({ ...item })),
      memory: memory.map(block => ({
        blockId: block.id,
        label: block.id,
        size: block.size,
        allocated: block.allocated.map(item => ({ ...item })),
        remaining: block.remaining
      })),
      metrics: {
        ...commonMetrics({ allocations, totalMemory: memory.reduce((sum, b) => sum + b.size, 0), usedMemory: totalUsed(memory) }),
        mode: "contiguous"
      }
    });
  }

  const totalMemory = memory.reduce((sum, block) => sum + block.size, 0);

  return {
    mode: "contiguous",
    algorithm,
    allocations,
    steps,
    summary: steps.at(-1)?.metrics || emptySummary({ mode: "contiguous", totalMemory }),
    totalMemory,
    usedMemory: totalUsed(memory)
  };
}

// ---------- Dispatcher ----------

export function simulate(config) {
  const mode = config?.mode || "contiguous";
  if (!MODES.includes(mode)) throw new Error("Invalid memory management mode.");
  if (mode === "paging") return simulatePaging(config);
  if (mode === "segmentation") return simulateSegmentation(config);
  return simulateContiguous(config);
}

// ---------- Validation ----------

function validateProcessList(processes, errors) {
  if (!Array.isArray(processes) || processes.length < LIMITS.minProcesses || processes.length > LIMITS.maxProcesses) {
    errors.push(`Provide ${LIMITS.minProcesses} to ${LIMITS.maxProcesses} processes.`);
    return;
  }
  for (const process of processes) {
    if (!process?.id || !Number.isFinite(process.size) || process.size <= 0) {
      errors.push("Each process needs an ID and positive size.");
    }
  }
}

function validatePhysicalMemory(value, errors) {
  if (!Number.isFinite(value) || value < LIMITS.minPhysicalMemory || value > LIMITS.maxPhysicalMemory) {
    errors.push(`Physical memory must be between ${LIMITS.minPhysicalMemory} and ${LIMITS.maxPhysicalMemory} KB.`);
  }
}

export function validatePayload(body) {
  const errors = [];
  if (!body || typeof body !== "object") return ["Request body is required."];

  const mode = body.mode || "contiguous";
  if (!MODES.includes(mode)) errors.push("Select a valid memory management mode.");
  if (!ALGORITHMS.includes(body.algorithm)) errors.push("Select a valid allocation algorithm.");

  if (mode === "contiguous") {
    if (!Array.isArray(body.blocks) || body.blocks.length < LIMITS.minBlocks || body.blocks.length > LIMITS.maxBlocks) {
      errors.push(`Provide ${LIMITS.minBlocks} to ${LIMITS.maxBlocks} memory blocks.`);
    }
    for (const block of body.blocks || []) {
      if (!block?.id || !Number.isFinite(block.size) || block.size <= 0) {
        errors.push("Each block needs an ID and positive size.");
      }
    }
    validateProcessList(body.processes, errors);
  }

  if (mode === "paging") {
    validatePhysicalMemory(body.physicalMemory, errors);
    if (!Number.isFinite(body.pageSize) || body.pageSize < LIMITS.minPageSize || body.pageSize > LIMITS.maxPageSize) {
      errors.push(`Page size must be between ${LIMITS.minPageSize} and ${LIMITS.maxPageSize} KB.`);
    }
    if (Number.isFinite(body.pageSize) && Number.isFinite(body.physicalMemory)) {
      if (body.pageSize > body.physicalMemory) errors.push("Page size cannot be larger than physical memory.");
      const frameCount = Math.floor(body.physicalMemory / body.pageSize);
      if (frameCount < 1) errors.push("Page size is too large for the given physical memory.");
      else if (frameCount > LIMITS.maxFrames) errors.push(`At most ${LIMITS.maxFrames} frames are supported; reduce memory or increase page size.`);
    }
    validateProcessList(body.processes, errors);
  }

  if (mode === "segmentation") {
    validatePhysicalMemory(body.physicalMemory, errors);
    if (!Array.isArray(body.processes) || body.processes.length < LIMITS.minProcesses || body.processes.length > LIMITS.maxProcesses) {
      errors.push(`Provide ${LIMITS.minProcesses} to ${LIMITS.maxProcesses} processes.`);
    }
    for (const process of body.processes || []) {
      if (!process?.id) {
        errors.push("Each process needs an ID.");
        continue;
      }
      // Release operation: sirf process ka ID chahiye, segments nahi.
      if (process.release) continue;
      if (!Array.isArray(process.segments) || !process.segments.length) {
        errors.push(`${process.id} needs at least one segment.`);
        continue;
      }
      if (process.segments.length > LIMITS.maxSegmentsPerProcess) {
        errors.push(`${process.id} can have at most ${LIMITS.maxSegmentsPerProcess} segments.`);
      }
      for (const segment of process.segments) {
        if (!segment?.name || !Number.isFinite(segment.size) || segment.size <= 0) {
          errors.push(`${process.id} has a segment with an invalid name or size.`);
        }
      }
    }
  }

  return errors;
}
