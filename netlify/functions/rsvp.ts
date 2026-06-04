import type { Handler } from '@netlify/functions';
import { findPartyByCode, getMemberDisplayName, safeEqual } from './lib/guests';
import type { GuestResponse } from './lib/blobs';
import { bindBlobsContext, getRsvp, saveRsvp } from './lib/blobs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RsvpBody {
  partyId?: string;
  accessCode?: string;
  guestResponses?: GuestResponse[];
  dietaryNotes?: string;
  message?: string;
}

/** Validate submitted guest responses match the party roster */
function validateGuestResponses(
  party: { members: Array<{ id: string; name: string }> },
  responses: GuestResponse[] | undefined
): GuestResponse[] | null {
  if (!responses?.length) return null;

  const memberMap = new Map(
    party.members.map((m) => [m.id, getMemberDisplayName(m, party.members)])
  );
  if (responses.length !== memberMap.size) return null;

  const seen = new Set<string>();
  const normalized: GuestResponse[] = [];

  for (const entry of responses) {
    if (!entry.guestId || typeof entry.attending !== 'boolean') return null;
    if (!memberMap.has(entry.guestId) || seen.has(entry.guestId)) return null;
    seen.add(entry.guestId);
    normalized.push({
      guestId: entry.guestId,
      name: memberMap.get(entry.guestId)!,
      attending: entry.attending,
    });
  }

  return normalized;
}

/** Accept and persist an RSVP submission */
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    bindBlobsContext(event);
    const body = JSON.parse(event.body ?? '{}') as RsvpBody;
    const { partyId, accessCode, guestResponses, dietaryNotes, message } = body;

    if (!partyId || !accessCode) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing required fields.' }),
      };
    }

    const party = findPartyByCode(accessCode);
    if (!party || party.id !== partyId) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid access code for this party.' }),
      };
    }

    if (!safeEqual(party.accessCode, accessCode.trim().toUpperCase())) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid access code.' }),
      };
    }

    const existing = await getRsvp(partyId);
    if (existing) {
      return {
        statusCode: 409,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'An RSVP has already been submitted for this invitation.',
          rsvp: existing,
        }),
      };
    }

    const normalized = validateGuestResponses(party, guestResponses);
    if (!normalized) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Please select coming or not coming for each guest.' }),
      };
    }

    const attendeeCount = normalized.filter((g) => g.attending).length;

    const rsvp = {
      partyId: party.id,
      partyName: party.partyName,
      guestResponses: normalized,
      attending: attendeeCount > 0,
      attendeeCount,
      dietaryNotes: (dietaryNotes ?? '').trim(),
      message: (message ?? '').trim(),
      submittedAt: new Date().toISOString(),
    };

    await saveRsvp(rsvp);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, rsvp }),
    };
  } catch {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' }),
    };
  }
};
