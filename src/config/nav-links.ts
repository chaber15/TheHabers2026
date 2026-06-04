import { PAGE_AVAILABLE } from './page-availability';

export interface NavLink {
  href: string;
  label: string;
  pageId?: keyof typeof PAGE_AVAILABLE;
}

const ALL_NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/schedule', label: 'Schedule', pageId: 'schedule' },
  { href: '/gallery', label: 'About Us', pageId: 'gallery' },
  { href: '/wedding-party', label: 'Wedding Party' },
  { href: '/registry', label: 'Registry' },
  { href: '/faq', label: 'FAQ', pageId: 'faq' },
  { href: '/rsvp', label: 'RSVP' },
];

export const navLinks = ALL_NAV_LINKS.filter(
  (link) => !link.pageId || PAGE_AVAILABLE[link.pageId]
);
