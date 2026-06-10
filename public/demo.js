const watchedToggle = document.querySelector("#demo-watched");
const watchedLabel = document.querySelector("#demo-watched-label");
const recapButton = document.querySelector("#demo-recap-button");
const recap = document.querySelector("#demo-recap");
const revealButton = document.querySelector("#demo-reveal");
const details = document.querySelector("#demo-details");
const dialog = document.querySelector("#demo-dialog");
const resetButton = document.querySelector("#reset-demo");

const safeEvents = ["12\u2019", "34\u2019", "67\u2019", "78\u2019", "90+2\u2019"];

function renderSafeRecap() {
  recap.innerHTML = `
    <ol class="safe-event-list">
      ${safeEvents.map((minute) => `<li>${minute} Event happened</li>`).join("")}
    </ol>
  `;
  recap.hidden = false;
  recapButton.hidden = true;
}

function renderFullDetails() {
  details.innerHTML = `
    <p class="revealed__score">
      <span class="team-name">
        <img class="country-flag" src="https://flagcdn.com/w40/ar.png" width="32" height="24" alt="">
        <span>Argentina</span>
      </span>
      3 &ndash; 2
      <span class="team-name">
        <img class="country-flag" src="https://flagcdn.com/w40/fr.png" width="32" height="24" alt="">
        <span>France</span>
      </span>
    </p>
    <p><strong>Winner:</strong> Argentina</p>
    <h4>Match events</h4>
    <ol class="event-list">
      <li>12\u2019 - <span class="event-team"><img class="event-flag" src="https://flagcdn.com/w40/ar.png" width="24" height="18" alt="">Argentina</span> - Normal Goal - Alex Example</li>
      <li>34\u2019 - <span class="event-team"><img class="event-flag" src="https://flagcdn.com/w40/fr.png" width="24" height="18" alt="">France</span> - Yellow Card - Jordan Sample</li>
      <li>67\u2019 - <span class="event-team"><img class="event-flag" src="https://flagcdn.com/w40/ar.png" width="24" height="18" alt="">Argentina</span> - Penalty Scored - Morgan Demo</li>
      <li>78\u2019 - <span class="event-team"><img class="event-flag" src="https://flagcdn.com/w40/fr.png" width="24" height="18" alt="">France</span> - Goal Cancelled - Taylor Test</li>
      <li>90+2\u2019 - <span class="event-team"><img class="event-flag" src="https://flagcdn.com/w40/fr.png" width="24" height="18" alt="">France</span> - Red Card - Casey Preview</li>
    </ol>
    <p class="demo-note">All names and match details on this page are fictional.</p>
  `;
  details.hidden = false;
  revealButton.hidden = true;
}

function resetDemo() {
  watchedToggle.checked = false;
  watchedLabel.textContent = "Mark as watched";
  revealButton.hidden = true;
  revealButton.disabled = false;
  recapButton.hidden = false;
  recap.hidden = true;
  recap.replaceChildren();
  details.hidden = true;
  details.replaceChildren();
}

watchedToggle.addEventListener("change", () => {
  watchedLabel.textContent = watchedToggle.checked
    ? "Unmark as watched"
    : "Mark as watched";
  revealButton.hidden = !watchedToggle.checked;

  if (!watchedToggle.checked) {
    details.hidden = true;
    details.replaceChildren();
  }
});

recapButton.addEventListener("click", renderSafeRecap);

revealButton.addEventListener("click", () => {
  dialog.returnValue = "cancel";
  dialog.showModal();
});

dialog.addEventListener("close", () => {
  if (dialog.returnValue === "confirm" && watchedToggle.checked) {
    renderFullDetails();
  }
});

resetButton.addEventListener("click", resetDemo);
