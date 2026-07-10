import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Building2, Globe, Phone, Mail } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your clinic profile and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Clinic Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Clinic Profile
            </CardTitle>
            <CardDescription>
              Update your clinic&apos;s information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinic_name">Clinic Name</Label>
              <Input id="clinic_name" placeholder="My Clinic" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg_number">Registration Number</Label>
              <Input id="reg_number" placeholder="REG-001" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic_email">Email</Label>
                <Input
                  id="clinic_email"
                  type="email"
                  placeholder="clinic@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic_phone">Phone</Label>
                <Input id="clinic_phone" placeholder="+1 234 567 890" />
              </div>
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Subscription Plan
            </CardTitle>
            <CardDescription>Your current plan and billing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">Trial Plan</p>
                  <p className="text-sm text-muted-foreground">
                    Free for 14 days
                  </p>
                </div>
                <Button variant="outline">Upgrade</Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Features included:
              </p>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  ✓ Unlimited patients
                </li>
                <li className="flex items-center gap-2">
                  ✓ Appointment management
                </li>
                <li className="flex items-center gap-2">✓ Basic billing</li>
                <li className="flex items-center gap-2">✓ 5 staff members</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
