"use client";

import { useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Stethoscope,
  CalendarDays,
  CreditCard,
  Clock,
  ShieldPlus,
} from "lucide-react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";

type Appointment = {
  id: string;
  patientName: string;
  doctorName: string;
  date: string;
  status: string;
};

interface AdminDashboardClientProps {
  stats: {
    totalPatients: number;
    totalDoctors: number;
    todayAppointments: number;
    totalAppointments: number;
    pendingPayments: number;
    totalInsurances: number;
    recentAppointments: Appointment[];
  };
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function AdminDashboardClient({ stats }: AdminDashboardClientProps) {
  const t = useTranslations("pages.admin");
  const [activeTab, setActiveTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredAppointments = stats.recentAppointments.filter((apt) =>
    statusFilter === "all" ? true : apt.status === statusFilter
  );

  const appointmentColumns: ColumnDef<Appointment>[] = [
    {
      accessorKey: "patientName",
      header: t("patient") || "Patient",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium">{row.original.patientName || t("unknownPatient")}</span>
        </div>
      ),
    },
    {
      accessorKey: "doctorName",
      header: t("doctor") || "Doctor",
    },
    {
      accessorKey: "date",
      header: t("date") || "Date",
      cell: ({ row }) => {
        const date = new Date(row.original.date);
        return (
          <div>
            <p className="font-medium">{format(date, "MMM d, yyyy")}</p>
            <p className="text-xs text-muted-foreground">{format(date, "h:mm a")}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: t("status") || "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status as any} />,
    },
  ];

  return (
    <motion.div
      className="space-y-8"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <motion.div variants={itemVariants}>
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="patients-doctors">Patients & Doctors</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
          </TabsList>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <TabsContent value="overview" className="mt-0 space-y-6 outline-none">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                  <StatCard
                    title={t("totalPatients") || "Total Patients"}
                    value={stats.totalPatients}
                    icon={Users}
                    description="Registered patients"
                  />
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                  <StatCard
                    title={t("activeDoctors") || "Active Doctors"}
                    value={stats.totalDoctors}
                    icon={Stethoscope}
                    description="On staff"
                  />
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                  <StatCard
                    title={t("todaysAppointments") || "Today's Appointments"}
                    value={stats.todayAppointments}
                    icon={CalendarDays}
                    description={format(new Date(), "EEEE, MMM d")}
                  />
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                  <StatCard
                    title={t("pendingPayments") || "Pending Payments"}
                    value={stats.pendingPayments}
                    icon={CreditCard}
                    description="Awaiting collection"
                  />
                </motion.div>
              </div>

              <Card className="overflow-hidden border-none shadow-md bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Clock className="h-5 w-5 text-primary" />
                      {t("recentAppointments") || "Recent Appointments"}
                    </CardTitle>
                    <CardDescription>Latest bookings across the clinic</CardDescription>
                  </div>
                  <div className="w-[180px]">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="checked_in">Checked In</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="no_show">No Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={appointmentColumns}
                    data={filteredAppointments.slice(0, 5)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appointments" className="mt-0 outline-none">
              <Card className="border-none shadow-md bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">All Appointments</CardTitle>
                    <CardDescription>Manage and view all appointments ({stats.totalAppointments} total)</CardDescription>
                  </div>
                  <div className="w-[180px]">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="checked_in">Checked In</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="no_show">No Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={appointmentColumns}
                    data={filteredAppointments}
                    searchKey="patientName"
                    searchPlaceholder="Search patients..."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="patients-doctors" className="mt-0 space-y-6 outline-none">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-none shadow-md bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Patient Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalPatients}</div>
                    <p className="text-sm text-muted-foreground mt-1">Total registered patients</p>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-md bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-primary" />
                      Doctor Roster
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalDoctors}</div>
                    <p className="text-sm text-muted-foreground mt-1">Active doctors on staff</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="insurance" className="mt-0 outline-none">
              <Card className="border-none shadow-md bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldPlus className="h-5 w-5 text-primary" />
                    Insurance Providers
                  </CardTitle>
                  <CardDescription>Overview of linked insurance companies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalInsurances}</div>
                  <p className="text-sm text-muted-foreground mt-1">Active insurance providers</p>
                </CardContent>
              </Card>
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </motion.div>
  );
}
