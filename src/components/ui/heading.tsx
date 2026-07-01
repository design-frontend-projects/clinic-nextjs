import React from "react";

interface HeadingProps {
  title: string;
  description?: string;
  size?: "display-xl" | "display-lg" | "heading-xl" | "heading-lg" | "heading-md" | "heading-sm";
}

export function Heading({ title, description, size = "heading-xl" }: HeadingProps) {
  const sizeClasses = {
    "display-xl": "text-6xl font-semibold tracking-tight text-ink",
    "display-lg": "text-5xl font-medium tracking-tight text-ink",
    "heading-xl": "text-2xl font-medium text-ink",
    "heading-lg": "text-xl font-medium text-ink",
    "heading-md": "text-lg font-medium text-ink",
    "heading-sm": "text-base font-medium text-ink",
  };

  return (
    <div>
      <h2 className={sizeClasses[size]}>{title}</h2>
      {description && (
        <p className="text-sm text-mute font-inter">{description}</p>
      )}
    </div>
  );
}