export type Map = {
  id: string;
  name: string;
  image_path: string;
  natural_width: number;
  natural_height: number;
  created_at: string;
};

export type Article = {
  id: string;
  title: string;
  body_markdown: string;
  updated_at: string;
};

/**
 * A clickable region on a map. The bounding box is stored as fractions of the
 * natural image dimensions (each value in [0, 1]) so it stays correct at any
 * zoom level, screen size, or re-export of the same map.
 */
export type Location = {
  id: string;
  map_id: string;
  article_id: string | null;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  created_at: string;
};

/** A normalized bounding box (fractions of the natural image, 0..1). */
export type Box = { x: number; y: number; w: number; h: number };
