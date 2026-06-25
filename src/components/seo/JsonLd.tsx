/** Renders a JSON-LD <script> for structured data (schema.org). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Content is server-generated from trusted data.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
