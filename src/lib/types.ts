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

/** A point as fractions of the natural image (each in [0, 1]). */
export type Point = { x: number; y: number };

/**
 * A clickable region on a map, defined by a polygon of normalized points
 * (each coordinate in [0, 1]). Normalized coords stay correct at any zoom
 * level, screen size, or re-export of the same map.
 */
export type Location = {
  id: string;
  map_id: string;
  article_id: string | null;
  label: string;
  points: Point[];
  created_at: string;
};
