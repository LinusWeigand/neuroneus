import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { BRAND_TITLE, CANVAS_COLOR } from "@/lib/brand";
import { getT } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: BRAND_TITLE, template: `%s · ${BRAND_TITLE}` },
    description: t.meta.description,
  };
}

export const viewport: Viewport = {
  themeColor: CANVAS_COLOR,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getT();
  return (
    <html lang={locale} className={`${inter.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas text-ink">
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
