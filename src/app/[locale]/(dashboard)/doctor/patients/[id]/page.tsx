import { getPatientDetails } from "@/app/actions/doctor";
import { getPatientBodyCharts } from "@/app/actions/body-chart";
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
  const [
    {
      patient,
      history,
      prescriptions,
      labOrders,
      currentDoctorProfileId,
      currentDoctorName,
      clinicName,
      canConfirmAllPatientLabs,
      isReadOnly,
      currentAppointment,
    },
    bodyChartContext,
  ] = await Promise.all([
    getPatientDetails(resolvedParams.id, appointmentId),
    getPatientBodyCharts(resolvedParams.id),
  ]);

  return (
    <ConsultationClient
      patient={patient}
      history={history}
      prescriptions={prescriptions as PatientPrescription[]}
      labOrders={labOrders}
      appointmentId={currentAppointment?.id}
      readOnly={isReadOnly}
      currentDoctorProfileId={currentDoctorProfileId}
      currentDoctorName={currentDoctorName}
      clinicName={clinicName}
      canConfirmAllPatientLabs={canConfirmAllPatientLabs}
      currentAppointment={currentAppointment}
      initialBodyChartContext={bodyChartContext}
    />
  );
}
