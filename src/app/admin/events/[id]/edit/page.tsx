"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { updateEventSchema, type UpdateEventInput } from "@/lib/validations/event";
import { createClient } from "@/lib/supabase/client";
import { uploadFile, isValidImageType } from "@/lib/uploads/storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Upload, X, Save, Eye, Trash2 } from "lucide-react";

const EVENT_TYPES = [
  { value: "clinic", label: "Clinic" },
  { value: "show", label: "Show" },
  { value: "run_club", label: "Run Club" },
  { value: "workout_group", label: "Workout Group" },
  { value: "movie_night", label: "Movie Night" },
  { value: "networking", label: "Networking" },
];

interface EventData {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  location_city: string | null;
  location_state: string | null;
  location_address: string | null;
  start_time: string;
  end_time: string;
  capacity: number | null;
  price_display: string | null;
  banner_image_url: string | null;
  is_published: boolean;
  status: string | null;
  host_id: string;
}

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { toast } = useToast();
  
  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [publishStatus, setPublishStatus] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdateEventInput>({
    resolver: zodResolver(updateEventSchema),
  });

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  async function fetchEvent() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}`);
      if (response.ok) {
        const data = await response.json();
        setEvent(data);
        setBannerUrl(data.banner_image_url);
        setPublishStatus(data.is_published || data.status === "published");
        
        // Format dates for datetime-local input
        const formatForInput = (dateStr: string) => {
          const date = new Date(dateStr);
          return date.toISOString().slice(0, 16);
        };
        
        reset({
          title: data.title,
          description: data.description || "",
          event_type: data.event_type,
          location_city: data.location_city || "",
          location_state: data.location_state || "",
          location_address: data.location_address || "",
          start_time: formatForInput(data.start_time),
          end_time: formatForInput(data.end_time),
          capacity: data.capacity || undefined,
          price_display: data.price_display || "",
          banner_image_url: data.banner_image_url || "",
          is_published: data.is_published,
        });
      } else {
        toast({
          title: "Error",
          description: "Event not found.",
          variant: "destructive",
        });
        router.push("/admin/events");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load event.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
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

  async function onSubmit(data: UpdateEventInput) {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          is_published: publishStatus,
          status: publishStatus ? "published" : "draft",
        }),
      });

      if (response.ok) {
        toast({
          title: "Event updated",
          description: publishStatus 
            ? "Your changes have been saved and the event is published."
            : "Your changes have been saved as a draft.",
        });
        router.push("/admin/events");
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to update event");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update event.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Event deleted",
          description: "The event has been permanently removed.",
        });
        router.push("/admin/events");
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete event.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/events">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Edit Event</h1>
            <p className="text-muted-foreground">{event.title}</p>
          </div>
        </div>
        <Badge variant={publishStatus ? "default" : "secondary"}>
          {publishStatus ? "Published" : "Draft"}
        </Badge>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Select 
                value={watch("event_type")} 
                onValueChange={(value) => setValue("event_type", value as any)}
              >
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Publish Event</p>
                <p className="text-sm text-muted-foreground">
                  {publishStatus 
                    ? "This event is visible to all users"
                    : "Only admins can see this event"}
                </p>
              </div>
              <Switch
                checked={publishStatus}
                onCheckedChange={setPublishStatus}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete Event
          </Button>

          <div className="flex gap-2">
            <Link href={`/events/${eventId}`}>
              <Button type="button" variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-cyan-500 hover:bg-cyan-400 text-black"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
