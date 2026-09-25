import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ResQ — Evidence-first incident analyst",
  description:
    "Reconstruct incident evidence, verify cited hypotheses, and export a reviewable incident brief.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
