import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE_NOINDEX, SITE_ORIGIN } from "@/lib/env";
import { getGlobalStylesCss } from "@/lib/wp";
import { DEFAULT_OG_IMAGE, SITE_NAME, TWITTER_SITE, organizationSchema, websiteSchema } from "@/lib/schema";

const HOME_TITLE = `${SITE_NAME} | อ่านข่าวออนไลน์ หวยงวดนี้ ทีวีออนไลน์ ทันทุกสถานการณ์`;
const HOME_DESCRIPTION =
  "ไบรท์ทีวี (BRIGHT TV) สำนักข่าวออนไลน์ เกาะติดทุกสถานการณ์ ข่าวการเมือง สังคม เศรษฐกิจ บันเทิง ต่างประเทศ กีฬา ตรวจหวยงวดนี้ และทีวีออนไลน์ ครบจบในที่เดียว";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  // Home title carries the keywords www ranks for ("อ่านข่าวออนไลน์ หวยงวดนี้ ทีวีออนไลน์").
  title: {
    default: HOME_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: HOME_DESCRIPTION,
  metadataBase: new URL(SITE_ORIGIN),
  // Explicit robots directive so crawlers don't guess.
  // SITE_NOINDEX=1 on the preview host (new.brighttv.co.th) until the cutover.
  robots: SITE_NOINDEX
    ? { index: false, follow: false }
    : { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  // "/" is the home page's canonical/og:url; every other page sets its own.
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed" } },
  openGraph: {
    type: "website",
    // No og:url here: pages that don't set their own would all claim the home page.
    // (og/twitter title + description are filled from each page's own title/description)
    siteName: SITE_NAME,
    locale: "th_TH",
    // Default og:image used when a page doesn't set its own (homepage,
    // category, tag, author, search). Article pages override this with
    // their featured image via generateMetadata.
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_SITE,
    images: [DEFAULT_OG_IMAGE.url],
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
