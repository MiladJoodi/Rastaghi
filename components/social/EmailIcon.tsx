import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number | string;
  title?: string;
};

/** Simple filled mail badge matching the social icon set. */
export function EmailIcon({
  size = 48,
  title = "ایمیل",
  className,
  ...rest
}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 600 600"
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title}
      focusable="false"
      className={className}
      {...rest}
    >
      <title>{title}</title>
      <path
        fill="url(#social-email-grad)"
        d="M300 0a300 300 0 1 0 0 600 300 300 0 0 0 0-600"
      />
      <path
        fill="#fff"
        d="M150 210c0-16.6 13.4-30 30-30h240c16.6 0 30 13.4 30 30v180c0 16.6-13.4 30-30 30H180c-16.6 0-30-13.4-30-30V210zm48.5 18 101.5 76.1L401.5 228H198.5zm233.5 18.9-98.4 73.8 98.4 73.8V246.9zM180 394.5l98.4-73.8L180 246.9v147.6zm37.9 15.5h164.2l-70.8-53.1c-6.8-5.1-16.1-5.1-22.9 0L217.9 410z"
      />
      <defs>
        <linearGradient
          id="social-email-grad"
          x1="300"
          x2="300"
          y1="0"
          y2="600"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#EA4335" />
          <stop offset="1" stopColor="#C5221F" />
        </linearGradient>
      </defs>
    </svg>
  );
}
