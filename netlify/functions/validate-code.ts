import type { Handler } from '@netlify/functions';
import { findPartyByCode, toPublicParty } from './lib/guests';
import { bindBlobsContext, getRsvp } from './lib/blobs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Validate a guest access code and return party details */
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
    const body = JSON.parse(event.body ?? '{}') as { code?: string };
    const code = body.code?.trim();

    if (!code) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Access code is required.' }),
      };
    }

    const party = findPartyByCode(code);
    if (!party) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid access code. Check your invitation and try again.' }),
      };
    }

    const stored = await getRsvp(party.id);
    const publicParty = toPublicParty(party);

    if (stored) {
      publicParty.rsvpStatus = 'responded';
      publicParty.attending = stored.attending;
      publicParty.attendeeCount = stored.attendeeCount;
      publicParty.dietaryNotes = stored.dietaryNotes;
      publicParty.message = stored.message;
      publicParty.rsvpSubmittedAt = stored.submittedAt;
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ party: publicParty }),
    };
  } catch {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' }),
    };
  }
};
