import React from "react";

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={`h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  ),
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
