"use client";

// Renders the right input for a setting definition's value_type — the only
// definition-driven ("generated") form in the module. Tenant tabs use
// hand-written forms instead.
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface DefinitionLike {
  key: string;
  value_type: string;
  validation: unknown;
}

interface DefinitionValueFieldProps {
  definition: DefinitionLike;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function DefinitionValueField({ definition, value, onChange }: DefinitionValueFieldProps) {
  const rules = (definition.validation ?? {}) as { enum?: string[]; min?: number; max?: number };

  switch (definition.value_type) {
    case "boolean":
      return <Switch checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />;

    case "number":
      return (
        <Input
          type="number"
          className="w-40"
          min={rules.min}
          max={rules.max}
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        />
      );

    case "enum":
      return (
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(rules.enum ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "color":
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-9 w-10 cursor-pointer rounded-md border border-input bg-transparent p-1"
            value={typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
            onChange={(event) => onChange(event.target.value)}
          />
          <Input
            className="w-32 font-mono"
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );

    case "string":
    case "email":
      return (
        <Input
          type={definition.value_type === "email" ? "email" : "text"}
          className="w-72"
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    // json / weekly_schedule: raw JSON editing (validated server-side).
    default:
      return (
        <Textarea
          rows={3}
          className="w-full font-mono text-xs"
          value={JSON.stringify(value ?? null, null, 2)}
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value));
            } catch {
              // Keep typing; invalid JSON is rejected server-side on save.
            }
          }}
        />
      );
  }
}
