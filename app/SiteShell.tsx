"use client";

import { usePathname } from "next/navigation";
import Header from "./components/Header"; // adjust path if different

export default function SiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isGymDashboard = pathname?.startsWith("/gym-dashboard");

  if (isGymDashboard) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main>{children}</main>
    </>
  );
}