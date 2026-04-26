interface ScaleChartProps {
  scaleName: string;
  notes: string[];
}

export default function ScaleChart({ scaleName, notes }: ScaleChartProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-bold text-gray-900">{scaleName}</h3>
      </div>
      <div className="p-6 flex flex-wrap gap-3">
        {notes.map((note, idx) => (
          <div key={idx} className="w-12 h-12 rounded-full border-2 border-blue-200 bg-blue-50 text-blue-800 flex items-center justify-center font-bold text-lg shadow-sm">
            {note}
          </div>
        ))}
      </div>
    </div>
  );
}
