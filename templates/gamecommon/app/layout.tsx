import type { Metadata, Viewport } from "next";
import { body, display } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "{{name}}",
  description: "{{vision}}",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="{{lang}}" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
