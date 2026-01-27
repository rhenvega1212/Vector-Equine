"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedList } from "./feed-list";

interface FeedTabsProps {
  userId: string;
}

export function FeedTabs({ userId }: FeedTabsProps) {
  const [activeTab, setActiveTab] = useState("following");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
      <TabsList className="w-full">
        <TabsTrigger value="following" className="flex-1">
          Following
        </TabsTrigger>
        <TabsTrigger value="explore" className="flex-1">
          Explore
        </TabsTrigger>
      </TabsList>

      <TabsContent value="following" className="mt-4">
        <FeedList type="following" userId={userId} />
      </TabsContent>

      <TabsContent value="explore" className="mt-4">
        <FeedList type="explore" userId={userId} />
      </TabsContent>
    </Tabs>
  );
}
