"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageCropper } from "@/components/creator/image-cropper";
import { Camera, User, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export interface ProfileData {
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  socialTwitter: string;
  socialInstagram: string;
  socialYoutube: string;
  socialWebsite: string;
}

interface ProfileStepProps {
  data: ProfileData;
  onChange: (data: ProfileData) => void;
  onNext: () => void;
  isExistingProfile?: boolean;
}

async function uploadImageToR2(blob: Blob): Promise<string> {
  // 1. Get presigned URL
  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: "image.webp",
      contentType: "image/webp",
    }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }

  const { uploadUrl, publicUrl } = await presignRes.json();

  // 2. Upload directly to R2
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/webp" },
    body: blob,
  });

  if (!uploadRes.ok) {
    throw new Error("Failed to upload image");
  }

  return publicUrl;
}

export function ProfileStep({
  data,
  onChange,
  onNext,
  isExistingProfile = false,
}: ProfileStepProps) {
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [bannerCropOpen, setBannerCropOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string>("");
  const [bannerSrc, setBannerSrc] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const displayNameError =
    data.displayName.length > 0 &&
    (data.displayName.trim().length < 2 || data.displayName.trim().length > 50)
      ? "Display name must be between 2 and 50 characters"
      : "";

  const bioError =
    data.bio.length > 500 ? "Bio must be 500 characters or less" : "";

  const isValid =
    data.displayName.trim().length >= 2 &&
    data.displayName.trim().length <= 50 &&
    data.bio.length <= 500;

  function handleFileSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "avatar" | "banner",
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please select a JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (type === "avatar") {
        setAvatarSrc(result);
        setAvatarCropOpen(true);
      } else {
        setBannerSrc(result);
        setBannerCropOpen(true);
      }
    };
    reader.readAsDataURL(file);

    // Reset so the same file can be selected again
    e.target.value = "";
  }

  async function handleCropComplete(blob: Blob, type: "avatar" | "banner") {
    setUploading(true);
    try {
      const publicUrl = await uploadImageToR2(blob);
      if (type === "avatar") {
        onChange({ ...data, avatarUrl: publicUrl });
      } else {
        onChange({ ...data, bannerUrl: publicUrl });
      }
      toast.success(
        `${type === "avatar" ? "Avatar" : "Banner"} uploaded successfully`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner upload */}
      <div>
        <Label className="mb-2 block">Banner Image</Label>
        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          disabled={uploading}
          className="group relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:border-muted-foreground/50 hover:bg-muted disabled:opacity-50"
        >
          {data.bannerUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.bannerUrl}
                alt="Banner preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <span className="text-xs">Click to upload banner (1200x400)</span>
            </div>
          )}
        </button>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "banner")}
        />
      </div>

      {/* Avatar upload */}
      <div>
        <Label className="mb-2 block">Profile Picture</Label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploading}
            className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:border-muted-foreground/50 hover:bg-muted disabled:opacity-50"
          >
            {data.avatarUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.avatarUrl}
                  alt="Avatar preview"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </>
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </button>
          <p className="text-xs text-muted-foreground">
            Click to upload a profile picture. Recommended size: 400x400px.
          </p>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "avatar")}
        />
      </div>

      {/* Display Name */}
      <div>
        <Label htmlFor="displayName" className="mb-2 block">
          Display Name {isExistingProfile && <span className="text-xs text-muted-foreground">(cannot be changed)</span>}
        </Label>
        <Input
          id="displayName"
          value={data.displayName}
          onChange={(e) => onChange({ ...data, displayName: e.target.value })}
          placeholder="Your creator name"
          maxLength={50}
          disabled={isExistingProfile}
          aria-invalid={!!displayNameError}
        />
        {displayNameError && (
          <p className="mt-1 text-xs text-destructive">{displayNameError}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {data.displayName.trim().length}/50 characters
        </p>
      </div>

      {/* Bio */}
      <div>
        <Label htmlFor="bio" className="mb-2 block">
          Bio
        </Label>
        <Textarea
          id="bio"
          value={data.bio}
          onChange={(e) => onChange({ ...data, bio: e.target.value })}
          placeholder="Tell your audience about yourself..."
          rows={3}
          maxLength={500}
          aria-invalid={!!bioError}
        />
        {bioError && (
          <p className="mt-1 text-xs text-destructive">{bioError}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {data.bio.length}/500 characters
        </p>
      </div>

      {/* Social Links */}
      <div className="space-y-3">
        <Label className="block">Social Links</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="socialTwitter" className="mb-1 block text-xs text-muted-foreground">
              Twitter / X
            </Label>
            <Input
              id="socialTwitter"
              value={data.socialTwitter}
              onChange={(e) =>
                onChange({ ...data, socialTwitter: e.target.value })
              }
              placeholder="@username"
            />
          </div>
          <div>
            <Label htmlFor="socialInstagram" className="mb-1 block text-xs text-muted-foreground">
              Instagram
            </Label>
            <Input
              id="socialInstagram"
              value={data.socialInstagram}
              onChange={(e) =>
                onChange({ ...data, socialInstagram: e.target.value })
              }
              placeholder="@username"
            />
          </div>
          <div>
            <Label htmlFor="socialYoutube" className="mb-1 block text-xs text-muted-foreground">
              YouTube
            </Label>
            <Input
              id="socialYoutube"
              value={data.socialYoutube}
              onChange={(e) =>
                onChange({ ...data, socialYoutube: e.target.value })
              }
              placeholder="Channel URL"
            />
          </div>
          <div>
            <Label htmlFor="socialWebsite" className="mb-1 block text-xs text-muted-foreground">
              Website
            </Label>
            <Input
              id="socialWebsite"
              value={data.socialWebsite}
              onChange={(e) =>
                onChange({ ...data, socialWebsite: e.target.value })
              }
              placeholder="https://yoursite.com"
            />
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <Button
        onClick={onNext}
        disabled={!isValid || uploading}
        className="w-full"
        size="lg"
      >
        {uploading ? "Uploading..." : "Continue"}
      </Button>

      {/* Cropper dialogs */}
      {avatarSrc && (
        <ImageCropper
          open={avatarCropOpen}
          onClose={() => setAvatarCropOpen(false)}
          onCropComplete={(blob) => handleCropComplete(blob, "avatar")}
          imageSrc={avatarSrc}
          aspect={1}
          circularCrop
          outputWidth={400}
          outputHeight={400}
          title="Crop Profile Picture"
        />
      )}
      {bannerSrc && (
        <ImageCropper
          open={bannerCropOpen}
          onClose={() => setBannerCropOpen(false)}
          onCropComplete={(blob) => handleCropComplete(blob, "banner")}
          imageSrc={bannerSrc}
          aspect={3}
          outputWidth={1200}
          outputHeight={400}
          title="Crop Banner Image"
        />
      )}
    </div>
  );
}
