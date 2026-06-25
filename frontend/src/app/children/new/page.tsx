"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";
import type { ClassItem, ParentLookup } from "@/types";
import { useAuth } from "@/contexts/auth-context";

const schema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  gender: z.enum(["male", "female", "other"]),
  date_of_birth: z.string().min(1, "Required"),
  class_id: z.string().min(1, "Required"),
  parent_first_name: z.string().min(1, "Required"),
  parent_last_name: z.string().min(1, "Required"),
  parent_phone: z.string().min(7, "Invalid phone"),
  parent_alternative_phone: z.string().optional(),
  parent_email: z.string().email().optional().or(z.literal("")),
  parent_address: z.string().optional(),
  medical_notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export default function RegisterChildPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [linkedParentId, setLinkedParentId] = useState<string | null>(null);
  const [debouncedPhone, setDebouncedPhone] = useState("");

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => apiGet<ClassItem[]>("/api/v1/classes"),
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { gender: "male" },
  });

  const parentPhone = watch("parent_phone");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPhone(parentPhone ?? ""), 400);
    return () => clearTimeout(timer);
  }, [parentPhone]);

  const { data: existingParent } = useQuery({
    queryKey: ["parent-lookup", debouncedPhone],
    queryFn: () =>
      apiGet<ParentLookup | null>(
        `/api/v1/parents/lookup/by-phone?phone=${encodeURIComponent(debouncedPhone)}`,
      ),
    enabled: normalizePhone(debouncedPhone).length >= 7,
  });

  useEffect(() => {
    if (!existingParent) {
      setLinkedParentId(null);
      return;
    }
    setLinkedParentId(existingParent.id);
    setValue("parent_first_name", existingParent.first_name);
    setValue("parent_last_name", existingParent.last_name);
    if (existingParent.email) {
      setValue("parent_email", existingParent.email);
    }
    if (existingParent.address) {
      setValue("parent_address", existingParent.address);
    }
    if (existingParent.alternative_phone) {
      setValue("parent_alternative_phone", existingParent.alternative_phone);
    }
  }, [existingParent, setValue]);

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <p className="text-center text-muted-foreground py-12">Admin access required</p>
      </DashboardLayout>
    );
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const child = await apiPost<{ id: string; child_code: string; parent_linked: boolean }>(
        "/api/v1/children",
        {
          ...data,
          parent_id: linkedParentId,
          parent_email: data.parent_email || null,
          parent_alternative_phone: data.parent_alternative_phone || null,
          parent_address: data.parent_address || null,
          medical_notes: data.medical_notes || null,
        },
      );
      toast.success(
        child.parent_linked
          ? `Registered ${child.child_code} and linked to existing parent.`
          : `Registered as ${child.child_code}. Use Check-In to receive a service tag.`,
      );
      router.push(`/attendance/check-in?child=${child.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Register Child</h1>
        <p className="text-muted-foreground">
          Registration adds the child to the database. If the parent phone already exists, the new
          child is linked to that parent automatically. Service tags are assigned on Check-In only.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Child Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input {...register("first_name")} />
                  {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input {...register("last_name")} />
                  {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select defaultValue="male" onValueChange={(v) => setValue("gender", v as FormData["gender"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" {...register("date_of_birth")} />
                  {errors.date_of_birth && <p className="text-sm text-destructive">{errors.date_of_birth.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Class</Label>
                <Select onValueChange={(v) => setValue("class_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.class_id && <p className="text-sm text-destructive">{errors.class_id.message}</p>}
              </div>

              <hr className="my-4" />
              <h3 className="font-semibold">Parent Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Parent First Name</Label>
                  <Input {...register("parent_first_name")} />
                </div>
                <div className="space-y-2">
                  <Label>Parent Last Name</Label>
                  <Input {...register("parent_last_name")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input {...register("parent_phone")} />
                  {errors.parent_phone && (
                    <p className="text-sm text-destructive">{errors.parent_phone.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Alternative Phone</Label>
                  <Input {...register("parent_alternative_phone")} />
                </div>
              </div>

              {existingParent && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm font-medium">Existing parent found</p>
                    <p className="text-sm text-muted-foreground">
                      {existingParent.first_name} {existingParent.last_name} ({existingParent.phone})
                    </p>
                    {existingParent.children.length > 0 ? (
                      <div className="text-sm text-muted-foreground">
                        <p>Registered children:</p>
                        <ul className="list-disc pl-5 mt-1">
                          {existingParent.children.map((child) => (
                            <li key={child.id}>
                              {child.full_name} ({child.child_code}) · {child.class_name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No active children on this profile yet.</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      This child will be added as a sibling under the same parent.
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...register("parent_email")} />
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input {...register("parent_address")} />
              </div>

              <div className="space-y-2">
                <Label>Medical Notes</Label>
                <Input {...register("medical_notes")} />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Registering..." : "Register Child"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
