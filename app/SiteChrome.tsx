"use client";

import { usePathname } from "next/navigation";

export default function SiteChrome({
  children,
  publicSiteChrome,
}: {
  children: React.ReactNode;
  publicSiteChrome: React.ReactNode;
}) {
  const pathname = usePathname();

  const isGymDashboard =
    pathname?.startsWith("/gym-dashboard") &&
    pathname !== "/gym-dashboard/trial";

  if (isGymDashboard) {
    return <>{children}</>;
  }

  return <>{publicSiteChrome}</>;
}