// Curated category navigation for the redesigned Bright TV site.
// IDs match brighttv.co.th WP REST API.

export type NavCategory = {
  id: number;
  slug: string; // slug used for our /category/[slug] route
  name: string;
  accent?: string; // tailwind class
};

export const PRIMARY_NAV: NavCategory[] = [
  { id: 24972, slug: "news", name: "ข่าวเด่น" },
  { id: 8, slug: "politics", name: "การเมือง" },
  { id: 3, slug: "social", name: "สังคม" },
  { id: 7, slug: "crime", name: "อาชญากรรม" },
  { id: 3810, slug: "economy", name: "เศรษฐกิจ" },
  { id: 5, slug: "entertain", name: "บันเทิง" },
  { id: 76653, slug: "global", name: "ต่างประเทศ" },
  { id: 9, slug: "sports", name: "กีฬา" },
  { id: 7466, slug: "lifestyle", name: "ไลฟ์สไตล์" },
  { id: 91633, slug: "health", name: "สุขภาพ" },
  { id: 14322, slug: "horoscope", name: "ดูดวง" },
];

// Sections shown on the homepage
export const HOMEPAGE_SECTIONS: NavCategory[] = [
  { id: 8, slug: "politics", name: "การเมือง" },
  { id: 3810, slug: "economy", name: "เศรษฐกิจ" },
  { id: 5, slug: "entertain", name: "บันเทิง" },
  { id: 7, slug: "crime", name: "อาชญากรรม" },
  { id: 76653, slug: "global", name: "ต่างประเทศ" },
  { id: 9, slug: "sports", name: "กีฬา" },
  { id: 7466, slug: "lifestyle", name: "ไลฟ์สไตล์" },
  { id: 91633, slug: "health", name: "สุขภาพ" },
];

export function findNavBySlug(slug: string): NavCategory | undefined {
  return PRIMARY_NAV.find((c) => c.slug === slug);
}
