import { getPatientDetails } from "@/app/actions/doctor";
import { ConsultationClient } from "./consultation-client";
import type { PatientPrescription } from "./patient-prescriptions";

export default async function PatientConsultationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  const resolvedParams = await params;
  const { appointmentId } = await searchParams;
  const { patient, history, prescriptions, labOrders } =
    await getPatientDetails(resolvedParams.id);

  return (
    <ConsultationClient
      patient={patient}
      history={history}
      prescriptions={prescriptions as PatientPrescription[]}
      labOrders={labOrders}
      appointmentId={appointmentId}
    />
  );
}
