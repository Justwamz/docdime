import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  isOverdue?: boolean;
  isExpired?: boolean;
}

export function StatusBadge({ status, isOverdue, isExpired }: StatusBadgeProps) {
  if (isOverdue) {
    return <Badge variant="danger">Overdue</Badge>;
  }

  if (isExpired) {
    return <Badge variant="warning">Expired</Badge>;
  }

  const variantMap: Record<string, "default" | "success" | "warning" | "danger" | "info" | "gray"> = {
    DRAFT: "gray",
    SENT: "info",
    PAID: "success",
    ACCEPTED: "success",
    REJECTED: "danger",
    CANCELLED: "gray",
  };

  const labelMap: Record<string, string> = {
    DRAFT: "Draft",
    SENT: "Sent",
    PAID: "Paid",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };

  return (
    <Badge variant={variantMap[status] ?? "gray"}>
      {labelMap[status] ?? status}
    </Badge>
  );
}
