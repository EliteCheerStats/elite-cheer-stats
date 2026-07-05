import type { ReactNode } from "react";

export const metadata = {
  title: "Gym Dashboard | Elite Cheer Stats",
  description: "Private gym performance intelligence dashboard.",
};

export default function GymDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}