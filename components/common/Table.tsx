import React from "react";

const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className = "", ...props }, ref) => <table ref={ref} className={`w-full border-collapse text-sm ${className}`} {...props} />,
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = "", ...props }, ref) => (
    <thead ref={ref} className={`[&_tr]:border-b [&_tr]:border-zinc-100 dark:[&_tr]:border-zinc-800 ${className}`} {...props} />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = "", ...props }, ref) => (
    <tbody
      ref={ref}
      className={`[&_tr]:border-b [&_tr]:border-zinc-50 dark:[&_tr]:border-zinc-900 [&_tr:last-child]:border-0 ${className}`}
      {...props}
    />
  ),
);
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className = "", ...props }, ref) => <tr ref={ref} className={className} {...props} />,
);
TableRow.displayName = "TableRow";

const alignClass = { left: "text-left", center: "text-center", right: "text-right" } as const;

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: keyof typeof alignClass;
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ align = "left", className = "", ...props }, ref) => (
    <th
      ref={ref}
      className={`py-2 pr-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 ${alignClass[align]} ${className}`}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: keyof typeof alignClass;
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ align = "left", className = "", ...props }, ref) => (
    <td ref={ref} className={`py-2 pr-2 ${alignClass[align]} ${className}`} {...props} />
  ),
);
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
