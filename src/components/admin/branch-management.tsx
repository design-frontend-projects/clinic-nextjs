"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBranches, upsertBranch, deleteBranch } from "@/app/actions/clinic";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { branchSchema, type Branch } from "@/types/clinic.types";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BranchManagementProps {
  clinicId: string;
}

export function BranchManagement({ clinicId }: BranchManagementProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches", clinicId],
    queryFn: () => getBranches(clinicId),
  });

  const upsertMutation = useMutation({
    mutationFn: (data: Branch) => upsertBranch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches", clinicId] });
      toast.success(editingBranch ? "Branch updated" : "Branch created");
      setIsOpen(false);
      setEditingBranch(null);
    },
    onError: (error) => {
      toast.error(error.message || "Operation failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches", clinicId] });
      toast.success("Branch deleted");
      setBranchToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete branch");
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Branch>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      clinic_id: clinicId,
      status: "active",
      is_main: false,
    },
  });

  const onOpenAdd = () => {
    setEditingBranch(null);
    reset({ clinic_id: clinicId, status: "active", is_main: false });
    setIsOpen(true);
  };

  const onEdit = (branch: Branch) => {
    setEditingBranch(branch);
    reset(branch);
    setIsOpen(true);
  };

  const onSubmit = (data: Branch) => {
    upsertMutation.mutate(data);
  };

  if (isLoading) return <div>Loading branches...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Branches</h3>
        <Button size="sm" onClick={onOpenAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Branch
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches?.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">
                  {branch.name}
                  {branches.indexOf(branch) === 0 && (
                    <Badge
                      variant="outline"
                      className="ml-2 bg-primary/5 text-primary border-primary/20"
                    >
                      Main
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{branch.address || "-"}</TableCell>
                <TableCell>{branch.phone || "-"}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      branch.status === "active" ? "default" : "secondary"
                    }
                  >
                    {branch.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(branch)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setBranchToDelete(branch.id!)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {branches?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  No branches found. Add a branch to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? "Edit Branch" : "Add Branch"}
            </DialogTitle>
            <DialogDescription>
              Configure branch details for this clinic.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch_name">Branch Name</Label>
              <Input
                id="branch_name"
                {...register("name")}
                placeholder="e.g. Downtown Clinic"
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register("address")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch_phone">Phone</Label>
              <Input id="branch_phone" {...register("phone")} />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? "Saving..." : "Save Branch"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!branchToDelete}
        onOpenChange={(open) => !open && setBranchToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              branch. Note: Branches with assigned doctors or future
              appointments cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                branchToDelete && deleteMutation.mutate(branchToDelete)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Branch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
