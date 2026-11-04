import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE_NOINDEX, SITE_ORIGIN } from "@/lib/env";
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
  // SITE_NOINDEX=1 on the preview host (new.brighttv.co.th) until the cutover.
  robots: SITE_NOINDEX ? { index: false, follow: false } : { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "BRIGHT TV",
    locale: "th_TH",
    // Default og:image used when a page doesn't set its own (homepage,
    // category, tag, author, search). Article pages override this with
    // their featured image via generateMetadata.
    images: [
      {
        url: "https://cdn.brighttv.co.th/wp-content/uploads/2017/07/04102155/brighttv-default.jpg",
        width: 1200,
        height: 630,
        alt: "BRIGHT TV",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      "https://cdn.brighttv.co.th/wp-content/uploads/2017/07/04102155/brighttv-default.jpg",
    ],
  },
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
