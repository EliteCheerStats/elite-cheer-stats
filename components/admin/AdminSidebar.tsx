"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    items: [
      {
        href: "/admin",
        label: "Dashboard",
      },
    ],
  },
  {
    label: "Onboarding",
    items: [
      {
        href: "/admin/trial-requests",
        label: "Onboarding Queue",
      },
      {
        href: "/admin/assign-users",
        label: "Assign Users",
      },
    ],
  },
  {
    label: "Organizations",
    items: [],
  },
  {
    label: "Operations",
    items: [],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-950 text-white lg:block">
      <div className="border-b border-slate-800 px-6 py-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          Elite Cheer Stats
        </div>

        <div className="mt-2 text-xl font-bold">
          Gym Dashboard Admin
        </div>
      </div>

      <nav className="space-y-6 p-4">
        {sections.map((section, sectionIndex) => (
          <div key={section.label ?? `section-${sectionIndex}`}>
            {section.label && (
              <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {section.label}
              </div>
            )}

            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);

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

              {section.items.length === 0 && (
                <div className="px-4 py-2 text-sm text-slate-600">
                  No tools yet
                </div>
              )}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}