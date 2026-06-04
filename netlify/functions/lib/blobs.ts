import { connectLambda, getStore } from '@netlify/blobs';
import type { HandlerEvent } from '@netlify/functions';

const STORE_NAME = 'wedding-rsvps';

/** Wire Netlify Blobs context from the Lambda-compatible function event */
export function bindBlobsContext(event: HandlerEvent): void {
  // Netlify Dev injects blob config on the event; skip if absent (env may already be set).
  if ((event as HandlerEvent & { blobs?: string }).blobs) {
    connectLambda(event);
  }
}

/** RSVP payload stored in Netlify Blobs */
export interface StoredRsvp {
  partyId: string;
  partyName: string;
  attending: boolean;
  attendeeCount: number;
  dietaryNotes: string;
  message: string;
  submittedAt: string;
}

/** Get the Netlify Blobs store for RSVP data */
function getRsvpStore() {
  return getStore({ name: STORE_NAME });
}

/** Save an RSVP submission for a party */
export async function saveRsvp(rsvp: StoredRsvp): Promise<void> {
  const store = getRsvpStore();
  await store.setJSON(`rsvp/${rsvp.partyId}`, rsvp);
}

/** Load a stored RSVP by party id */
export async function getRsvp(partyId: string): Promise<StoredRsvp | null> {
  const store = getRsvpStore();
  return store.get(`rsvp/${partyId}`, { type: 'json' }) as Promise<StoredRsvp | null>;
}

/** List all stored RSVPs */
export async function listRsvps(): Promise<StoredRsvp[]> {
  const store = getRsvpStore();
  const { blobs } = await store.list({ prefix: 'rsvp/' });
  const results: StoredRsvp[] = [];

  for (const blob of blobs) {
    const data = (await store.get(blob.key, { type: 'json' })) as StoredRsvp | null;
    if (data) results.push(data);
  }

  return results;
}
