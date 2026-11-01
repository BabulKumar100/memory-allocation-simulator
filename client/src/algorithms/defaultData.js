// Contiguous mode: classic textbook workload.
export const defaultBlocks = [
  { id: "Block 1", size: 100 },
  { id: "Block 2", size: 500 },
  { id: "Block 3", size: 200 },
  { id: "Block 4", size: 300 },
  { id: "Block 5", size: 600 }
];

export const defaultProcesses = [
  { id: "P1", size: 212 },
  { id: "P2", size: 417 },
  { id: "P3", size: 112 },
  { id: "P4", size: 426 }
];

// Paging mode: 64 KB / 4 KB = 16 frames, aur 10/6/5 KB ke processes
// (P1 -> 3 pages, P2 -> 2 pages, P3 -> 2 pages).
export const defaultPaging = {
  physicalMemory: 64,
  pageSize: 4
};

// Segment names jo segmentation mode me select kar sakte hain.
export const SEGMENT_NAMES = ["Code", "Data", "Stack", "Heap", "BSS"];

// Segmentation mode: yeh operation list release + compaction dono dikhati hai.
// P2 ko release karne se beech me hole ban jata hai, aur phir P4 (400 KB) ke liye
// total free kaafi hone par bhi koi single hole kaafi bada nahi hota - isliye
// engine compaction lagata hai.
export const defaultSegmentation = {
  physicalMemory: 1000,
  operations: [
    { id: "P1", segments: [{ name: "Code", size: 200 }, { name: "Data", size: 150 }] },
    { id: "P2", segments: [{ name: "Code", size: 300 }] },
    { id: "P3", segments: [{ name: "Code", size: 200 }] },
    { id: "P2", release: true },
    { id: "P4", segments: [{ name: "Code", size: 400 }] }
  ]
};
