export interface QueueColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

export default function QueueTable<T extends { id: string }>({
  columns,
  rows,
  emptyText,
}: {
  columns: QueueColumn<T>[];
  rows: T[];
  emptyText: string;
}) {
  if (rows.length === 0) return <p className="text-gray-500">{emptyText}</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          {columns.map((c) => (
            <th key={c.header} className="py-2 pr-4">
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b">
            {columns.map((c) => (
              <td key={c.header} className="py-2 pr-4">
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
