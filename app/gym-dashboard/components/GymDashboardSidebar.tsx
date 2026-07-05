"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type GymDashboardSidebarProps = {
  organizationName: string;
  role?: string;
};

const navItems = [
  { label: "Gym Overview", href: "/gym-dashboard" },
  { label: "Team Intelligence", href: "/gym-dashboard/team-intelligence" },
  { label: "Division Intelligence", href: "/gym-dashboard/division-intelligence" },
  { label: "Competition Simulator", href: "/gym-dashboard/competition-simulator" },
];

export default function GymDashboardSidebar({
  organizationName,
  role = "Owner",
}: GymDashboardSidebarProps) {
  const pathname = usePathname();

  const initials = organizationName
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950 px-4 py-5 text-white">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-lg font-black">
          {initials}
        </div>

        <div>
          <div className="text-xl font-black leading-tight">{organizationName}</div>
          <div className="text-xs font-bold tracking-[0.28em] text-blue-400">
            GYM DASHBOARD
          </div>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/gym-dashboard"
              ? pathname === "/gym-dashboard"
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-4 py-3 text-sm font-semibold ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-200 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        <div>
          <div className="mb-2 text-sm text-slate-300">Current Season</div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-bold">
            2025–2026
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <Link
            href="/"
            className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            ← Back to ECS
          </Link>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-black">
            {initials}
          </div>

          <div>
            <div className="font-bold">{organizationName}</div>
            <div className="text-sm text-slate-400">{role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}