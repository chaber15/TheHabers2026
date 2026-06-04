import type { Handler } from '@netlify/functions';
import { createAdminToken, getBearerToken, verifyAdminToken } from './lib/auth';
import { loadGuests } from './lib/guests';
import { bindBlobsContext, listRsvps } from './lib/blobs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/** Build CSV export from guest list merged with blob RSVPs */
function buildCsv(rows: Array<Record<string, string | number | boolean | null>>): string {
  if (rows.length === 0) return 'partyId,partyName,partySize,accessCode,rsvpStatus,attending,attendeeCount,dietaryNotes,message,submittedAt\n';

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((key) => {
          const value = row[key];
          const str = value === null || value === undefined ? '' : String(value);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(',')
    ),
  ];

  return lines.join('\n');
}

/** Admin API: login, list RSVPs, export CSV */
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const action = event.queryStringParameters?.action ?? 'list';

  // Login does not require a token
  if (event.httpMethod === 'POST' && action === 'login') {
    try {
      const body = JSON.parse(event.body ?? '{}') as { password?: string };
      const token = createAdminToken(body.password ?? '');

      if (!token) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Invalid password.' }),
        };
      }

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Login failed.' }),
      };
    }
  }

  const token = getBearerToken(event.headers.authorization ?? event.headers.Authorization);
  if (!verifyAdminToken(token)) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized.' }),
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    bindBlobsContext(event);
    const guests = loadGuests();
    const rsvps = await listRsvps();
    const rsvpMap = new Map(rsvps.map((r) => [r.partyId, r]));

    const merged = guests.parties.map((party) => {
      const rsvp = rsvpMap.get(party.id);
      return {
        partyId: party.id,
        partyName: party.partyName,
        partySize: party.partySize,
        accessCode: party.accessCode,
        zip: party.zip,
        rsvpStatus: rsvp ? 'responded' : party.rsvpStatus,
        attending: rsvp?.attending ?? party.attending,
        attendeeCount: rsvp?.attendeeCount ?? party.attendeeCount,
        dietaryNotes: rsvp?.dietaryNotes ?? party.dietaryNotes,
        message: rsvp?.message ?? party.message,
        submittedAt: rsvp?.submittedAt ?? party.rsvpSubmittedAt,
      };
    });

    if (action === 'export') {
      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="rsvp-export.csv"',
        },
        body: buildCsv(merged),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parties: merged }),
    };
  } catch {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to load RSVP data.' }),
    };
  }
};
