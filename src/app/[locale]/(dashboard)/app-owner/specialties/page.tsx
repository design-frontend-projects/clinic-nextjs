import { getSpecialties } from "@/app/actions/app-owner/specialties";
import {
  SpecialtiesView,
  type SerializedSpecialty,
} from "@/components/app-owner/specialties-view";

export default async function SpecialtiesPage() {
  const specialties = await getSpecialties();

  const serialized: SerializedSpecialty[] = specialties.map((item) => ({
    id: item.id,
    name: item.name,
    name_ar: item.name_ar,
    description: item.description,
    display_order: item.display_order,
    is_active: item.is_active,
    doctorsCount: item._count?.doctor_specialties ?? 0,
  }));

  return <SpecialtiesView specialties={serialized} />;
}
