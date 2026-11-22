import React from "react";

interface HeadingProps {
  title: string;
  description?: string;
  size?:
    | "display-xl"
    | "display-lg"
    | "heading-xl"
    | "heading-lg"
    | "heading-md"
    | "heading-sm";
}

export function Heading({
  title,
  description,
  size = "heading-xl",
}: HeadingProps) {
  const sizeClasses = {
    "display-xl": "text-display-lg font-bold tracking-tight text-foreground",
    "display-lg": "text-display-md font-bold tracking-tight text-foreground",
    "heading-xl": "text-headline font-bold tracking-tight text-foreground",
    "heading-lg": "text-card-title font-bold text-foreground",
    "heading-md": "text-lg font-semibold text-foreground dark:font-bold",
    "heading-sm": "text-base font-semibold text-foreground dark:font-bold",
  };

  return (
    <div className="space-y-1">
      <h2 className={sizeClasses[size]}>{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
