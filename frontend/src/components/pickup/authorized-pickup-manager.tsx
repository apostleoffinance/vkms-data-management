"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AuthorizedPickupPhoto } from "@/components/pickup/authorized-pickup-photo";
import { PhotoCapture } from "@/components/pickup/photo-capture";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete, apiGet, apiPost, apiUpload } from "@/lib/api";
import type { AuthorizedPickupContact } from "@/types";

interface AuthorizedPickupManagerProps {
  childId: string;
  readOnly?: boolean;
}

export function AuthorizedPickupManager({ childId, readOnly = false }: AuthorizedPickupManagerProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    relationship: "Guardian",
    photo_base64: null as string | null,
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["authorized-pickups", childId],
    queryFn: () => apiGet<AuthorizedPickupContact[]>(`/api/v1/authorized-pickups/children/${childId}`),
  });

  const resetForm = () => {
    setForm({
      first_name: "",
      last_name: "",
      phone: "",
      relationship: "Guardian",
      photo_base64: null,
    });
    setAdding(false);
  };

  const handleAdd = async () => {
    if (!form.first_name || !form.last_name || !form.phone) {
      toast.error("Name and phone are required");
      return;
    }
    try {
      await apiPost(`/api/v1/authorized-pickups/children/${childId}`, {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        relationship: form.relationship,
        is_primary: false,
        photo_base64: form.photo_base64,
      });
      await queryClient.invalidateQueries({ queryKey: ["authorized-pickups", childId] });
      toast.success("Authorized pickup contact added");
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add contact");
    }
  };

  const handlePhotoUpdate = async (contactId: string, file: File) => {
    const formData = new FormData();
    formData.append("photo", file);
    try {
      await apiUpload(`/api/v1/authorized-pickups/${contactId}/photo`, formData);
      await queryClient.invalidateQueries({ queryKey: ["authorized-pickups", childId] });
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed");
    }
  };

  const handleDelete = async (contactId: string) => {
    try {
      await apiDelete(`/api/v1/authorized-pickups/${contactId}`);
      await queryClient.invalidateQueries({ queryKey: ["authorized-pickups", childId] });
      toast.success("Contact removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Authorized Pickup</CardTitle>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Add contact
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No authorized pickup contacts yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex gap-3 rounded-lg border p-3">
                <AuthorizedPickupPhoto
                  key={`${contact.id}-${contact.updated_at}`}
                  contactId={contact.id}
                  name={contact.full_name}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{contact.full_name}</p>
                  <p className="text-sm text-muted-foreground">{contact.relationship}</p>
                  <p className="text-sm text-muted-foreground">{contact.phone}</p>
                  {contact.is_primary && (
                    <span className="text-xs text-primary font-medium">Primary</span>
                  )}
                  {!readOnly && !contact.is_primary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-8 px-2 text-destructive"
                      onClick={() => handleDelete(contact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {!readOnly && (
                    <label className="mt-2 block">
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpdate(contact.id, file);
                        }}
                      />
                      <span className="text-xs text-primary cursor-pointer underline">
                        {contact.has_photo ? "Update photo" : "Add photo"}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {adding && !readOnly && (
          <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First name</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Last name</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Relationship</Label>
                <Input
                  value={form.relationship}
                  onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                />
              </div>
            </div>
            <PhotoCapture
              label="Pickup photo"
              value={form.photo_base64}
              onChange={(photo_base64) => setForm({ ...form, photo_base64 })}
            />
            <div className="flex gap-2">
              <Button type="button" onClick={handleAdd}>Save contact</Button>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
