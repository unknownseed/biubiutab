import { NavLink } from "react-router-dom";

export type LessonNavProps = {
  slug: string;
  modules: { name: string; locked: boolean }[];
};

function tabClassName({ isActive }: { isActive: boolean }) {
  return `px-3 py-2 text-sm tracking-widest border-b-2 transition-colors ${isActive ? "border-retro-green text-retro-green" : "border-transparent text-ink-700/70 hover:text-ink-900"}`;
}

const labels: Record<string, string> = {
  warmup: "預習",
  basic: "基礎",
  advanced: "進階",
  solo: "Solo",
};

export default function LessonNav({ slug, modules }: LessonNavProps) {
  return (
    <div className="flex items-center gap-4 border-b border-paper-300">
      {modules.map(({ name, locked }) => (
        <NavLink
          key={name}
          to={locked ? "#" : `/learn/${encodeURIComponent(slug)}/${encodeURIComponent(name)}`}
          className={locked ? "px-3 py-2 text-sm tracking-widest border-b-2 border-transparent text-ink-700/40 cursor-not-allowed" : tabClassName}
          onClick={locked ? (e) => e.preventDefault() : undefined}
        >
          {labels[name] || name}
          {locked ? <span className="ml-1 text-xs">🔒</span> : null}
        </NavLink>
      ))}
    </div>
  );
}
