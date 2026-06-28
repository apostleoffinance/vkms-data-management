"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface PhotoCaptureProps {
  label?: string;
  value: string | null;
  onChange: (base64: string | null) => void;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PhotoCapture({ label = "Guardian photo", value, onChange }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const base64 = await fileToBase64(file);
    setPreview(base64);
    onChange(base64);
  };

  const clear = () => {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-4">
        <div className="h-24 w-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {preview ? "Retake photo" : "Take photo"}
          </Button>
          {preview && (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              <X className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
