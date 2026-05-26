import { useSubscription } from "../hooks/useSubscription";

export type PanelId = "tabs" | "learn" | "ai" | "admin";

type SidebarProps = {
  activePanel: PanelId;
  onPanelChange: (p: PanelId) => void;
};

const ITEMS: { id: PanelId; label: string; icon: string }[] = [
  { id: "tabs", label: "Tabs", icon: "📁" },
  { id: "learn", label: "Learn", icon: "🎓" },
  { id: "ai", label: "AI", icon: "⚙️" },
  { id: "admin", label: "Admin", icon: "🔧" },
];

export default function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  const { info: sub } = useSubscription();

  return (
    <div className="flex flex-col items-center w-[64px] h-full bg-zinc-900 border-r border-zinc-800 py-4 gap-2 shrink-0">
      <div className="mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a7c59" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3" strokeLinecap="round" />
          <circle cx="18" cy="16" r="3" strokeLinecap="round" />
        </svg>
      </div>

      {ITEMS.map((item) => {
        const active = activePanel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onPanelChange(item.id)}
            className={`flex flex-col items-center justify-center w-11 h-11 rounded-md text-[10px] tracking-wider transition-colors ${
              active
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
            title={item.label}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="mt-0.5">{item.label}</span>
          </button>
        );
      })}

      <div className="mt-auto mb-2">
        {sub.isPro ? (
          <span className="text-[10px] font-semibold tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">
            Pro
          </span>
        ) : (
          <span className="text-[10px] font-semibold tracking-widest text-zinc-500 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded">
            Free
          </span>
        )}
      </div>
    </div>
  );
}
