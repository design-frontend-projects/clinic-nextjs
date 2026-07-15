// Server Component — pure presentational, no hooks or interactivity needed

import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
}

/** Renders a 1–5 star rating using filled/empty lucide stars. */
export function StarRating({ rating }: StarRatingProps) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={
            i < rating
              ? "h-3.5 w-3.5 fill-fin text-fin"
              : "h-3.5 w-3.5 text-muted-foreground/40"
          }
        />
      ))}
    </span>
  );
}
