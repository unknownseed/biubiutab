import EditorClient from "@/components/editor-client";

export default async function EditorPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-sm text-zinc-600">编辑/导出</div>
            <h1 className="text-2xl font-semibold tracking-tight">Guitar Tab AI</h1>
          </div>
          <a className="text-sm font-medium text-zinc-900 underline" href="/">
            返回
          </a>
        </header>
        <EditorClient jobId={jobId} />
      </main>
    </div>
  );
}

