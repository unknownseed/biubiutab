import { NavLink } from "react-router-dom";

export type LessonNavProps = {
  slug: string;
  availableModules: string[];
};

function tabClassName({ isActive }: { isActive: boolean }) {
  return `px-3 py-2 text-sm tracking-widest border-b-2 transition-colors ${isActive ? "border-retro-green text-retro-green" : "border-transparent text-ink-700/70 hover:text-ink-900"}`;
}

export default function LessonNav({ slug, availableModules }: LessonNavProps) {
  return (
    <div className="flex items-center gap-4 border-b border-paper-300">
      {availableModules.map((m) => (
        <NavLink key={m} to={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(m)}`} className={tabClassName}>
          {m === "warmup" ? "預習" : m === "basic" ? "基礎" : m === "advanced" ? "進階" : m === "solo" ? "Solo" : m}
        </NavLink>
      ))}
    </div>
  );
}
