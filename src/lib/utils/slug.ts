export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = toSlug(base);
  let suffix = 0;
  while (await exists(slug)) {
    suffix += 1;
    slug = `${toSlug(base)}-${suffix}`;
  }
  return slug;
}
