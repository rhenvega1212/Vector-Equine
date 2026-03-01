"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const ASPECT_OPTIONS = [
  { label: "Free", value: undefined },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
] as const;

interface MediaCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
      "image/jpeg",
      0.92
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

export function MediaCropper({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: MediaCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const aspect = ASPECT_OPTIONS[aspectIdx].value;

  const onCropChangeHandler = useCallback((location: Point) => {
    setCrop(location);
  }, []);

  const onZoomChangeHandler = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropCompleteHandler = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspectIdx(0);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage);
      onOpenChange(false);
      handleReset();
    } catch (error) {
      console.error("Error cropping image:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    handleReset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-slate-900 border-cyan-400/20">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
          <DialogDescription>
            Drag to reposition, pinch or use the slider to zoom
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={onCropChangeHandler}
            onZoomChange={onZoomChangeHandler}
            onCropComplete={onCropCompleteHandler}
            classes={{
              containerClassName: "rounded-lg",
              cropAreaClassName: "!border-cyan-400 !border-2",
            }}
          />
        </div>

        {/* Aspect ratio presets */}
        <div className="flex items-center gap-2 justify-center">
          {ASPECT_OPTIONS.map((opt, idx) => (
            <Button
              key={opt.label}
              size="sm"
              variant={aspectIdx === idx ? "default" : "outline"}
              className={`h-8 text-xs ${
                aspectIdx === idx
                  ? "bg-cyan-500 hover:bg-cyan-400 text-black"
                  : "border-cyan-400/30 hover:bg-cyan-400/10"
              }`}
              onClick={() => setAspectIdx(idx)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value[0])}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="w-full border-cyan-400/30 hover:bg-cyan-400/10"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isProcessing}
            className="bg-cyan-500 hover:bg-cyan-400 text-black"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cropping...
              </>
            ) : (
              "Apply Crop"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
