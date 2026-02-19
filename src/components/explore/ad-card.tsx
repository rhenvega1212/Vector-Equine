"use client";

import { ExternalLink } from "lucide-react";

interface AdCardProps {
  ad: {
    id: string;
    advertiser_name: string;
    title: string;
    body: string | null;
    image_url: string | null;
    click_url: string;
  };
}

export function AdCard({ ad }: AdCardProps) {
  return (
    <a
      href={ad.click_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10 transition-all duration-200 overflow-hidden group"
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
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-amber-400/70">
            Sponsored
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold leading-tight">{ad.title}</p>
        {ad.body && (
          <p className="text-xs text-muted-foreground line-clamp-2">{ad.body}</p>
        )}
        <p className="text-[11px] text-muted-foreground">{ad.advertiser_name}</p>
      </div>
    </a>
  );
}
