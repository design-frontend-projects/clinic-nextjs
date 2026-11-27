import { z } from "zod";
import { diagramKeyEnum, type DiagramKey } from "@/types/body-chart.types";

/** Create/update payload for a medical specialty (app-owner catalog). */
export const specialtySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Specialty name is required"),
  name_ar: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  diagram_key: diagramKeyEnum.default("general_body"),
  is_active: z.boolean().default(true),
  display_order: z.coerce.number().int().min(0).default(0),
});

export type SpecialtyFormData = z.input<typeof specialtySchema>;
export type SpecialtyData = z.output<typeof specialtySchema>;

/** Active-catalog row exposed to the onboarding step (locale-aware label). */
export interface ActiveSpecialty {
  id: string;
  name: string;
  name_ar: string | null;
  diagram_key?: DiagramKey | string | null;
}
