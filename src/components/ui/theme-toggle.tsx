"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};

type ThemeToggleProps = Pick<
  ComponentProps<typeof Button>,
  "variant" | "size" | "className"
>;

export function ThemeToggle({
  variant = "ghost",
  size = "icon-sm",
  className,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const isDark = resolvedTheme === "dark";
  const title = isHydrated
    ? isDark
      ? "Notion Light"
      : "NVIDIA Dark"
    : "Toggle theme";

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={title}
      aria-label="Toggle theme"
      className={className}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
