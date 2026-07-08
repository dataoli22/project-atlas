import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Project Atlas",
  description: "Shared shell scaffold for endurance and nutrition workspaces."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
