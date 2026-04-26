export default function LessonProgress({ slug }: { slug: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">
          学习进度：<span className="text-blue-600">0%</span>
        </div>
        <div className="w-full max-w-md mx-4 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full w-0 transition-all duration-500 ease-in-out" />
        </div>
        <button className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md transition-colors">
          完成本节
        </button>
      </div>
    </div>
  );
}
