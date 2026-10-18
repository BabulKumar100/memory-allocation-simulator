export function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
export function exportCSV(result) {
  const rows = [["Process", "Size KB", "Block", "Remaining KB", "Allocated"]];
  result.allocations.forEach(r => rows.push([r.processId, r.processSize, r.blockId || "", r.remainingInBlock ?? "", r.allocated ? "Yes" : "No"]));
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a"); link.href = url; link.download = "memory-allocation-results.csv"; link.click();
  URL.revokeObjectURL(url);
}