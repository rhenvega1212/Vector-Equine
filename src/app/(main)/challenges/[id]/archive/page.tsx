import { notFound } from "next/navigation";
import Link from "next/link";
import { getArchiveData } from "@/lib/challenges/archive";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Archive, FileText, Link as LinkIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ArchivePageProps {
  params: Promise<{ id: string }>;
}

export default async function ChallengeArchivePage({ params }: ArchivePageProps) {
  const { id } = await params;
  const data = await getArchiveData(id);
  if (!data) notFound();

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/challenges/${id}`}>
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to challenge
        </Button>
      </Link>

      <div className="mb-6 flex items-center gap-2">
        <Archive className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">{data.challenge.title}</h1>
          <p className="text-sm text-muted-foreground">
            Archive — participant submissions only. Course content is not shown.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {data.items?.map((item: any) => (
          <Card key={item.assignment.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {item.assignment.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {item.submissions?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No submissions in archive.</p>
              ) : (
                item.submissions?.map((sub: any) => (
                  <div key={sub.id} className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{sub.author_display_name}</span>
                      <span>{formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}</span>
                    </div>
                    {sub.content && <p className="text-sm whitespace-pre-wrap">{sub.content}</p>}
                    {sub.media_url && (
                      <div className="mt-2">
                        {sub.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img
                            src={sub.media_url}
                            alt="Submission"
                            className="max-w-full max-h-64 rounded object-contain"
                          />
                        ) : sub.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                          <video
                            src={sub.media_url}
                            controls
                            className="max-w-full max-h-64 rounded"
                          />
                        ) : (
                          <a
                            href={sub.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <LinkIcon className="h-4 w-4" />
                            View attachment
                          </a>
                        )}
                      </div>
                    )}
                    {sub.comments?.length > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        {sub.comments.map((c: any) => (
                          <div key={c.id} className="text-sm pl-2 border-l-2 border-muted">
                            <span className="font-medium text-muted-foreground">{c.author_display_name}</span>
                            <span className="text-muted-foreground"> · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                            <p className="mt-0.5">{c.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {(!data.items || data.items.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No assignment submissions in this archive.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
