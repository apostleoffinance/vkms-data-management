import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  highlight?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  trendPositive,
  highlight,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
        highlight && "border-primary/20 ring-1 ring-primary/10",
        className,
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-[2.5rem] font-bold leading-none tracking-tight text-foreground tabular-nums">
              {value}
            </p>
            {trend && (
              <p
                className={cn(
                  "text-sm font-medium",
                  trendPositive === true && "text-emerald-600 dark:text-emerald-400",
                  trendPositive === false && "text-amber-600 dark:text-amber-400",
                  trendPositive === undefined && "text-muted-foreground",
                )}
              >
                {trend}
              </p>
            )}
          </div>
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              highlight ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
            aria-hidden="true"
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
