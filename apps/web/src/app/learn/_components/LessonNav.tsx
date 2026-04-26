'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function LessonNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  const steps = [
    { id: 'warmup', label: '1. 预习' },
    { id: 'basic', label: '2. 基础' },
    { id: 'advanced', label: '3. 进阶' },
    { id: 'solo', label: '4. Solo 创作' }
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto flex overflow-x-auto no-scrollbar">
        {steps.map((step) => {
          const href = `/learn/${slug}/${step.id}`;
          const isActive = pathname.startsWith(href);

          return (
            <Link
              key={step.id}
              href={href}
              className={[
                "flex-1 text-center py-4 px-6 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              ].filter(Boolean).join(' ')}
            >
              {step.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
