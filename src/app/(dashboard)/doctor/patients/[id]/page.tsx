import { getPatientDetails } from "@/app/actions/doctor";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Pill, History } from "lucide-react";
import { EncounterForm } from "./encounter-form";

export default async function PatientConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const { patient, history, prescriptions, labOrders } =
    await getPatientDetails(resolvedParams.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Consultation: {patient.first_name} {patient.last_name}
          </h1>
          <p className="text-muted-foreground">
            {patient.gender} • DOB:{" "}
            {patient.date_of_birth
              ? format(new Date(patient.date_of_birth), "MMM d, yyyy")
              : "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>New Encounter Notes</CardTitle>
              <CardDescription>
                Record diagnosis and treatment plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EncounterForm patientId={patient.id} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: History & Context */}
        <div className="space-y-6">
          <Tabs defaultValue="history">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="meds">Meds</TabsTrigger>
              <TabsTrigger value="labs">Labs</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-md flex items-center gap-2">
                    <History className="h-4 w-4" /> Past Encounters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {history.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No past encounters.
                      </p>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      history.slice(0, 5).map((enc: any) => (
                        <div
                          key={enc.id}
                          className="border-b last:border-0 pb-3 last:pb-0 text-sm"
                        >
                          <p className="font-medium text-primary">
                            {format(
                              new Date(enc.encounter_date),
                              "MMM d, yyyy",
                            )}
                          </p>
                          <p className="font-semibold mt-1">
                            Diagnosis: {enc.diagnosis || "N/A"}
                          </p>
                          <p className="text-muted-foreground mt-1 line-clamp-2">
                            {enc.notes}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meds" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-md flex items-center gap-2">
                    <Pill className="h-4 w-4" /> Active Prescriptions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {prescriptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No prescriptions on file.
                      </p>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      prescriptions.slice(0, 5).map((rx: any) => (
                        <div
                          key={rx.id}
                          className="border-b last:border-0 pb-3 last:pb-0 text-sm"
                        >
                          <p className="font-semibold">
                            {format(new Date(rx.dispensed_at), "MMM d, yyyy")}
                          </p>
                          <p className="text-muted-foreground mt-1">
                            Rx details placeholder
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="labs" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-md flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Recent Labs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {labOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No lab orders found.
                      </p>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      labOrders.slice(0, 5).map((lab: any) => (
                        <div
                          key={lab.id}
                          className="border-b last:border-0 pb-3 last:pb-0 text-sm"
                        >
                          <p className="font-medium">
                            {format(new Date(lab.created_at), "MMM d, yyyy")}
                          </p>
                          <p className="text-muted-foreground mt-1 capitalize">
                            Status: {lab.status}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
