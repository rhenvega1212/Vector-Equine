"use client";

import { Card, CardContent } from "@/components/ui/card";

interface LessonContentProps {
  block: {
    id: string;
    block_type: "rich_text" | "image" | "video" | "file";
    content: string | null;
    file_name: string | null;
  };
}

export function LessonContent({ block }: LessonContentProps) {
  switch (block.block_type) {
    case "rich_text":
      return (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div
            dangerouslySetInnerHTML={{
              __html: parseMarkdown(block.content || ""),
            }}
          />
        </div>
      );

    case "image":
      return (
        <div className="rounded-lg overflow-hidden">
          <img
            src={block.content || ""}
            alt={block.file_name || "Lesson image"}
            className="w-full"
          />
        </div>
      );

    case "video":
      return (
        <div className="aspect-video rounded-lg overflow-hidden bg-muted">
          {block.content?.includes("youtube") ||
          block.content?.includes("youtu.be") ? (
            <iframe
              src={getYouTubeEmbedUrl(block.content)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={block.content || ""}
              controls
              className="w-full h-full"
            />
          )}
        </div>
      );

    case "file":
      return (
        <Card>
          <CardContent className="p-4">
            <a
              href={block.content || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 hover:underline"
            >
              <div className="bg-muted rounded p-2">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span className="font-medium">
                {block.file_name || "Download file"}
              </span>
            </a>
          </CardContent>
        </Card>
      );

    default:
      return null;
  }
}

// Simple markdown parser for basic formatting
function parseMarkdown(text: string): string {
  return text
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*)\*/gim, "<em>$1</em>")
    .replace(/^\- (.*$)/gim, "<li>$1</li>")
    .replace(/^\d+\. (.*$)/gim, "<li>$1</li>")
    .replace(/\n/gim, "<br>");
}

function getYouTubeEmbedUrl(url: string): string {
  const videoId = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  )?.[1];
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
}
