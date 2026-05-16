/* ============================================================
   Provider brand-style icons (hand-crafted, non-trademarked)
   Each returns inner SVG content; renderer wraps in <svg viewBox="0 0 24 24">
   ============================================================ */

const ICONS = {
  codex: `
    <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.18"/>
    <path d="M12 4.2a7.8 7.8 0 0 0-6.5 12.1 7.5 7.5 0 0 1 13 0A7.8 7.8 0 0 0 12 4.2Z" fill="currentColor"/>
    <circle cx="12" cy="11" r="2.3" fill="#fff"/>
  `,
  claude: `
    <path d="M12 3.5l1.6 4.4 4.6.6-3.4 3 .9 4.5L12 13.8 8.3 16l.9-4.5-3.4-3 4.6-.6L12 3.5z" fill="currentColor"/>
  `,
  cursor: `
    <path d="M5 4l14 8-6 1.5L11 19 5 4z" fill="currentColor"/>
    <path d="M5 4l14 8-6 1.5L11 19 5 4z" fill="none" stroke="#fff" stroke-width="0.8" stroke-linejoin="round" opacity="0.45"/>
  `,
  copilot: `
    <ellipse cx="12" cy="13" rx="8" ry="6" fill="currentColor"/>
    <circle cx="9.3" cy="13" r="1.4" fill="#fff"/>
    <circle cx="14.7" cy="13" r="1.4" fill="#fff"/>
    <path d="M7 9c0-2.2 2-3.5 4-3.5h2c2 0 4 1.3 4 3.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  `,
  gemini: `
    <path d="M12 3l1.8 5.5L19 10l-5.2 1.5L12 17l-1.8-5.5L5 10l5.2-1.5L12 3z" fill="currentColor"/>
  `,
  jetbrains: `
    <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor"/>
    <path d="M6 17h6v1.4H6z" fill="#fff"/>
    <path d="M8.5 7h2.2v6.3c0 1.4-.6 2.1-1.9 2.1-.7 0-1.3-.2-1.6-.5l.4-1.4c.2.2.5.3.8.3.5 0 .7-.3.7-.9V7z" fill="#fff"/>
  `,
  windsurf: `
    <path d="M3 8.5c2.5-1.5 4.5-1 6 0s3 1.5 5.5 0c1.5-.9 4-1 6 0M3 13c2.5-1.5 4.5-1 6 0s3 1.5 5.5 0c1.5-.9 4-1 6 0M3 17.5c2.5-1.5 4.5-1 6 0s3 1.5 5.5 0c1.5-.9 4-1 6 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  `,
  amp: `
    <path d="M12 3L4 21h4l1.4-4h5.2L16 21h4L12 3zm-1.6 11L12 9l1.6 5h-3.2z" fill="currentColor"/>
  `,
  factory: `
    <path d="M3 21V11l5 3V11l5 3V11l8 5v5H3z" fill="currentColor"/>
    <rect x="5" y="17" width="2" height="2" fill="#fff"/>
    <rect x="11" y="17" width="2" height="2" fill="#fff"/>
    <rect x="17" y="17" width="2" height="2" fill="#fff"/>
  `,
  antigravity: `
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="1.4" opacity="0.5"/>
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
  `,
  perplexity: `
    <rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor"/>
    <path d="M12 7v10M7 12h10" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
  `,
  default: `
    <circle cx="12" cy="12" r="9" fill="currentColor"/>
    <text x="12" y="16" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="11" font-weight="700">?</text>
  `
};

function iconFor(key) {
  return ICONS[key] || ICONS.default;
}

window.WinUsageIcons = { iconFor };
