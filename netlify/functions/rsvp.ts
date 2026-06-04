import type { Handler } from '@netlify/functions';
import { findPartyByCode, safeEqual } from './lib/guests';
import { bindBlobsContext, getRsvp, saveRsvp } from './lib/blobs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RsvpBody {
  partyId?: string;
  accessCode?: string;
  attending?: boolean;
  attendeeCount?: number;
  dietaryNotes?: string;
  message?: string;
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
    const { partyId, accessCode, attending, attendeeCount, dietaryNotes, message } = body;

    if (!partyId || !accessCode || attending === undefined) {
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

    const count = attending ? Math.min(Number(attendeeCount) || 1, party.partySize) : 0;

    if (attending && count < 1) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Please specify how many guests will attend.' }),
      };
    }

    const rsvp = {
      partyId: party.id,
      partyName: party.partyName,
      attending: Boolean(attending),
      attendeeCount: attending ? count : 0,
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
