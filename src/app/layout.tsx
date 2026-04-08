import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
  metadataBase: new URL("https://www.brighttv.co.th"),
  openGraph: { type: "website", siteName: "BRIGHT TV", locale: "th_TH" },
  icons: { icon: "/logo.svg" },
};

const siteSchemas = [organizationSchema(), websiteSchema()];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
      </head>
      <body className="min-h-full flex flex-col bg-white">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
