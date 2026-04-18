import EditorClient from "@/components/editor-client";

export default async function EditorPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return (
    <div className="flex-1">
      <main className="mx-auto flex w-full max-w-6xl flex-col px-4 pt-20 pb-8">
        <EditorClient jobId={jobId} />
      </main>
    </div>
  );
}
