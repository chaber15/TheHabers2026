import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Named guest on an invitation (plus-one slots use isPlusOne + plusOneFor) */
export interface GuestMember {
  id: string;
  name: string;
  isPlusOne?: boolean;
  /** Guest id this plus-one is attending with */
  plusOneFor?: string;
}

/** First name (or first token) for plus-one labels */
function hostFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/** Display name shown on RSVP (e.g. Plus One (Morgan)) */
export function getMemberDisplayName(member: GuestMember, members: GuestMember[]): string {
  if (member.isPlusOne && member.plusOneFor) {
    const host = members.find((m) => m.id === member.plusOneFor);
    if (host) return `Plus One (${hostFirstName(host.name)})`;
  }
  if (member.isPlusOne) return 'Plus One';
  return member.name;
}

/** Guest party record from guests.json */
export interface GuestParty {
  id: string;
  partyName: string;
  partySize: number;
  accessCode: string;
  zip: string;
  members: GuestMember[];
  rsvpStatus: 'pending' | 'responded';
  rsvpSubmittedAt: string | null;
  attending: boolean | null;
  attendeeCount: number | null;
  dietaryNotes: string | null;
  message: string | null;
}

export interface GuestFile {
  parties: GuestParty[];
}

const GUESTS_PATH = path.join(process.cwd(), 'data', 'guests.json');

/** Load the guest list from the flat file (server-side only) */
export function loadGuests(): GuestFile {
  const raw = fs.readFileSync(GUESTS_PATH, 'utf-8');
  return JSON.parse(raw) as GuestFile;
}

/** Timing-safe string comparison for access codes */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Find a party by access code (case-insensitive input, stored uppercase) */
export function findPartyByCode(code: string): GuestParty | undefined {
  const normalized = code.trim().toUpperCase();
  return loadGuests().parties.find((party) => safeEqual(party.accessCode, normalized));
}

/** Find a party by id */
export function findPartyById(id: string): GuestParty | undefined {
  return loadGuests().parties.find((party) => party.id === id);
}

/** Public-safe party info returned after code validation */
export function toPublicParty(party: GuestParty) {
  return {
    partyId: party.id,
    partyName: party.partyName,
    partySize: party.partySize,
    members: party.members.map((m) => ({
      id: m.id,
      name: m.name,
      displayName: getMemberDisplayName(m, party.members),
      isPlusOne: Boolean(m.isPlusOne),
      plusOneFor: m.plusOneFor ?? null,
    })),
    rsvpStatus: party.rsvpStatus,
    attending: party.attending,
    attendeeCount: party.attendeeCount,
    guestResponses: null as Array<{ guestId: string; name: string; attending: boolean }> | null,
    dietaryNotes: party.dietaryNotes,
    message: party.message,
    rsvpSubmittedAt: party.rsvpSubmittedAt,
  };
}
