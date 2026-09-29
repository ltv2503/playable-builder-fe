import React from "react";

type ColorInputProps = React.InputHTMLAttributes<HTMLInputElement>;

const ColorInput = React.forwardRef<HTMLInputElement, ColorInputProps>(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    type="color"
    className={`h-7 w-16 cursor-pointer rounded border border-zinc-300 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    {...props}
  />
));

ColorInput.displayName = "ColorInput";

export default ColorInput;
