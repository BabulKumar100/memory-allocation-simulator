// Paging ka page table: kaunse process ka kaunsa page kis frame me gaya.
export default function PageTable({ pageTables, pageSize }) {
  const rows = (pageTables || []).flatMap(table =>
    table.entries.map(entry => ({ ...entry, processId: table.processId })));

  if (!rows.length) return <p className="empty-note">No pages are resident yet.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Process</th><th>Page</th><th>Frame</th><th>Page size</th><th>Physical address</th></tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={`${row.processId}-${row.page}`}>
              <td>{row.processId}</td>
              <td className="mono">{row.page}</td>
              <td className="mono">F{row.frame}</td>
              <td className="mono">{pageSize} KB</td>
              <td className="mono">{row.frame * pageSize} – {(row.frame + 1) * pageSize}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
