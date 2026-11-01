// Segmentation ka segment table: har resident segment ka base address aur limit.
// Ye table hamesha current regions se banti hai, isliye compaction ke baad base
// addresses automatically update ho jate hain.
export default function SegmentTable({ segmentTable }) {
  if (!segmentTable?.length) return <p className="empty-note">No segments are resident right now.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Process</th><th>Segment</th><th>Base</th><th>Limit</th><th>Range</th></tr>
        </thead>
        <tbody>
          {segmentTable.map(row => (
            <tr key={`${row.processId}-${row.segment}-${row.base}`}>
              <td>{row.processId}</td>
              <td>{row.segment}</td>
              <td className="mono">{row.base}</td>
              <td className="mono">{row.limit} KB</td>
              <td className="mono">{row.base} – {row.base + row.limit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
