"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ServiceSelector, useDefaultServiceId } from "@/components/services/service-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import type { WorkerRosterItem } from "@/types";
import { useAuth } from "@/contexts/auth-context";

interface WorkerAttendanceRecord {
  id: string;
  worker_id: string;
  worker_name: string;
  service_id: string;
  check_in_time: string;
}

function workerDisplayName(worker: WorkerRosterItem) {
  return `${worker.first_name} ${worker.last_name}`;
}

export default function WorkerAttendancePage() {
  const { user } = useAuth();
  const [serviceId, setServiceId] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const defaultServiceId = useDefaultServiceId();

  useEffect(() => {
    if (defaultServiceId) {
      setServiceId((current) => current || defaultServiceId);
    }
  }, [defaultServiceId]);

  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["workers-roster"],
    queryFn: () => apiGet<WorkerRosterItem[]>("/api/v1/workers"),
    enabled: user?.role === "admin",
  });

  const { data: records = [], refetch } = useQuery({
    queryKey: ["worker-attendance", serviceId],
    queryFn: () =>
      apiGet<WorkerAttendanceRecord[]>(
        serviceId ? `/api/v1/worker-attendance?service_id=${serviceId}` : "/api/v1/worker-attendance",
      ),
    enabled: user?.role === "admin" && !!serviceId,
  });

  const presentWorkerIds = useMemo(
    () => new Set(records.map((r) => r.worker_id)),
    [records],
  );

  const filteredWorkers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return workers;
    }
    return workers.filter((worker) => {
      const fullName = workerDisplayName(worker).toLowerCase();
      return (
        fullName.includes(query) ||
        worker.first_name.toLowerCase().includes(query) ||
        worker.last_name.toLowerCase().includes(query)
      );
    });
  }, [workers, searchQuery]);

  useEffect(() => {
    if (!dropdownOpen) {
      return;
    }
    searchInputRef.current?.focus();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <p className="text-center text-muted-foreground py-12">
          Admin opens this screen on a shared device for workers to mark attendance.
        </p>
      </DashboardLayout>
    );
  }

  const handleMark = async (workerId: string) => {
    if (!serviceId) {
      toast.error("Please select a service");
      return;
    }
    if (presentWorkerIds.has(workerId)) {
      return;
    }
    setMarkingId(workerId);
    try {
      await apiPost("/api/v1/worker-attendance", { worker_id: workerId, service_id: serviceId });
      const worker = workers.find((item) => item.id === workerId);
      toast.success(worker ? `${workerDisplayName(worker)} marked present` : "Attendance marked");
      setSearchQuery("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark attendance");
    } finally {
      setMarkingId(null);
    }
  };

  const toggleDropdown = () => {
    if (!serviceId) {
      toast.error("Please select a service first");
      return;
    }
    setDropdownOpen((open) => {
      if (open) {
        setSearchQuery("");
      }
      return !open;
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold">Worker Attendance</h1>
          <p className="text-muted-foreground mt-1">
            Open this on a shared device. Workers search their name and mark present — no login required.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Service</CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceSelector value={serviceId} onChange={setServiceId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mark Present</CardTitle>
          </CardHeader>
          <CardContent>
            {workersLoading ? (
              <p className="text-muted-foreground text-center py-6">Loading workers...</p>
            ) : workers.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                No workers on the roster. Add workers under Manage Workers.
              </p>
            ) : (
              <div ref={dropdownRef} className="relative">
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  className="h-12 w-full justify-between px-4 text-base"
                  onClick={toggleDropdown}
                  disabled={!serviceId}
                >
                  Mark Present
                  <ChevronDown
                    className={cn("h-5 w-5 transition-transform", dropdownOpen && "rotate-180")}
                  />
                </Button>

                {!serviceId && (
                  <p className="mt-2 text-sm text-muted-foreground">Select a service above first.</p>
                )}

                {dropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
                    <div className="border-b p-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={searchInputRef}
                          className="pl-10"
                          placeholder="Search your name..."
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto p-1">
                      {filteredWorkers.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No matching workers
                        </p>
                      ) : (
                        filteredWorkers.map((worker) => {
                          const present = presentWorkerIds.has(worker.id);
                          const marking = markingId === worker.id;

                          return (
                            <button
                              key={worker.id}
                              type="button"
                              className={cn(
                                "flex w-full items-center rounded-sm px-3 py-2.5 text-left text-sm",
                                present
                                  ? "cursor-not-allowed opacity-60"
                                  : "hover:bg-accent focus:bg-accent focus:outline-none",
                              )}
                              disabled={present || marking}
                              onClick={() => handleMark(worker.id)}
                            >
                              {present ? (
                                <CheckCircle2 className="mr-2 h-4 w-4 shrink-0" />
                              ) : null}
                              <span className="font-medium">{workerDisplayName(worker)}</span>
                              {present && <span className="ml-auto text-xs">Present</span>}
                              {marking && !present && (
                                <span className="ml-auto text-xs text-muted-foreground">Marking...</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Present for This Service</CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No workers marked yet</p>
            ) : (
              <div className="space-y-2">
                {records.map((r) => (
                  <div key={r.id} className="flex justify-between rounded-lg border p-3">
                    <span className="font-medium">{r.worker_name}</span>
                    <span className="text-sm text-muted-foreground">{formatDateTime(r.check_in_time)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
