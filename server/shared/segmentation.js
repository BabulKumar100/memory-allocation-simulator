// Segmentation engine.
//
// Physical memory ek address-ordered region list hai. Har region ya to kisi
// process ke segment ka owner hai, ya free hole hai.
//
//   allocate -> hole split hota hai
//   release  -> process ke segments free hote hain, aur adjacent holes coalesce (merge) hote hain
//
// Segmentation me har segment contiguous hona chahiye, isliye EXTERNAL
// fragmentation paida hoti hai: total free memory kaafi ho sakti hai, par koi
// single hole itna bada nahi hota. Compaction usi ka ilaaj hai.
//
// Do alag metrics hain, inko mix mat karein:
//   freeMemory            = poori free memory (kitni jagah khaali hai)
//   largestHole           = sabse bada single free hole
//   externalFragmentation = freeMemory - largestHole
//                           yani woh free memory jo kisi ek hole me fit nahi hoti.
// Agar saari free memory ek hi contiguous hole me hai, to external fragmentation 0 hai.
//
// Note: sirf allocate karte rehne se holes paida nahi hote (free space ek hi
// contiguous tail hole rehta hai), isliye fragmentation dikhane ke liye
// "release" operation zaroori hai. Isliye input ek operation list hai.
//
// All-or-nothing: agar kisi process ka ek bhi segment na baith paye, to poori
// process rollback ho jati hai (real OS me aadha-baitha process nahi banta).

import { ALGORITHMS, commonMetrics, emptySummary, round1 } from "./common.js";

// Segment table hamesha actual regions se banate hain, taaki compaction ke baad
// base addresses automatically sahi rahen.
function buildSegmentTable(regionList) {
  return regionList
    .filter(region => region.owner)
    .map(region => ({
      processId: region.owner.processId,
      segment: region.owner.segment,
      base: region.start,
      limit: region.size
    }))
    .sort((a, b) => a.processId.localeCompare(b.processId) || a.base - b.base);
}

// MemoryMap isi shape ko padhta hai.
function snapshotRegions(regionList) {
  return [...regionList].sort((a, b) => a.start - b.start).map(region => ({
    blockId: region.owner ? `${region.owner.processId}.${region.owner.segment}` : `free-${region.start}`,
    label: region.owner ? `${region.owner.processId} · ${region.owner.segment}` : `Free ${region.size} KB`,
    start: region.start,
    size: region.size,
    allocated: region.owner
      ? [{ processId: region.owner.processId, size: region.size, detail: region.owner.segment }]
      : [],
    remaining: region.owner ? 0 : region.size
  }));
}

const totalFree = regionList => regionList.filter(r => !r.owner).reduce((sum, r) => sum + r.size, 0);
const largestHole = regionList => regionList.filter(r => !r.owner).reduce((max, r) => Math.max(max, r.size), 0);

export function simulateSegmentation({ algorithm, physicalMemory, processes }) {
  if (!ALGORITHMS.includes(algorithm)) throw new Error("Unsupported allocation algorithm.");

  let regions = [{ start: 0, size: physicalMemory, owner: null }];
  const allocations = [];
  const operations = [];
  const steps = [];
  let nextStart = 0;
  let compactionCount = 0;

  function pickHole(size) {
    const fitting = regions
      .map((region, index) => ({ region, index }))
      .filter(({ region }) => !region.owner && region.size >= size);

    if (!fitting.length) return null;
    if (algorithm === "firstFit") return fitting[0];
    if (algorithm === "bestFit") return [...fitting].sort((a, b) => a.region.size - b.region.size)[0];
    if (algorithm === "worstFit") return [...fitting].sort((a, b) => b.region.size - a.region.size)[0];
    return [...fitting].sort((a, b) =>
      ((a.region.start - nextStart + physicalMemory) % physicalMemory) -
      ((b.region.start - nextStart + physicalMemory) % physicalMemory))[0];
  }

  function place({ region }, size, owner) {
    const leftover = region.size - size;
    region.owner = owner;
    region.size = size;
    if (leftover > 0) {
      const index = regions.indexOf(region);
      regions.splice(index + 1, 0, { start: region.start + size, size: leftover, owner: null });
    }
    nextStart = region.start + size;
  }

  function coalesce() {
    regions.sort((a, b) => a.start - b.start);
    for (let i = 0; i < regions.length - 1; i += 1) {
      if (!regions[i].owner && !regions[i + 1].owner) {
        regions[i].size += regions[i + 1].size;
        regions.splice(i + 1, 1);
        i -= 1;
      }
    }
  }

  // Compaction sirf tab jab requested segment ke liye TOTAL free memory kaafi ho,
  // lekin koi single hole itna bada na ho. Sirf total free dekhkar memory shift
  // nahi karte, warna bina zaroorat ke poora address space hilti rehti hai.
  function compactIfNeeded(size) {
    if (largestHole(regions) >= size) return false;
    if (totalFree(regions) < size) return false;

    const used = regions.filter(region => region.owner).sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const region of used) {
      region.start = cursor;
      cursor += region.size;
    }
    const freeSpace = physicalMemory - cursor;
    regions = freeSpace > 0 ? [...used, { start: cursor, size: freeSpace, owner: null }] : [...used];
    compactionCount += 1;
    return true;
  }

  function pushStep(operation) {
    const free = totalFree(regions);
    const largest = largestHole(regions);
    const usedMemory = physicalMemory - free;
    steps.push({
      processId: operation.processId,
      operation,
      allocations: allocations.map(item => ({
        ...item,
        segments: item.segments.map(segment => ({ ...segment }))
      })),
      segmentTable: buildSegmentTable(regions),
      memory: snapshotRegions(regions),
      metrics: {
        ...commonMetrics({ allocations, totalMemory: physicalMemory, usedMemory }),
        mode: "segmentation",
        physicalMemory,
        // Free memory alag metric hai; external fragmentation sirf woh hissa hai
        // jo kisi ek hole me fit nahi hoti (total free - largest hole).
        largestHole: largest,
        externalFragmentation: round1(free - largest),
        holesCount: regions.filter(region => !region.owner).length,
        compactions: compactionCount,
        releasedProcesses: allocations.filter(item => item.released).length,
        segmentsResident: buildSegmentTable(regions).length
      }
    });
  }

  for (const item of processes) {
    // ---- Release operation: is process ke segments wapas free kar do ----
    if (item.release) {
      const owned = regions.filter(region => region.owner && region.owner.processId === item.id);
      for (const region of owned) region.owner = null;
      coalesce();

      const target = allocations.filter(a => a.processId === item.id && a.allocated && !a.released).at(-1);
      if (target) target.released = true;

      const operation = {
        type: "free",
        processId: item.id,
        ok: owned.length > 0,
        detail: owned.length
          ? `Released ${owned.length} segment(s), ${owned.reduce((sum, r) => sum + r.size, 0)} KB freed`
          : "Nothing to release for this process"
      };
      operations.push(operation);
      pushStep(operation);
      continue;
    }

    // ---- Allocation operation (all-or-nothing) ----
    const requested = item.segments;
    const requestedTotal = requested.reduce((sum, segment) => sum + segment.size, 0);

    // Rollback ke liye poora state pehle hi save kar lete hain.
    const before = regions.map(region => ({ ...region }));
    const compactionsBefore = compactionCount;
    const nextStartBefore = nextStart;

    let failureReason = null;
    let compactedThisProcess = false;

    for (const segment of requested) {
      let hole = pickHole(segment.size);
      if (!hole && compactIfNeeded(segment.size)) {
        compactedThisProcess = true;
        hole = pickHole(segment.size);
      }
      if (!hole) {
        const free = totalFree(regions);
        failureReason = free < segment.size
          ? `${segment.name} needs ${segment.size} KB but only ${free} KB is free in total.`
          : `${segment.name} needs ${segment.size} KB but the largest hole is only ${largestHole(regions)} KB.`;
        break;
      }
      place(hole, segment.size, { processId: item.id, segment: segment.name });
    }

    if (failureReason) {
      // All-or-nothing: jo segments baithe the woh bhi hata do.
      regions = before;
      compactionCount = compactionsBefore;
      nextStart = nextStartBefore;

      allocations.push({
        processId: item.id,
        processSize: requestedTotal,
        allocated: false,
        released: false,
        segments: [],
        compacted: false,
        failureReason
      });
      const operation = { type: "alloc", processId: item.id, ok: false, detail: failureReason };
      operations.push(operation);
      pushStep(operation);
      continue;
    }

    // Base addresses regions se hi nikaalo - compaction ne kuch shift kiya ho to bhi sahi rahe.
    const placed = regions
      .filter(region => region.owner && region.owner.processId === item.id)
      .map(region => ({ name: region.owner.segment, base: region.start, limit: region.size, size: region.size }))
      .sort((a, b) => a.base - b.base);

    allocations.push({
      processId: item.id,
      processSize: requestedTotal,
      allocated: true,
      released: false,
      segments: placed,
      compacted: compactedThisProcess,
      failureReason: null
    });

    const operation = {
      type: "alloc",
      processId: item.id,
      ok: true,
      compacted: compactedThisProcess,
      detail: `${placed.length} segment(s) at ${placed.map(s => s.base).join(", ")}${compactedThisProcess ? " (compaction applied)" : ""}`
    };
    operations.push(operation);
    pushStep(operation);
  }

  const usedMemory = physicalMemory - totalFree(regions);

  return {
    mode: "segmentation",
    algorithm,
    physicalMemory,
    allocations,
    operations,
    segmentTable: buildSegmentTable(regions),
    steps,
    totalMemory: physicalMemory,
    usedMemory,
    summary: steps.at(-1)?.metrics || emptySummary({
      mode: "segmentation",
      totalMemory: physicalMemory,
      physicalMemory,
      // Kuch bhi allocate nahi hua to poori memory ek hi hole hai -> external fragmentation 0.
      externalFragmentation: 0,
      largestHole: physicalMemory,
      holesCount: 1,
      compactions: 0,
      releasedProcesses: 0,
      segmentsResident: 0
    })
  };
}
