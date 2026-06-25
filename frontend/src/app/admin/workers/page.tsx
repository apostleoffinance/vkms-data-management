"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { WorkerRosterItem } from "@/types";
import { useAuth } from "@/contexts/auth-context";

export default function ManageWorkersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "" });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-roster", "all"],
    queryFn: () => apiGet<WorkerRosterItem[]>("/api/v1/workers?active_only=false"),
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <p className="text-center text-muted-foreground py-12">Admin access required</p>
      </DashboardLayout>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost("/api/v1/workers", {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || null,
      });
      toast.success("Worker added to roster");
      setForm({ first_name: "", last_name: "", phone: "" });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["workers-roster"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add worker");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (worker: WorkerRosterItem) => {
    try {
      await apiPut(`/api/v1/workers/${worker.id}`, { is_active: !worker.is_active });
      toast.success(worker.is_active ? "Worker deactivated" : "Worker reactivated");
      queryClient.invalidateQueries({ queryKey: ["workers-roster"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Manage Workers</h1>
            <p className="text-muted-foreground mt-1">
              Worker roster for attendance — no login accounts needed.
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "Add Worker"}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>New Worker</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone (optional)</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Adding..." : "Add to Roster"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Worker Roster</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {workers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No workers yet</p>
            ) : (
              workers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">
                      {worker.first_name} {worker.last_name}
                    </p>
                    {worker.phone && (
                      <p className="text-sm text-muted-foreground">{worker.phone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        worker.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {worker.is_active ? "Active" : "Inactive"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(worker)}
                    >
                      {worker.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
