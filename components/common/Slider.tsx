import React from "react";

type SliderProps = React.InputHTMLAttributes<HTMLInputElement>;

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    type="range"
    className={`h-1.5 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
));

Slider.displayName = "Slider";

export default Slider;
