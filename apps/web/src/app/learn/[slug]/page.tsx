import { notFound, redirect } from 'next/navigation';
import { getSongManifest } from '../_lib/queries';

export default async function SongLessonOverviewPage({
  params,
}: {
  params: any;
}) {
  const { slug } = await params;
  const manifest = await getSongManifest(slug);

  if (!manifest) {
    notFound();
  }

  // By default, redirect to the warmup module
  redirect(`/learn/${slug}/warmup`);
}
