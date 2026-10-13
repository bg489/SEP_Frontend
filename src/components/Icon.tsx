import type { ReactNode } from "react";

export type IconName =
  | "overview"
  | "scenarios"
  | "campaigns"
  | "priority"
  | "failures"
  | "nodes"
  | "oracles"
  | "search"
  | "bell"
  | "plus"
  | "chevron"
  | "arrow-up"
  | "arrow-right"
  | "check"
  | "clock"
  | "activity"
  | "car"
  | "cloud"
  | "map"
  | "filter"
  | "upload"
  | "download"
  | "more"
  | "close"
  | "spark"
  | "shield"
  | "users"
  | "sun"
  | "calendar"
  | "play"
  | "refresh"
  | "external"
  | "route"
  | "eye"
  | "link"
  | "settings"
  | "circle-check"
  | "warning"
  | "dots";

const shapes: Record<IconName, ReactNode> = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4" rx="1.5" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  scenarios: (
    <>
      <path d="M4 6.5 12 3l8 3.5v11L12 21l-8-3.5z" />
      <path d="M4 6.5 12 10l8-3.5M12 10v11M8 4.8l8 3.6" />
    </>
  ),
  campaigns: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 8h8M8 12h5M8 16h3" />
      <path d="m16 14 2 2-2 2" />
    </>
  ),
  priority: (
    <>
      <path d="M4 19h16M6 16V9m6 7V5m6 11v-4" />
      <path d="m4 8 4-3 4 2 6-4" />
    </>
  ),
  failures: (
    <>
      <path d="M12 3.5 21 20H3L12 3.5Z" />
      <path d="M12 9v4.5m0 3v.1" />
    </>
  ),
  nodes: (
    <>
      <rect x="3.5" y="4" width="17" height="6" rx="2" />
      <rect x="3.5" y="14" width="17" height="6" rx="2" />
      <path d="M7.5 7h.1m-.1 10h.1M11 7h5m-5 10h5" />
    </>
  ),
  oracles: (
    <>
      <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" />
      <path d="m8.7 12 2.1 2.1 4.6-4.8" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-2.5 7.5-2.5 9h17C20.5 16.5 18 16 18 9Z" />
      <path d="M10 21h4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
  "arrow-up": (
    <>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2.3-6 4.4 12 2.3-6H21" />
    </>
  ),
  car: (
    <>
      <path d="m5 11 1.6-4.5A2 2 0 0 1 8.5 5h7a2 2 0 0 1 1.9 1.5L19 11" />
      <path d="M4 11h16v7H4zM7.5 18v2m9-2v2M7 14h.1m9.8 0h.1" />
    </>
  ),
  cloud: (
    <>
      <path d="M7.5 18H17a4 4 0 0 0 .2-8A5.5 5.5 0 0 0 6.8 9 4.5 4.5 0 0 0 7.5 18Z" />
      <path d="m9 20 1.5-2m3.5 2 1.5-2" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15m6-12v15" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16M7 12h10m-7 6h4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m-5 5 5-5 5 5" />
      <path d="M5 14v5h14v-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12m-5-5 5 5 5-5" />
      <path d="M5 19h14" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3L12 3Z" />
      <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19v-1a5.5 5.5 0 0 1 11 0v1z" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8m2 3.2a4.5 4.5 0 0 1 2.5 4v.5h-3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M7.5 3v4m9-4v4M4 9.5h16" />
    </>
  ),
  play: <path d="m9 6 9 6-9 6z" />,
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M19 12a7 7 0 1 1-2-5" />
    </>
  ),
  external: (
    <>
      <path d="M13 5h6v6m0-6-9 9" />
      <path d="M17 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h2.5a3.5 3.5 0 0 0 3.5-3.5V9.5A3.5 3.5 0 0 1 17.5 6H16" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2A5 5 0 0 0 12 3.9l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3.1 1.3v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3.1-1.3l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-1.3-3.1h-.2a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 1.3-3.1l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3.1-1.3v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3.1 1.3l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 1.3 3.1h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-1.3 3.1Z" />
    </>
  ),
  "circle-check": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 21 20H3L12 3.5Z" />
      <path d="M12 9v4.5m0 3v.1" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  );
}
