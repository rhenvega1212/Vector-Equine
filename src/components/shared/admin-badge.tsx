"use client";

import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

interface AdminBadgeProps {
  className?: string;
  showIcon?: boolean;
}

export function AdminBadge({ className = "", showIcon = false }: AdminBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={`text-[10px] px-1.5 py-0 h-4 border-gold/40 bg-gold/10 text-gold font-medium ${className}`}
      style={{
        boxShadow: '0 0 8px rgba(34, 211, 238, 0.3)',
      }}
    >
      {showIcon && <Shield className="h-2.5 w-2.5 mr-0.5" />}
      Admin
    </Badge>
  );
}
