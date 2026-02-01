"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageCropper } from "@/components/creator/image-cropper";
import { Camera, Coins, HelpCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export interface TokenConfigData {
  tokenName: string;
  tickerSymbol: string;
  description: string;
  imageUrl: string;
  burnSolPrice: number;
  useCustomImage: boolean;
}

interface TokenConfigStepProps {
  data: TokenConfigData;
  avatarUrl: string;
  onChange: (data: TokenConfigData) => void;
  onNext: () => void;
  onBack: () => void;
}

async function uploadImageToR2(blob: Blob): Promise<string> {
  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: "token-image.webp",
      contentType: "image/webp",
    }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }

  const { uploadUrl, publicUrl } = await presignRes.json();

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

export function TokenConfigStep({
  data,
  avatarUrl,
  onChange,
  onNext,
  onBack,
}: TokenConfigStepProps) {
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [showBurnTooltip, setShowBurnTooltip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tokenNameError =
    data.tokenName.length > 0 &&
    (data.tokenName.trim().length < 2 || data.tokenName.trim().length > 32)
      ? "Token name must be between 2 and 32 characters"
      : "";

  const tickerError =
    data.tickerSymbol.length > 0 &&
    (data.tickerSymbol.length < 2 ||
      data.tickerSymbol.length > 10 ||
      !/^[A-Z]*$/.test(data.tickerSymbol))
      ? "Ticker must be 2-10 uppercase letters"
      : "";

  const descriptionError =
    data.description.length > 200
      ? "Description must be 200 characters or less"
      : "";

  const burnPriceError =
    data.burnSolPrice <= 0 ? "Burn price must be greater than 0" : "";

  const isValid =
    data.tokenName.trim().length >= 2 &&
    data.tokenName.trim().length <= 32 &&
    data.tickerSymbol.length >= 2 &&
    data.tickerSymbol.length <= 10 &&
    /^[A-Z]+$/.test(data.tickerSymbol) &&
    data.description.length <= 200 &&
    data.burnSolPrice > 0;

  // Effective image: use custom if toggled + uploaded, otherwise avatar
  const effectiveImageUrl = data.useCustomImage && data.imageUrl
    ? data.imageUrl
    : avatarUrl;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
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
      setCropSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleCropComplete(blob: Blob) {
    setUploading(true);
    try {
      const publicUrl = await uploadImageToR2(blob);
      onChange({ ...data, imageUrl: publicUrl, useCustomImage: true });
      toast.success("Token image uploaded successfully");
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
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Configure Your Token</h2>
        <p className="text-sm text-muted-foreground">
          Set up your creator token with a name, ticker symbol, and image.
        </p>
      </div>

      {/* Token Image */}
      <div>
        <Label className="mb-2 block">Token Image</Label>
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-muted-foreground/25">
            {effectiveImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={effectiveImageUrl}
                alt="Token image preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted/50">
                <Coins className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.useCustomImage}
                onChange={(e) =>
                  onChange({ ...data, useCustomImage: e.target.checked })
                }
                className="rounded border-muted-foreground/25"
              />
              Use custom image
            </label>
            {data.useCustomImage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="mr-2 h-3 w-3" />
                {uploading ? "Uploading..." : "Upload Image"}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {data.useCustomImage
                ? "Upload a square image (400x400 recommended)"
                : "Using your profile avatar as token image"}
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Token Name */}
      <div>
        <Label htmlFor="tokenName" className="mb-2 block">
          Token Name
        </Label>
        <Input
          id="tokenName"
          value={data.tokenName}
          onChange={(e) => onChange({ ...data, tokenName: e.target.value })}
          placeholder="e.g. Creator Coin"
          maxLength={32}
          aria-invalid={!!tokenNameError}
        />
        {tokenNameError && (
          <p className="mt-1 text-xs text-destructive">{tokenNameError}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {data.tokenName.trim().length}/32 characters
        </p>
      </div>

      {/* Ticker Symbol */}
      <div>
        <Label htmlFor="tickerSymbol" className="mb-2 block">
          Ticker Symbol
        </Label>
        <Input
          id="tickerSymbol"
          value={data.tickerSymbol}
          onChange={(e) =>
            onChange({
              ...data,
              tickerSymbol: e.target.value.toUpperCase().replace(/[^A-Z]/g, ""),
            })
          }
          placeholder="e.g. CRCN"
          maxLength={10}
          aria-invalid={!!tickerError}
        />
        {tickerError && (
          <p className="mt-1 text-xs text-destructive">{tickerError}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {data.tickerSymbol.length}/10 characters
        </p>
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="tokenDescription" className="mb-2 block">
          Description
        </Label>
        <Textarea
          id="tokenDescription"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="A short description of your token..."
          rows={2}
          maxLength={200}
          aria-invalid={!!descriptionError}
        />
        {descriptionError && (
          <p className="mt-1 text-xs text-destructive">{descriptionError}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {data.description.length}/200 characters
        </p>
      </div>

      {/* Burn SOL Price */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Label htmlFor="burnSolPrice">Burn Price (SOL)</Label>
          <button
            type="button"
            className="relative text-muted-foreground hover:text-foreground"
            onMouseEnter={() => setShowBurnTooltip(true)}
            onMouseLeave={() => setShowBurnTooltip(false)}
            onClick={() => setShowBurnTooltip((v) => !v)}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            {showBurnTooltip && (
              <div className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg border bg-popover p-3 text-left text-xs text-popover-foreground shadow-md">
                The SOL-equivalent cost for viewers to burn tokens and access
                your exclusive content. Set to 0.01 SOL for casual content or
                higher for premium content.
              </div>
            )}
          </button>
        </div>
        <Input
          id="burnSolPrice"
          type="number"
          step="0.001"
          min="0.001"
          value={data.burnSolPrice}
          onChange={(e) =>
            onChange({
              ...data,
              burnSolPrice: parseFloat(e.target.value) || 0,
            })
          }
          aria-invalid={!!burnPriceError}
        />
        {burnPriceError && (
          <p className="mt-1 text-xs text-destructive">{burnPriceError}</p>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid || uploading}
          className="flex-1"
        >
          Review Token
        </Button>
      </div>

      {/* Cropper dialog */}
      {cropSrc && (
        <ImageCropper
          open={cropOpen}
          onClose={() => setCropOpen(false)}
          onCropComplete={handleCropComplete}
          imageSrc={cropSrc}
          aspect={1}
          outputWidth={400}
          outputHeight={400}
          title="Crop Token Image"
        />
      )}
    </div>
  );
}
