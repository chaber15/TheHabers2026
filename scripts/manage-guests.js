#!/usr/bin/env node
/**
 * CLI for managing the wedding guest list in data/guests.json.
 *
 * Usage:
 *   node scripts/manage-guests.js add --name "The Smith Family" --size 2 [--zip 12345]
 *   node scripts/manage-guests.js list
 *   node scripts/manage-guests.js regenerate-code --id smith-001
 *   node scripts/manage-guests.js export-rsvps [--url https://yoursite.netlify.app]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUESTS_PATH = path.join(__dirname, '..', 'data', 'guests.json');
const EXPORT_PATH = path.join(__dirname, '..', 'data', 'rsvp-export.json');

/** Parse simple CLI flags from process.argv */
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }
  return args;
}

/** Load guests.json */
function loadGuests() {
  return JSON.parse(fs.readFileSync(GUESTS_PATH, 'utf-8'));
}

/** Save guests.json with pretty formatting */
function saveGuests(data) {
  fs.writeFileSync(GUESTS_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

/** Generate a random 6-character alphanumeric access code */
function generateCode(existingCodes) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  do {
    code = Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join('');
  } while (existingCodes.has(code));

  return code;
}

/** Slugify a party name into an id prefix */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

/** Add a new party to the guest list */
function addGuest(args) {
  const name = args.name;
  const size = Number(args.size);
  const zip = args.zip ?? '';

  if (!name || !size || size < 1) {
    console.error('Usage: add --name "Party Name" --size 2 [--zip 12345]');
    process.exit(1);
  }

  const data = loadGuests();
  const existingCodes = new Set(data.parties.map((p) => p.accessCode));
  const baseId = slugify(name);
  let id = baseId;
  let counter = 1;

  while (data.parties.some((p) => p.id === id)) {
    id = `${baseId}-${String(counter).padStart(3, '0')}`;
    counter += 1;
  }

  const party = {
    id,
    partyName: name,
    partySize: size,
    accessCode: generateCode(existingCodes),
    zip,
    rsvpStatus: 'pending',
    rsvpSubmittedAt: null,
    attending: null,
    attendeeCount: null,
    dietaryNotes: null,
    message: null,
  };

  data.parties.push(party);
  saveGuests(data);

  console.log(`Added party: ${party.partyName}`);
  console.log(`  ID:   ${party.id}`);
  console.log(`  Code: ${party.accessCode}`);
  console.log(`  Size: ${party.partySize}`);
}

/** List all parties */
function listGuests() {
  const data = loadGuests();

  if (data.parties.length === 0) {
    console.log('No parties in guest list.');
    return;
  }

  console.log(`\n${'Party'.padEnd(30)} ${'Code'.padEnd(8)} Size  Status`);
  console.log('-'.repeat(60));

  for (const party of data.parties) {
    console.log(
      `${party.partyName.padEnd(30)} ${party.accessCode.padEnd(8)} ${String(party.partySize).padEnd(4)}  ${party.rsvpStatus}`
    );
  }

  console.log(`\nTotal: ${data.parties.length} parties`);
}

/** Regenerate access code for an existing party */
function regenerateCode(args) {
  const id = args.id;
  if (!id) {
    console.error('Usage: regenerate-code --id party-id');
    process.exit(1);
  }

  const data = loadGuests();
  const party = data.parties.find((p) => p.id === id);

  if (!party) {
    console.error(`Party not found: ${id}`);
    process.exit(1);
  }

  const existingCodes = new Set(data.parties.map((p) => p.accessCode));
  existingCodes.delete(party.accessCode);
  party.accessCode = generateCode(existingCodes);
  saveGuests(data);

  console.log(`New code for ${party.partyName}: ${party.accessCode}`);
}

/** Export RSVPs from the admin API to a local JSON file */
async function exportRsvps(args) {
  const baseUrl = args.url ?? process.env.SITE_URL ?? 'http://localhost:8888';
  const password = args.password ?? process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error('Set ADMIN_PASSWORD env var or pass --password');
    process.exit(1);
  }

  const loginRes = await fetch(`${baseUrl}/api/admin?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!loginRes.ok) {
    console.error('Login failed. Check password and site URL.');
    process.exit(1);
  }

  const { token } = await loginRes.json();

  const listRes = await fetch(`${baseUrl}/api/admin?action=list`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listRes.ok) {
    console.error('Failed to fetch RSVP list.');
    process.exit(1);
  }

  const data = await listRes.json();
  fs.writeFileSync(EXPORT_PATH, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Exported ${data.parties.length} parties to data/rsvp-export.json`);
}

/** CLI entry point */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  switch (command) {
    case 'add':
      addGuest(args);
      break;
    case 'list':
      listGuests();
      break;
    case 'regenerate-code':
      regenerateCode(args);
      break;
    case 'export-rsvps':
      await exportRsvps(args);
      break;
    default:
      console.log(`Guest list manager for Caleb & Emma Wedding

Commands:
  add              Add a party (--name, --size, optional --zip)
  list             List all parties and codes
  regenerate-code  New access code (--id)
  export-rsvps     Pull RSVPs from live site (--url, --password)`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
