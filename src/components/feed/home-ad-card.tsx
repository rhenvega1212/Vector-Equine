"use client";

import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface HomeAdCardProps {
  ad: {
    id: string;
    advertiser_name: string;
    title: string;
    body: string | null;
    image_url: string | null;
    click_url: string;
  };
}

export function HomeAdCard({ ad }: HomeAdCardProps) {
  return (
    <Card className="border-amber-400/20 bg-amber-400/[0.03] hover:bg-amber-400/[0.06] transition-all duration-200 overflow-hidden">
      <a
        href={ad.click_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        {ad.image_url && (
          <div className="aspect-[2/1] w-full overflow-hidden">
            <img
              src={ad.image_url}
              alt={ad.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}
        <CardContent className="pt-4 pb-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant="secondary"
              className="text-[10px] font-medium uppercase tracking-wider bg-amber-400/10 text-amber-400/80 border-amber-400/20"
            >
              Sponsored
            </Badge>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="font-semibold leading-tight">{ad.title}</p>
          {ad.body && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {ad.body}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {ad.advertiser_name}
          </p>
        </CardContent>
      </a>
    </Card>
  );
}
