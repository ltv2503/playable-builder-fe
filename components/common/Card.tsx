import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outlined";
  padding?: "sm" | "md" | "lg";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ variant = "default", padding = "md", className, children, ...props }, ref) => {
  const baseStyles = "rounded-2xl bg-white dark:bg-zinc-900 transition-shadow duration-200";

  const variantStyles = {
    default: "shadow-sm shadow-zinc-900/5 border border-zinc-200 dark:border-zinc-800",
    outlined: "border border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
  };

  const paddingStyles = {
    sm: "p-3",
    md: "p-6",
    lg: "p-8",
  };

  const finalClassName = `${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className || ""}`;

  return (
    <div ref={ref} className={finalClassName} {...props}>
      {children}
    </div>
  );
});

Card.displayName = "Card";

export default Card;
