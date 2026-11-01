export function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Har mode ke columns alag hain, isliye CSV bhi mode ke hisaab se banta hai.
function csvRows(result) {
  const mode = result.mode || "contiguous";

  if (mode === "paging") {
    const rows = [["Process", "Size KB", "Pages Needed", "Pages Allocated", "Frames", "Internal Frag KB", "Status"]];
    result.allocations.forEach(row => rows.push([
      row.processId,
      row.processSize,
      row.pagesNeeded,
      row.pagesAllocated,
      row.frames.map(frame => `F${frame}`).join(" "),
      row.internalFragmentation,
      row.allocated ? "Allocated" : "Not allocated"
    ]));
    return rows;
  }

  if (mode === "segmentation") {
    const rows = [["Process", "Requested KB", "Segments Placed", "Placement", "Compacted", "Status"]];
    result.allocations.forEach(row => rows.push([
      row.processId,
      row.processSize,
      row.allocated ? row.segments.length : 0,
      row.allocated ? row.segments.map(segment => `${segment.name}@${segment.base}`).join(" ") : "",
      row.allocated && row.compacted ? "Yes" : "No",
      row.released ? "Released" : row.allocated ? "Allocated" : "Not allocated"
    ]));
    return rows;
  }

  const rows = [["Process", "Size KB", "Block", "Remaining KB", "Allocated"]];
  result.allocations.forEach(row => rows.push([
    row.processId, row.processSize, row.blockId || "", row.remainingInBlock ?? "", row.allocated ? "Yes" : "No"
  ]));
  return rows;
}

export function exportCSV(result) {
  const rows = csvRows(result);
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `memory-${result.mode || "contiguous"}-results.csv`;
  link.click();
  URL.revokeObjectURL(url);
}