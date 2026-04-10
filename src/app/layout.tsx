import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE_ORIGIN } from "@/lib/env";
import { getGlobalStylesCss } from "@/lib/wp";
import { organizationSchema, websiteSchema } from "@/lib/schema";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BRIGHT TV — สำนักข่าวออนไลน์ ทันทุกสถานการณ์",
    template: "%s | BRIGHT TV",
  },
  description:
    "ไบรท์ทีวี (Bright TV) สำนักข่าวออนไลน์ เกาะติดทุกสถานการณ์ ข่าวการเมือง สังคม เศรษฐกิจ บันเทิง ต่างประเทศ กีฬา และไลฟ์สไตล์ ครบจบในที่เดียว",
  metadataBase: new URL(SITE_ORIGIN),
  // Explicit robots directive so crawlers don't guess. Next.js auto-generates
  // a canonical <link> from metadataBase + the current pathname.
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "BRIGHT TV", locale: "th_TH" },
  icons: { icon: "/logo.svg" },
};

const siteSchemas = [organizationSchema(), websiteSchema()];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // theme.json-derived CSS variables and base block styles. Same site-wide,
  // long ISR cache, fetched once per request via Next.js fetch dedupe.
  const globalStylesCss = await getGlobalStylesCss();

  return (
    <html lang="th" className={`${notoThai.variable} h-full antialiased`}>
      <head>
        {/* Adobe Typekit — Thongterm font for article body */}
        <link rel="stylesheet" href="https://use.typekit.net/duc2sfh.css" />
        {/* Site-wide JSON-LD schemas */}
        {siteSchemas.map((schema, i) => (
          <script
            key={`site-schema-${i}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
        {globalStylesCss && (
          <style
            id="global-styles-inline-css"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: globalStylesCss }}
          />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-white">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
