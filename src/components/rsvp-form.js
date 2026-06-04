/**
 * Two-step RSVP form: access code validation, then per-guest attendance.
 */
import { API_RSVP, API_VALIDATE_CODE, apiUrl } from '../utils/constants.ts';

/** Initialize the RSVP form inside the given root element */
export function initRsvpForm(root) {
  let party = null;

  root.innerHTML = `
    <div class="rsvp-step" data-step="code">
      <p class="rsvp-intro">Enter the access code printed on your invitation to RSVP.</p>
      <div class="form-group">
        <label for="access-code">Access Code</label>
        <input id="access-code" class="form-input" type="text" autocomplete="off" placeholder="e.g. HBRFAM" maxlength="12" />
      </div>
      <button type="button" class="btn btn-primary" id="validate-btn">Continue</button>
      <p class="form-error" id="code-error" hidden></p>
    </div>

    <div class="rsvp-step" data-step="form" hidden>
      <p class="rsvp-greeting" id="party-greeting"></p>
      <form id="rsvp-form">
        <div class="form-group">
          <p class="guest-list-label">Please let us know who will be joining us.</p>
          <div id="guest-list" class="guest-list"></div>
        </div>
        <div class="form-group">
          <label for="dietary-notes">Dietary restrictions (optional)</label>
          <input id="dietary-notes" class="form-input" type="text" placeholder="Vegetarian, gluten-free, etc." />
        </div>
        <button type="submit" class="btn btn-primary">Submit RSVP</button>
        <p class="form-error" id="form-error" hidden></p>
      </form>
    </div>

    <div class="rsvp-step" data-step="done" hidden>
      <div class="rsvp-confirmation card">
        <h2>Thank you!</h2>
        <p id="confirmation-text"></p>
      </div>
    </div>

    <div class="rsvp-step" data-step="already" hidden>
      <div class="rsvp-confirmation card">
        <h2>Already submitted</h2>
        <p id="already-text"></p>
        <ul id="already-guest-list" class="already-guest-list"></ul>
      </div>
    </div>
  `;

  const codeStep = root.querySelector('[data-step="code"]');
  const formStep = root.querySelector('[data-step="form"]');
  const doneStep = root.querySelector('[data-step="done"]');
  const alreadyStep = root.querySelector('[data-step="already"]');
  const codeInput = root.querySelector('#access-code');
  const validateBtn = root.querySelector('#validate-btn');
  const codeError = root.querySelector('#code-error');
  const partyGreeting = root.querySelector('#party-greeting');
  const rsvpForm = root.querySelector('#rsvp-form');
  const guestList = root.querySelector('#guest-list');
  const formError = root.querySelector('#form-error');
  const confirmationText = root.querySelector('#confirmation-text');
  const alreadyText = root.querySelector('#already-text');
  const alreadyGuestList = root.querySelector('#already-guest-list');

  /** Show a single step panel */
  function showStep(step) {
    [codeStep, formStep, doneStep, alreadyStep].forEach((el) => {
      el.hidden = el.dataset.step !== step;
    });
  }

  /** Label for RSVP UI (Plus One linked to host guest) */
  function memberDisplayName(member, members) {
    if (member.displayName) return member.displayName;
    if (member.isPlusOne && member.plusOneFor) {
      const host = members.find((m) => m.id === member.plusOneFor);
      const label = host?.name?.trim().split(/\s+/)[0] ?? 'Guest';
      return `Plus One (${label})`;
    }
    if (member.isPlusOne) return 'Plus One';
    return member.name;
  }

  /** Build per-guest coming / not coming controls */
  function renderGuestList(members) {
    guestList.innerHTML = members
      .map((member) => {
        const label = memberDisplayName(member, members);
        return `
        <div class="guest-card">
          <div class="guest-card-header">
            <span class="guest-name">${label}</span>
          </div>
          <div class="guest-choices" role="group" aria-label="RSVP for ${label}">
            <label class="guest-choice guest-choice--yes">
              <input type="radio" name="guest-${member.id}" value="yes" required />
              <span class="guest-choice-text">Joining us</span>
            </label>
            <label class="guest-choice guest-choice--no">
              <input type="radio" name="guest-${member.id}" value="no" required />
              <span class="guest-choice-text">Can't make it</span>
            </label>
          </div>
        </div>
      `;
      })
      .join('');
  }

  /** Collect guest responses from the form */
  function collectGuestResponses(members) {
    return members.map((member) => {
      const value = rsvpForm.querySelector(`input[name="guest-${member.id}"]:checked`)?.value;
      return {
        guestId: member.id,
        name: memberDisplayName(member, members),
        attending: value === 'yes',
      };
    });
  }

  /** Join name parts with natural "and" (e.g. Kate, Joseph and a guest) */
  function joinNameList(parts) {
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  }

  /** Thank-you copy uses real names only; plus-ones count as "a guest" */
  function formatAttendingForThankYou(responses, members) {
    const byId = new Map(members.map((m) => [m.id, m]));
    const realNames = [];
    let plusOnesAttending = 0;

    for (const response of responses) {
      if (!response.attending) continue;
      const member = byId.get(response.guestId);
      if (member?.isPlusOne) {
        plusOnesAttending += 1;
      } else {
        realNames.push(member?.name ?? response.name);
      }
    }

    const parts = [...realNames];
    if (plusOnesAttending === 1) parts.push('a guest');
    else if (plusOnesAttending > 1) parts.push(`${plusOnesAttending} guests`);

    return joinNameList(parts);
  }

  /** Name shown in already-submitted list (no "Plus One" label) */
  function nameForSummary(member, members) {
    if (!member?.isPlusOne) return member?.name ?? '';
    return 'Guest';
  }

  /** Render bullet list of prior guest responses */
  function renderAlreadyList(responses, members) {
    if (!responses?.length) {
      alreadyGuestList.hidden = true;
      return;
    }
    const byId = new Map(members.map((m) => [m.id, m]));
    alreadyGuestList.hidden = false;
    alreadyGuestList.innerHTML = responses
      .map((g) => {
        const member = byId.get(g.guestId);
        const label = nameForSummary(member, members) || g.name;
        return `<li class="already-guest-item"><span class="already-guest-name">${label}</span><span class="already-guest-status ${g.attending ? 'is-attending' : 'is-declined'}">${g.attending ? 'Joining us' : "Can't make it"}</span></li>`;
      })
      .join('');
  }

  /** Validate access code via API */
  async function validateCode() {
    codeError.hidden = true;
    validateBtn.disabled = true;

    try {
      const response = await fetch(apiUrl(API_VALIDATE_CODE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput.value.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        codeError.textContent = data.error ?? 'Invalid code.';
        codeError.hidden = false;
        return;
      }

      party = data.party;

      if (party.rsvpStatus === 'responded') {
        const count = party.attendeeCount ?? 0;
        alreadyText.textContent = `We already have your RSVP for ${party.partyName} (${count} guest(s) attending). Contact us if you need to make a change.`;
        renderAlreadyList(party.guestResponses, party.members);
        showStep('already');
        return;
      }

      partyGreeting.textContent = `Welcome, ${party.partyName}!`;
      renderGuestList(party.members);
      showStep('form');
    } catch {
      codeError.textContent = 'Unable to connect. Please try again.';
      codeError.hidden = false;
    } finally {
      validateBtn.disabled = false;
    }
  }

  /** Submit RSVP via API */
  async function submitRsvp(event) {
    event.preventDefault();
    formError.hidden = true;

    const guestResponses = collectGuestResponses(party.members);
    const incomplete = guestResponses.some((g) => {
      const checked = rsvpForm.querySelector(`input[name="guest-${g.guestId}"]:checked`);
      return !checked;
    });

    if (incomplete) {
      formError.textContent = 'Please select coming or not coming for each guest.';
      formError.hidden = false;
      return;
    }

    try {
      const response = await fetch(apiUrl(API_RSVP), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: party.partyId,
          accessCode: codeInput.value.trim(),
          guestResponses,
          dietaryNotes: root.querySelector('#dietary-notes').value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        formError.textContent = data.error ?? 'Submission failed.';
        formError.hidden = false;
        return;
      }

      const attendingLabel = formatAttendingForThankYou(guestResponses, party.members);
      const everyoneComing = guestResponses.every((g) => g.attending);
      const noOneComing = guestResponses.every((g) => !g.attending);

      if (noOneComing) {
        confirmationText.textContent = `Thank you for letting us know. We'll miss you at the celebration.`;
      } else if (everyoneComing) {
        confirmationText.textContent = `We're so glad ${attendingLabel} will be joining us! We can't wait to celebrate together.`;
      } else {
        confirmationText.textContent = `Thank you! We're excited to celebrate with ${attendingLabel}.`;
      }
      showStep('done');
    } catch {
      formError.textContent = 'Unable to connect. Please try again.';
      formError.hidden = false;
    }
  }

  validateBtn.addEventListener('click', validateCode);
  codeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') validateCode();
  });
  rsvpForm.addEventListener('submit', submitRsvp);
}
