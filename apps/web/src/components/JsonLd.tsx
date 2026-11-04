// Renders JSON-LD structured data. React 19 hoists <script async> tags into
// <head>, so any per-page schema rendered through this component ends up in
// the document head automatically.
export default function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((d, i) => (
        <script
          key={i}
          async
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }}
        />
      ))}
    </>
  );
}
