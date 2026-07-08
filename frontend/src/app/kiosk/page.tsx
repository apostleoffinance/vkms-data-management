"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Baby, Phone, UserPlus } from "lucide-react";
import { toast } from "sonner";

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
import { PageLoader } from "@/components/ui/loading";
import { BRAND } from "@/lib/brand";
import {
  kioskCheckIn,
  KioskApiError,
  kioskGetTodayService,
  kioskLookup,
  kioskRegister,
  type KioskChildStatus,
  type KioskLookupResponse,
  type KioskService,
  type KioskTagResult,
} from "@/lib/kiosk-api";

type Screen = "home" | "phone" | "register" | "success";

function FrontDeskNote() {
  return (
    <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
      No phone or internet? See the front desk — staff can check your child in and assign a tag.
    </p>
  );
}

export default function KioskPage() {
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<KioskService | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<KioskLookupResponse | null>(null);
  const [tag, setTag] = useState<KioskTagResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    child_first_name: "",
    child_last_name: "",
    gender: "male",
    date_of_birth: "",
    parent_first_name: "",
    parent_last_name: "",
    parent_phone: "",
    parent_email: "",
    medical_notes: "",
  });

  useEffect(() => {
    kioskGetTodayService()
      .then(setService)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not load service");
      })
      .finally(() => setLoading(false));
  }, []);

  const showTag = (result: KioskTagResult) => {
    setTag(result);
    setScreen("success");
  };

  const handleCheckIn = async (child: KioskChildStatus) => {
    if (child.checked_in_today && child.tag_number && !child.checked_out) {
      showTag({
        tag_number: child.tag_number,
        child_name: child.full_name,
        class_name: child.class_name,
        child_code: child.child_code,
        check_in_time: child.check_in_time || new Date().toISOString(),
        service_name: service?.service_name || "Today's service",
        already_checked_in: true,
      });
      return;
    }
    setBusy(true);
    try {
      const result = await kioskCheckIn(child.id);
      showTag(result);
    } catch (err) {
      toast.error(err instanceof KioskApiError ? err.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  };

  const handlePhoneLookup = async () => {
    if (!phone.trim()) {
      toast.error("Enter your phone number");
      return;
    }
    setBusy(true);
    setLookupFailed(false);
    try {
      const result = await kioskLookup(phone.trim());
      if (!result || result.children.length === 0) {
        setLookup(null);
        setLookupFailed(true);
        return;
      }
      setLookup(result);
      setRegisterForm((f) => ({
        ...f,
        parent_phone: phone.trim(),
        parent_first_name: result.parent_name.split(" ")[0] || "",
        parent_last_name: result.parent_name.split(" ").slice(1).join(" ") || "",
      }));
    } catch (err) {
      toast.error(err instanceof KioskApiError ? err.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await kioskRegister({
        ...registerForm,
        parent_email: registerForm.parent_email || undefined,
        medical_notes: registerForm.medical_notes || undefined,
      });
      showTag(result);
    } catch (err) {
      toast.error(err instanceof KioskApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setScreen("home");
    setTag(null);
    setLookup(null);
    setPhone("");
    setLookupFailed(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageLoader />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Check-in not open yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-muted-foreground">
            <p>No service is scheduled for today.</p>
            <p>Please see the front desk for help.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screen === "success" && tag) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6"
        style={{ backgroundColor: BRAND.yellow, color: BRAND.black }}
      >
        <div className="w-full max-w-md space-y-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-80">
            {tag.already_checked_in ? "Already checked in" : "Checked in!"}
          </p>
          <div className="rounded-3xl border-4 border-black bg-white px-6 py-10 shadow-lg">
            <p className="text-sm font-medium text-muted-foreground">Your tag number</p>
            <p className="my-2 text-7xl font-black tabular-nums tracking-tight">{tag.tag_number}</p>
            <p className="text-2xl font-bold">{tag.child_name}</p>
            <p className="mt-1 text-lg text-muted-foreground">{tag.class_name}</p>
            <p className="mt-4 text-sm">{tag.service_name}</p>
          </div>
          <p className="text-lg font-semibold">Show this tag number at the front desk</p>
          <p className="text-sm opacity-80">
            Keep this screen visible when you drop off. Staff will use this tag number when you
            pick up your child.
          </p>
          <Button
            type="button"
            className="w-full bg-black text-white hover:bg-black/90"
            onClick={reset}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header
        className="px-6 py-5 text-center"
        style={{ backgroundColor: BRAND.yellow, color: BRAND.black }}
      >
        <p className="text-sm font-semibold uppercase tracking-wide">Votage Kids</p>
        <h1 className="text-2xl font-bold">Parent Check-in</h1>
        <p className="mt-1 text-sm opacity-80">
          {service.service_name} · {format(new Date(service.service_date), "EEEE, MMM d")}
        </p>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-6 p-6">
        {screen === "home" && (
          <>
            <p className="text-center text-muted-foreground">
              Enter your phone to check in registered children, or register a first-time visitor.
              You will receive a tag number to show at the front desk.
            </p>
            <div className="grid gap-3">
              <Button
                type="button"
                size="lg"
                className="h-auto justify-start gap-4 py-5"
                onClick={() => setScreen("phone")}
              >
                <Phone className="h-6 w-6 shrink-0" />
                <span className="text-left">
                  <span className="block font-semibold">My children</span>
                  <span className="text-sm font-normal opacity-80">Look up by parent phone</span>
                </span>
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-auto justify-start gap-4 py-5"
                onClick={() => setScreen("register")}
              >
                <UserPlus className="h-6 w-6 shrink-0" />
                <span className="text-left">
                  <span className="block font-semibold">Register new child</span>
                  <span className="text-sm font-normal opacity-80">First time visiting</span>
                </span>
              </Button>
            </div>
            <FrontDeskNote />
          </>
        )}

        {screen === "phone" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Find your children
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Parent phone number</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  placeholder="07012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button type="button" className="w-full" disabled={busy} onClick={handlePhoneLookup}>
                {busy ? "Searching…" : "Find children"}
              </Button>
              {lookupFailed && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
                  <p>No children found for this phone number.</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setRegisterForm((f) => ({ ...f, parent_phone: phone.trim() }));
                      setScreen("register");
                    }}
                  >
                    Register a new child
                  </Button>
                </div>
              )}
              {lookup && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    {lookup.parent_name} · {lookup.phone}
                  </p>
                  {lookup.children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{child.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {child.child_code} · {child.class_name}
                          {child.checked_in_today && child.tag_number
                            ? ` · Tag ${child.tag_number}`
                            : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleCheckIn(child)}
                      >
                        {child.checked_in_today && !child.checked_out ? "Show tag" : "Check in"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="ghost" className="w-full" onClick={() => setScreen("home")}>
                Back
              </Button>
              <FrontDeskNote />
            </CardContent>
          </Card>
        )}

        {screen === "register" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Baby className="h-5 w-5" />
                Register & check in
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleRegister}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Child first name</Label>
                    <Input
                      required
                      value={registerForm.child_first_name}
                      onChange={(e) =>
                        setRegisterForm((f) => ({ ...f, child_first_name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Child last name</Label>
                    <Input
                      required
                      value={registerForm.child_last_name}
                      onChange={(e) =>
                        setRegisterForm((f) => ({ ...f, child_last_name: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={registerForm.gender}
                      onValueChange={(v) => setRegisterForm((f) => ({ ...f, gender: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of birth</Label>
                    <Input
                      required
                      type="date"
                      value={registerForm.date_of_birth}
                      onChange={(e) =>
                        setRegisterForm((f) => ({ ...f, date_of_birth: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Parent first name</Label>
                    <Input
                      required
                      value={registerForm.parent_first_name}
                      onChange={(e) =>
                        setRegisterForm((f) => ({ ...f, parent_first_name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Parent last name</Label>
                    <Input
                      required
                      value={registerForm.parent_last_name}
                      onChange={(e) =>
                        setRegisterForm((f) => ({ ...f, parent_last_name: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Parent phone</Label>
                  <Input
                    required
                    inputMode="tel"
                    value={registerForm.parent_phone}
                    onChange={(e) =>
                      setRegisterForm((f) => ({ ...f, parent_phone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email (optional)</Label>
                  <Input
                    type="email"
                    value={registerForm.parent_email}
                    onChange={(e) =>
                      setRegisterForm((f) => ({ ...f, parent_email: e.target.value }))
                    }
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Registering…" : "Register & get tag"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setScreen("home")}>
                  Back
                </Button>
                <FrontDeskNote />
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
