/**
 * Two-step RSVP form: access code validation, then submission.
 */
import { API_RSVP, API_VALIDATE_CODE } from '../utils/constants.ts';

/** Initialize the RSVP form inside the given root element */
export function initRsvpForm(root) {
  let party = null;

  root.innerHTML = `
    <div class="rsvp-step" data-step="code">
      <p class="rsvp-intro">Enter the access code printed on your invitation to RSVP.</p>
      <div class="form-group">
        <label for="access-code">Access Code</label>
        <input id="access-code" class="form-input" type="text" autocomplete="off" placeholder="e.g. DEMO01" maxlength="12" />
      </div>
      <button type="button" class="btn btn-primary" id="validate-btn">Continue</button>
      <p class="form-error" id="code-error" hidden></p>
    </div>

    <div class="rsvp-step" data-step="form" hidden>
      <p class="rsvp-greeting" id="party-greeting"></p>
      <form id="rsvp-form">
        <div class="form-group">
          <label>Will you be attending?</label>
          <div class="radio-group">
            <label><input type="radio" name="attending" value="yes" required /> Joyfully accept</label>
            <label><input type="radio" name="attending" value="no" required /> Regretfully decline</label>
          </div>
        </div>
        <div class="form-group" id="count-group">
          <label for="attendee-count">Number attending (including yourself)</label>
          <select id="attendee-count" class="form-select"></select>
        </div>
        <div class="form-group">
          <label for="dietary-notes">Dietary restrictions (optional)</label>
          <input id="dietary-notes" class="form-input" type="text" placeholder="Vegetarian, gluten-free, etc." />
        </div>
        <div class="form-group">
          <label for="rsvp-message">Message for the couple (optional)</label>
          <textarea id="rsvp-message" class="form-textarea" placeholder="We are so happy for you!"></textarea>
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
  const countSelect = root.querySelector('#attendee-count');
  const countGroup = root.querySelector('#count-group');
  const formError = root.querySelector('#form-error');
  const confirmationText = root.querySelector('#confirmation-text');
  const alreadyText = root.querySelector('#already-text');

  /** Show a single step panel */
  function showStep(step) {
    [codeStep, formStep, doneStep, alreadyStep].forEach((el) => {
      el.hidden = el.dataset.step !== step;
    });
  }

  /** Populate attendee count dropdown based on party size */
  function fillCountOptions(max) {
    countSelect.innerHTML = '';
    for (let i = 1; i <= max; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = String(i);
      countSelect.appendChild(option);
    }
  }

  /** Toggle attendee count visibility based on attending radio */
  function syncCountVisibility() {
    const attending = rsvpForm.querySelector('input[name="attending"]:checked')?.value;
    countGroup.hidden = attending !== 'yes';
  }

  rsvpForm.addEventListener('change', syncCountVisibility);

  /** Validate access code via API */
  async function validateCode() {
    codeError.hidden = true;
    validateBtn.disabled = true;

    try {
      const response = await fetch(API_VALIDATE_CODE, {
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
        const status = party.attending ? 'attending' : 'not attending';
        alreadyText.textContent = `We already have your RSVP for ${party.partyName} (${status}, ${party.attendeeCount ?? 0} guest(s)). Contact us if you need to make a change.`;
        showStep('already');
        return;
      }

      partyGreeting.textContent = `Welcome, ${party.partyName}! You may RSVP for up to ${party.partySize} guest(s).`;
      fillCountOptions(party.partySize);
      syncCountVisibility();
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

    const attendingValue = rsvpForm.querySelector('input[name="attending"]:checked')?.value;
    const attending = attendingValue === 'yes';

    try {
      const response = await fetch(API_RSVP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: party.partyId,
          accessCode: codeInput.value.trim(),
          attending,
          attendeeCount: attending ? Number(countSelect.value) : 0,
          dietaryNotes: root.querySelector('#dietary-notes').value,
          message: root.querySelector('#rsvp-message').value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        formError.textContent = data.error ?? 'Submission failed.';
        formError.hidden = false;
        return;
      }

      confirmationText.textContent = attending
        ? `We're so glad ${party.partyName} will be joining us! We can't wait to celebrate together.`
        : `Thank you for letting us know. We'll miss you, but we appreciate your warm wishes.`;
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
