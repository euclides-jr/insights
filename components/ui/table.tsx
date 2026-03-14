import { cn } from "@/lib/utils";

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={cn("border border-[#E8E8E8] bg-white", className)}>
      {children}
    </div>
  );
}

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function TableHeader({ children, className }: TableHeaderProps) {
  return (
    <div className={cn("bg-[#FAFAFA] border-b border-[#E8E8E8]", className)}>
      {children}
    </div>
  );
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
}

export function TableRow({ children, className }: TableRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-4 border-t border-[#E8E8E8] first:border-t-0 bg-white",
        className
      )}
    >
      {children}
    </div>
  );
}

interface TableCellProps {
  children: React.ReactNode;
  width?: string;
  className?: string;
}

export function TableCell({ children, width, className }: TableCellProps) {
  return (
    <div className={cn("text-sm", className)} style={{ width }}>
      {children}
    </div>
  );
}
