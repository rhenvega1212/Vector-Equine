"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const EVENT_TYPES = [
  { value: "all", label: "All Types" },
  { value: "clinic", label: "Clinics" },
  { value: "show", label: "Shows" },
  { value: "run_club", label: "Run Clubs" },
  { value: "workout_group", label: "Workout Groups" },
  { value: "movie_night", label: "Movie Nights" },
  { value: "networking", label: "Networking" },
];

const DATE_FILTERS = [
  { value: "all", label: "Any Date" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "upcoming", label: "Upcoming" },
];

interface EventFiltersProps {
  currentType?: string;
  currentDate?: string;
}

export function EventFilters({ currentType, currentDate }: EventFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/events?${params.toString()}`);
  }

  function clearFilters() {
    router.push("/events");
  }

  const hasFilters = currentType || currentDate;

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <Select
        value={currentType || "all"}
        onValueChange={(value) => updateFilter("type", value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Event Type" />
        </SelectTrigger>
        <SelectContent>
          {EVENT_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentDate || "all"}
        onValueChange={(value) => updateFilter("date", value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Date" />
        </SelectTrigger>
        <SelectContent>
          {DATE_FILTERS.map((date) => (
            <SelectItem key={date.value} value={date.value}>
              {date.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
