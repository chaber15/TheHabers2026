/** Flip to `true` when a page is ready to publish */
export const PAGE_AVAILABLE = {
  schedule: true,
  gallery: true,
  faq: true,
} as const;

export type UnavailablePageId = keyof typeof PAGE_AVAILABLE;

export function isPageAvailable(id: UnavailablePageId): boolean {
  return PAGE_AVAILABLE[id];
}
