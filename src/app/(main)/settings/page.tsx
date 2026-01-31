"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AvatarCropper } from "@/components/shared/avatar-cropper";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/profile";
import { createClient } from "@/lib/supabase/client";
import { uploadFile, isValidImageType, MAX_IMAGE_SIZE_MB } from "@/lib/uploads/storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, ArrowLeft, Settings, Camera } from "lucide-react";
import type { Profile } from "@/types/database";

const DISCIPLINES = [
  { value: "dressage", label: "Dressage" },
  { value: "jumping", label: "Show Jumping" },
  { value: "eventing", label: "Eventing" },
  { value: "western", label: "Western" },
  { value: "hunter", label: "Hunter" },
  { value: "endurance", label: "Endurance" },
  { value: "reining", label: "Reining" },
  { value: "trail", label: "Trail Riding" },
  { value: "other", label: "Other" },
];

const RIDER_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  // Avatar cropper state
  const [showCropper, setShowCropper] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
  });

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single() as { data: any };

      if (data) {
        setProfile(data);
        setValue("display_name", data.display_name);
        setValue("bio", data.bio || "");
        setValue("location", data.location || "");
        setValue("discipline", data.discipline || "");
        setValue("rider_level", data.rider_level || "");
        setValue("avatar_url", data.avatar_url || "");
      }
      setIsLoading(false);
    }

    loadProfile();
  }, [router, setValue]);

  // Handle file selection - opens cropper
  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    if (!isValidImageType(file)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, GIF, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `Please upload an image smaller than ${MAX_IMAGE_SIZE_MB}MB.`,
        variant: "destructive",
      });
      return;
    }

    // Read the file and open the cropper
    const reader = new FileReader();
    reader.onload = () => {
      setCropperImageSrc(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Handle cropped image upload
  async function handleCroppedImage(croppedBlob: Blob) {
    if (!profile) return;

    setIsUploadingAvatar(true);
    try {
      // Create a File from the Blob
      const file = new File([croppedBlob], `avatar-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      const { url } = await uploadFile("avatars", file, `${profile.id}/${file.name}`);
      setValue("avatar_url", url);
      setProfile((prev) => prev ? { ...prev, avatar_url: url } : null);
      toast({
        title: "Avatar uploaded",
        description: "Your profile photo has been updated.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function onSubmit(data: UpdateProfileInput) {
    if (!profile) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been saved.",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) return null;

  const initials = profile.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avatarUrl = watch("avatar_url");

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-4 py-4">
      {/* Header */}
      <div className="glass rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4">
          <Link 
            href={`/profile/${profile.username}`}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-400/10 border border-cyan-400/20">
              <Settings className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Settings</h1>
              <p className="text-xs text-muted-foreground">Edit your profile</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="mb-6 bg-slate-800/30 border-cyan-400/10">
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>
            Upload and crop a profile picture to personalize your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Avatar with camera overlay */}
            <div className="relative group">
              <Avatar className="h-24 w-24 ring-2 ring-cyan-400/20">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              {/* Camera overlay on hover */}
              <label
                htmlFor="avatar"
                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="h-8 w-8 text-white" />
              </label>
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row gap-2">
                <Label htmlFor="avatar" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploadingAvatar}
                    asChild
                    className="hover:bg-cyan-400/10 hover:border-cyan-400/30"
                  >
                    <span>
                      {isUploadingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isUploadingAvatar ? "Uploading..." : "Choose Photo"}
                    </span>
                  </Button>
                </Label>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setValue("avatar_url", "");
                      setProfile((prev) => prev ? { ...prev, avatar_url: null } : null);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </Button>
                )}
              </div>
              <Input
                ref={fileInputRef}
                id="avatar"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploadingAvatar}
              />
              <p className="text-xs text-muted-foreground mt-2">
                JPG, PNG, GIF or WebP. Max {MAX_IMAGE_SIZE_MB}MB.
              </p>
              <p className="text-xs text-cyan-400/70 mt-1">
                You can crop and adjust after selecting
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avatar Cropper Dialog */}
      <AvatarCropper
        open={showCropper}
        onOpenChange={setShowCropper}
        imageSrc={cropperImageSrc}
        onCropComplete={handleCroppedImage}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="bg-slate-800/30 border-cyan-400/10">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your profile information visible to other users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input id="display_name" {...register("display_name")} />
              {errors.display_name && (
                <p className="text-sm text-destructive">
                  {errors.display_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself..."
                {...register("bio")}
              />
              {errors.bio && (
                <p className="text-sm text-destructive">{errors.bio.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="City, State"
                {...register("location")}
              />
              {errors.location && (
                <p className="text-sm text-destructive">
                  {errors.location.message}
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="discipline">Discipline</Label>
              <Select
                value={watch("discipline") || ""}
                onValueChange={(value) => setValue("discipline", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your discipline" />
                </SelectTrigger>
                <SelectContent>
                  {DISCIPLINES.map((discipline) => (
                    <SelectItem key={discipline.value} value={discipline.value}>
                      {discipline.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rider_level">Rider Level</Label>
              <Select
                value={watch("rider_level") || ""}
                onValueChange={(value) => setValue("rider_level", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your level" />
                </SelectTrigger>
                <SelectContent>
                  {RIDER_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
