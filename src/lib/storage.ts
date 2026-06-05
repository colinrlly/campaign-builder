export const MAP_BUCKET = "maps";

/** Public URL for an object in the public `maps` storage bucket. */
export function mapImageUrl(imagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${MAP_BUCKET}/${imagePath}`;
}
