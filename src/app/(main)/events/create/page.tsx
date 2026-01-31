"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { createEventSchema, type CreateEventInput } from "@/lib/validations/event";
import { createClient } from "@/lib/supabase/client";
import { uploadFile, isValidImageType } from "@/lib/uploads/storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Upload, X } from "lucide-react";

const EVENT_TYPES = [
  { value: "clinic", label: "Clinic" },
  { value: "show", label: "Show" },
  { value: "run_club", label: "Run Club" },
  { value: "workout_group", label: "Workout Group" },
  { value: "movie_night", label: "Movie Night" },
  { value: "networking", label: "Networking" },
];

export default function CreateEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [publishStatus, setPublishStatus] = useState<"draft" | "published">("draft");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      is_published: false,
    },
  });

  useEffect(() => {
    async function checkPermissions() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, trainer_approved")
        .eq("id", user.id)
        .single() as { data: any };

      if (profile?.role === "admin") {
        setCanCreate(true);
        setIsAdmin(true);
      } else if (profile?.role === "trainer" && profile?.trainer_approved) {
        setCanCreate(true);
        setIsAdmin(false);
      } else {
        router.push("/events");
        toast({
          title: "Not authorized",
          description: "You don't have permission to create events.",
          variant: "destructive",
        });
      }
    }

    checkPermissions();
  }, [router, toast]);

  async function handleBannerUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isValidImageType(file)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, GIF, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { url } = await uploadFile(
        "event-banners",
        file,
        `${user.id}/${Date.now()}-${file.name}`
      );
      setBannerUrl(url);
      setValue("banner_image_url", url);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload banner. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function onSubmit(data: CreateEventInput) {
    setIsLoading(true);
    try {
      // Trainers can only create drafts, admins can choose
      const eventData = {
        ...data,
        status: isAdmin ? publishStatus : "draft",
        is_published: isAdmin ? publishStatus === "published" : false,
      };

      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        const event = await response.json();
        toast({
          title: "Event created",
          description: publishStatus === "published" 
            ? "Your event has been published."
            : "Your event has been saved as a draft.",
        });
        router.push(`/events/${event.id}`);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to create event");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (!canCreate) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/events">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create Event</CardTitle>
          <CardDescription>
            Create a new event for the Equinti community
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label>Banner Image</Label>
              {bannerUrl ? (
                <div className="relative">
                  <img
                    src={bannerUrl}
                    alt=""
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setBannerUrl(null);
                      setValue("banner_image_url", undefined);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Label htmlFor="banner" className="cursor-pointer">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors">
                      {isUploading ? (
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="mt-2 text-sm text-muted-foreground">
                            Click to upload banner image
                          </p>
                        </>
                      )}
                    </div>
                  </Label>
                  <Input
                    id="banner"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBannerUpload}
                    disabled={isUploading}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" {...register("title")} />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_type">Event Type *</Label>
              <Select onValueChange={(value) => setValue("event_type", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.event_type && (
                <p className="text-sm text-destructive">{errors.event_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                className="min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Date & Time *</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  {...register("start_time")}
                />
                {errors.start_time && (
                  <p className="text-sm text-destructive">{errors.start_time.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Date & Time *</Label>
                <Input
                  id="end_time"
                  type="datetime-local"
                  {...register("end_time")}
                />
                {errors.end_time && (
                  <p className="text-sm text-destructive">{errors.end_time.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_address">Address</Label>
              <Input id="location_address" {...register("location_address")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location_city">City</Label>
                <Input id="location_city" {...register("location_city")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location_state">State</Label>
                <Input id="location_state" {...register("location_state")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  {...register("capacity", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_display">Price (display only)</Label>
                <Input
                  id="price_display"
                  placeholder="e.g., $150/rider or Free"
                  {...register("price_display")}
                />
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Publish Event</p>
                  <p className="text-sm text-muted-foreground">
                    {publishStatus === "published" 
                      ? "Event will be visible to all users"
                      : "Only admins will see this event"}
                  </p>
                </div>
                <Switch
                  checked={publishStatus === "published"}
                  onCheckedChange={(checked) =>
                    setPublishStatus(checked ? "published" : "draft")
                  }
                />
              </div>
            )}

            {!isAdmin && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Your event will be saved as a draft and requires admin approval to publish.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isAdmin && publishStatus === "published" ? "Create & Publish" : "Create Draft"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
