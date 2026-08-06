"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/assign-users", label: "Assign Users" },
];

const futureItems = [
  "Team Mapping",
  "Organization Viewer",
  "User Lookup",
  "View as Organization",
  "Imports",
  "System",
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-950 text-white lg:block">
      <div className="border-b border-slate-800 px-6 py-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          Elite Cheer Stats
        </div>
        <div className="mt-2 text-xl font-bold">Admin Console</div>
      </div>

      <nav className="space-y-1 p-4">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-xl px-4 py-3 text-sm font-medium transition",
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}

        <div className="pt-5">
          <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Coming soon
          </div>

          {futureItems.map((item) => (
            <div
              key={item}
              className="cursor-not-allowed rounded-xl px-4 py-3 text-sm text-slate-600"
            >
              {item}
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}
