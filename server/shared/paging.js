// Paging engine.
//
// Physical memory barabar size ke frames me toot jati hai. Process bhi utne hi
// size ke pages me tootta hai, aur koi bhi page kisi bhi free frame me ja sakta hai.
// Isliye paging me EXTERNAL fragmentation hoti hi nahi - sirf process ke aakhri page
// me thodi jagah bachti hai (internal fragmentation), jo hamesha pageSize se kam hoti hai.
//
// Yeh STATIC paging hai: process ke saare pages ek saath, up-front allocate hote hain.
// Yeh DEMAND paging nahi hai - koi page fault ya page replacement (FIFO/LRU) nahi hoti.

import { ALGORITHMS, commonMetrics, emptySummary } from "./common.js";

// Frames ka snapshot - MemoryMap isi shape ko padhta hai.
function snapshotFrames(frames, pageSize) {
  return frames.map(item => ({
    blockId: `F${item.frame}`,
    label: `F${item.frame}`,
    size: pageSize,
    allocated: item.processId
      ? [{ processId: item.processId, size: pageSize, detail: `page ${item.page}` }]
      : [],
    remaining: item.processId ? 0 : pageSize
  }));
}

export function simulatePaging({ algorithm, physicalMemory, pageSize, processes }) {
  if (!ALGORITHMS.includes(algorithm)) throw new Error("Unsupported allocation algorithm.");

  const frameCount = Math.floor(physicalMemory / pageSize);
  // Aakhri adhura frame use nahi ho sakta, woh memory waste ho jati hai.
  const unusableMemory = physicalMemory - frameCount * pageSize;

  const frames = Array.from({ length: frameCount }, (_, index) => ({
    frame: index,
    processId: null,
    page: null
  }));

  const allocations = [];
  const pageTables = [];
  const steps = [];
  let nextStart = 0;

  for (const process of processes) {
    const pagesNeeded = Math.ceil(process.size / pageSize);
    const freeFrames = frames.filter(item => item.processId === null);

    let chosen = null;
    let failureReason = null;

    if (freeFrames.length < pagesNeeded) {
      failureReason = `Needs ${pagesNeeded} frame(s) but only ${freeFrames.length} free frame(s) available.`;
    } else {
      // Saare frames ka size barabar hai, isliye bestFit aur worstFit ka koi
      // size-based matlab nahi bachta - dono firstFit ki tarah behave karte hain.
      // nextFit hi alag hai: woh pichhle frame ke baad se circular search karta hai.
      const ordered = [...freeFrames];
      if (algorithm === "nextFit") {
        ordered.sort((a, b) =>
          ((a.frame - nextStart + frameCount) % frameCount) -
          ((b.frame - nextStart + frameCount) % frameCount));
      } else {
        ordered.sort((a, b) => a.frame - b.frame);
      }
      chosen = ordered.slice(0, pagesNeeded);
    }

    const entries = [];
    if (chosen) {
      for (const slot of chosen) {
        slot.processId = process.id;
        slot.page = entries.length;
        entries.push({ page: slot.page, frame: slot.frame });
      }
      if (algorithm === "nextFit") {
        nextStart = (chosen[chosen.length - 1].frame + 1) % frameCount;
      }
      pageTables.push({ processId: process.id, entries });
    }

    const pagesAllocated = chosen ? chosen.length : 0;
    const allocatedMemory = pagesAllocated * pageSize;

    allocations.push({
      processId: process.id,
      processSize: process.size,
      allocated: Boolean(chosen),
      pagesNeeded,
      pagesAllocated,
      frames: chosen ? chosen.map(slot => slot.frame) : [],
      // Aakhri page me bachi hui jagah - yeh hamesha pageSize se kam hoti hai.
      internalFragmentation: chosen ? allocatedMemory - process.size : 0,
      failureReason
    });

    const framesUsed = frames.filter(item => item.processId !== null).length;
    const usedMemory = framesUsed * pageSize;

    steps.push({
      processId: process.id,
      // Step caption ke liye - UI isse "Frame allocation: P1" jaisa label dikhata hai.
      operation: {
        type: "alloc",
        processId: process.id,
        ok: Boolean(chosen),
        detail: chosen
          ? `${pagesAllocated} page(s) placed in frame(s) ${chosen.map(slot => `F${slot.frame}`).join(", ")}`
          : failureReason
      },
      allocations: allocations.map(item => ({ ...item, frames: [...item.frames] })),
      pageTables: pageTables.map(table => ({ ...table, entries: table.entries.map(e => ({ ...e })) })),
      memory: snapshotFrames(frames, pageSize),
      metrics: {
        ...commonMetrics({ allocations, totalMemory: frameCount * pageSize, usedMemory }),
        mode: "paging",
        frameCount,
        framesUsed,
        framesFree: frameCount - framesUsed,
        internalFragmentation: allocations.reduce((sum, item) => sum + item.internalFragmentation, 0),
        pageTableSize: allocations.reduce((sum, item) => sum + item.pagesAllocated, 0),
        unusableMemory
      }
    });
  }

  const framesUsed = frames.filter(item => item.processId !== null).length;
  const usedMemory = framesUsed * pageSize;
  const totalMemory = frameCount * pageSize;

  return {
    mode: "paging",
    // Static paging: saare pages up-front. (Demand paging abhi implement nahi hai.)
    pagingType: "static",
    algorithm,
    pageSize,
    physicalMemory,
    frameCount,
    unusableMemory,
    allocations,
    pageTables,
    steps,
    totalMemory,
    usedMemory,
    summary: steps.at(-1)?.metrics || emptySummary({
      mode: "paging",
      totalMemory,
      frameCount,
      framesUsed: 0,
      framesFree: frameCount,
      internalFragmentation: 0,
      pageTableSize: 0,
      unusableMemory
    })
  };
}
