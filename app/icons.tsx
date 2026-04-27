type IconProps = {
  size?: number;
  className?: string;
};

export function PenIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20l1.4-4.2L16 5.2a2 2 0 0 1 2.8 0a2 2 0 0 1 0 2.8L8.2 18.6 4 20z" />
      <path d="M14.5 6.7l2.8 2.8" />
      <path d="M5.4 15.8l2.8 2.8" />
    </svg>
  );
}
