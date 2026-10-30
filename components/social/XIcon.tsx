import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number | string;
  title?: string;
};

export function XIcon({
  size = 48,
  title = "ایکس",
  className,
  ...rest
}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 640"
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title}
      focusable="false"
      className={className}
      fill="currentColor"
      {...rest}
    >
      <title>{title}</title>
      <path d="M453.2 112L523.8 112L369.6 288.2L551 528L409 528L297.7 382.6L170.5 528L99.8 528L264.7 339.5L90.8 112L236.4 112L336.9 244.9L453.2 112zM428.4 485.8L467.5 485.8L215.1 152L173.1 152L428.4 485.8z" />
    </svg>
  );
}
