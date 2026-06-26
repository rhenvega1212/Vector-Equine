import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { HorseHeadIcon } from "@/components/icons/horse-head";
import Image from "next/image";

export interface HorseProfile {
  id: string;
  name: string;
  barn_name?: string | null;
  discipline?: string | null;
  training_level?: string | null;
  profile_photo_url?: string | null;
  [key: string]: unknown;
}

interface HorseCardProps {
  horse: HorseProfile;
  showSessionCount?: number;
  compact?: boolean;
}

export function HorseCard({ horse, showSessionCount, compact }: HorseCardProps) {
  const displayName = horse.barn_name?.trim() ? `${horse.name} (“${horse.barn_name}”)` : horse.name;

  return (
    <Link href={`/train/horses/${horse.id}`}>
      <Card className="border-gold/20 bg-slate-800/30 overflow-hidden transition-colors hover:border-gold/40 hover:bg-slate-800/50">
        <CardContent className={compact ? "p-4" : "p-0"}>
          {compact ? (
            <div className="flex items-center gap-3">
              {horse.profile_photo_url ? (
                <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={horse.profile_photo_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gold/20">
                  <HorseHeadIcon size={24} className="text-gold" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{displayName}</p>
                {horse.discipline && (
                  <p className="text-xs text-muted-foreground truncate">{horse.discipline}</p>
                )}
                {showSessionCount != null && (
                  <p className="text-xs text-gold/90">{showSessionCount} sessions</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex gap-4 p-4">
              {horse.profile_photo_url ? (
                <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={horse.profile_photo_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gold/20">
                  <HorseHeadIcon size={40} className="text-gold" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{displayName}</p>
                {horse.discipline && (
                  <p className="text-sm text-muted-foreground">{horse.discipline}</p>
                )}
                {horse.training_level != null && (
                  <p className="text-xs text-muted-foreground">{String(horse.training_level)}</p>
                )}
                {showSessionCount != null && (
                  <p className="text-sm text-gold/90 mt-1">{showSessionCount} sessions</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
