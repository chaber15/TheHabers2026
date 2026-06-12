#!/usr/bin/env node
/**
 * Import the guest list from data/guests.csv → data/guests.json.
 *
 * CSV format (column 1 is header row, skipped):
 *   Family Code, Family Name, Member 1, Member 2, Member 3, ...
 *
 * - "X's Plus One" rows are converted to a plus-one entry linked to the
 *   first family member whose first name matches X.
 * - Existing RSVP data (status, responses, dietary notes) is preserved for
 *   any party whose access code is unchanged, so re-importing after edits
 *   is non-destructive.
 * - A small set of TEST_* parties is appended for local testing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '..', 'data', 'guests.csv');
const GUESTS_PATH = path.join(__dirname, '..', 'data', 'guests.json');

/** Test parties — appended after CSV import, never overlap real codes. */
const TEST_PARTIES = [
  {
    accessCode: 'TEST01',
    partyName: 'Test Single Guest',
    memberNames: ['Test Guest'],
  },
  {
    accessCode: 'TEST02',
    partyName: 'Test Couple',
    memberNames: ['Test Spouse A', 'Test Spouse B'],
  },
  {
    accessCode: 'TEST05',
    partyName: 'Test Family',
    memberNames: [
      'Test Parent A',
      'Test Parent B',
      'Test Kid One',
      'Test Kid Two',
      'Test Kid Three',
    ],
  },
  {
    accessCode: 'TESTP1',
    partyName: 'Test Plus One',
    memberNames: ['Test Host', "Test's Plus One"],
  },
];

/** Minimal CSV parser with quoted-field support (no dependency). */
function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === ',' && !inQuote) {
        row.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** "<First>'s Plus One" → match.first = "<First>" (case-insensitive). */
function plusOneHostFirstName(name) {
  const match = name.match(/^(.+?)['\u2019]s\s+Plus\s+One$/i);
  return match ? match[1].trim() : null;
}

/** Ensure ids are unique within a set, appending -002, -003, ... on conflict. */
function uniqueId(base, used) {
  let id = base;
  let counter = 1;
  while (used.has(id)) {
    counter += 1;
    id = `${base}-${String(counter).padStart(3, '0')}`;
  }
  used.add(id);
  return id;
}

function buildParty({ accessCode, partyName, memberNames }, ctx) {
  const partyId = uniqueId(slugify(partyName), ctx.usedPartyIds);
  const memberIds = new Set();
  const members = [];

  for (const rawName of memberNames) {
    const name = rawName.trim();
    if (!name) continue;

    const hostFirst = plusOneHostFirstName(name);
    if (hostFirst) {
      const host = members.find(
        (m) => !m.isPlusOne && m.name.split(/\s+/)[0].toLowerCase() === hostFirst.toLowerCase()
      );
      if (host) {
        members.push({
          id: uniqueId(`${host.id}-plus-one`, memberIds),
          name: 'Plus One',
          isPlusOne: true,
          plusOneFor: host.id,
        });
        continue;
      }
      console.warn(
        `  ⚠ "${name}" in ${partyName} (${accessCode}) — no host with first name "${hostFirst}"; treated as named guest.`
      );
    }

    members.push({
      id: uniqueId(slugify(name), memberIds),
      name,
    });
  }

  const prior = ctx.existing.parties?.find((p) => p.accessCode === accessCode);
  return {
    id: partyId,
    partyName,
    accessCode,
    zip: prior?.zip ?? '',
    members,
    partySize: members.length,
    rsvpStatus: prior?.rsvpStatus ?? 'pending',
    rsvpSubmittedAt: prior?.rsvpSubmittedAt ?? null,
    attending: prior?.attending ?? null,
    attendeeCount: prior?.attendeeCount ?? null,
    dietaryNotes: prior?.dietaryNotes ?? null,
    message: prior?.message ?? null,
    ...(prior?.guestResponses ? { guestResponses: prior.guestResponses } : {}),
  };
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Missing CSV: ${CSV_PATH}`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCsv(csvText).slice(1); // drop header

  const existing = fs.existsSync(GUESTS_PATH)
    ? JSON.parse(fs.readFileSync(GUESTS_PATH, 'utf-8'))
    : { parties: [] };

  const ctx = {
    usedPartyIds: new Set(),
    existing,
  };

  const usedCodes = new Set();
  const parties = [];
  let preservedRsvps = 0;
  let duplicates = 0;

  for (const row of rows) {
    const accessCode = (row[0] ?? '').trim();
    const partyName = (row[1] ?? '').trim();
    if (!accessCode || !partyName) continue;

    if (usedCodes.has(accessCode)) {
      console.warn(`  ⚠ Duplicate access code ${accessCode} (${partyName}) — skipped.`);
      duplicates += 1;
      continue;
    }
    usedCodes.add(accessCode);

    const memberNames = row.slice(2).map((n) => n.trim()).filter(Boolean);
    const party = buildParty({ accessCode, partyName, memberNames }, ctx);
    if (party.rsvpStatus === 'responded') preservedRsvps += 1;
    parties.push(party);
  }

  for (const test of TEST_PARTIES) {
    if (usedCodes.has(test.accessCode)) {
      console.warn(`  ⚠ Test code ${test.accessCode} conflicts with a real code — skipped.`);
      continue;
    }
    usedCodes.add(test.accessCode);
    parties.push(buildParty(test, ctx));
  }

  fs.writeFileSync(GUESTS_PATH, `${JSON.stringify({ parties }, null, 2)}\n`);

  const real = parties.length - TEST_PARTIES.length;
  const totalGuests = parties.reduce((sum, p) => sum + p.members.length, 0);
  console.log(`\n✓ Imported ${real} parties from data/guests.csv (${totalGuests} guests total).`);
  if (preservedRsvps) console.log(`  Preserved RSVP data for ${preservedRsvps} responded part${preservedRsvps === 1 ? 'y' : 'ies'}.`);
  if (duplicates) console.log(`  Skipped ${duplicates} duplicate code row(s).`);

  console.log(`\nTest codes (for local testing):`);
  for (const t of TEST_PARTIES) {
    console.log(`  ${t.accessCode}  ${t.partyName.padEnd(22)} (${t.memberNames.length} member${t.memberNames.length === 1 ? '' : 's'})`);
  }
  console.log(`\nWrote: ${path.relative(process.cwd(), GUESTS_PATH)}`);
}

main();
