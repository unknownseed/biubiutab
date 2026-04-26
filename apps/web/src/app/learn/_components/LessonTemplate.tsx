import { ReactNode } from 'react';

interface LessonTemplateProps {
  title: string;
  description: string;
  children: ReactNode;
}

export default function LessonTemplate({ title, description, children }: LessonTemplateProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 text-base leading-relaxed">{description}</p>
      </div>
      
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}
