import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "{{name}}",
  description: "{{vision}}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="{{lang}}">
      <body className="min-h-screen bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
