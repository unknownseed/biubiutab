import EditorClient from "@/components/editor-client";
import Link from "next/link";

export default async function EditorPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return (
    <div className="min-h-dvh">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium text-slate-500">编辑与导出</div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-950">谱例编辑</h1>
          </div>
          <Link className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50" href="/">
            返回上传
          </Link>
        </header>
        <EditorClient jobId={jobId} />
      </main>
    </div>
  );
}
