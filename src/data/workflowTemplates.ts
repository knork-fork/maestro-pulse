/**
 * Starting points for a workflow's `workflow.md`, offered by the "Templates"
 * menu in WorkflowDialog.tsx. Picking one replaces the editor's buffer — the
 * user is expected to tune it further, not use it verbatim.
 *
 * Deliberately silent on generic column mechanics — who may pick up a card,
 * a one-stage handoff, human/manual override, blocked status, Backlog/Done
 * rules. Those are the same for every workflow and already live in the
 * engine (`applyCardAction`/`validColumn` in server/index.mjs, and the
 * card's own `status` field); a template restating them would just be a
 * worse copy of the runtime, and one that could drift out of sync with it.
 * `workflow.md` is for what's actually specific to *this* workflow: what
 * "good work" means for it, what artifacts/evidence should exist by the
 * time it's done, and any workflow-specific conditions or exceptions for
 * advancing a card — so every template sticks to two sections,
 * "Completion requirements" and "Workflow rules", and neither one invents
 * movement mechanics the engine doesn't have.
 */
export type WorkflowTemplate = {
  key: string
  label: string
  content: string
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'development',
    label: 'Development',
    content: `### Completion requirements
- A short handoff note describing what changed, why, and anything
  deliberately left out of scope.
- Link or attach the diff/PR and test/build/typecheck results.
- If tool available, attach a screenshot or short recording for visible UI changes.

### Workflow rules
- Implementation must be verified before leaving the development stage.
- Review feedback must be addressed or explicitly rejected with a reason
  before approval.
- Scope discovered during implementation that is unrelated to the task
  should be recorded as follow-up work rather than silently included.
`,
  },
  {
    key: 'qa',
    label: 'QA',
    content: `### Completion requirements
- Concrete repro steps for what was tested, including edge cases checked
  (not just the golden path).
- A screenshot or short video showing the verified behavior.
- A note on anything that could not be verified and why (environment
  limitation, flaky dependency, etc.) rather than a silent skip.

### Workflow rules
- A card only counts as tested once the behavior it describes has actually
  been exercised — not assumed to work because the implementation looks right.
- A failure found during testing must be recorded with repro steps, not
  left as a vague "doesn't work."
- Reopening a card that previously passed requires noting what regressed.
`,
  },
  {
    key: 'sales-leads',
    label: 'Potentials & Leads (Sales)',
    content: `### Completion requirements
- A summary of the outcome: won, lost, or no longer viable, and why.
- Call notes, proposal documents, or email threads attached that a future
  read of this card would need for context.
- Next steps recorded if the relationship continues past this card.

### Workflow rules
- A lead only counts as qualified once actual fit has been established, not
  guessed at.
- Define what "gone cold" means for this workflow (e.g. no response after
  N days) and mark a lead lost with that reason rather than leaving it
  idle indefinitely.
- Reviving a lead marked lost requires a note on what changed.
`,
  },
  {
    key: 'rnd',
    label: 'R&D',
    content: `### Completion requirements
- An \`exploration.md\`-style write-up: what was tried, what worked, what
  didn't, and why — the reasoning matters as much as the result here.
- Any prototype code, data, or benchmark results produced along the way,
  attached rather than described secondhand.
- A clear verdict: adopt, discard, or revisit later, with the reasoning.

### Workflow rules
- Inconclusive is a valid outcome, as long as the write-up says so
  explicitly rather than the card just going quiet.
- A finding that changes the original question should update the card's
  framing, not just get buried in notes further down.
`,
  },
  {
    key: 'management',
    label: 'Management',
    content: `### Completion requirements
- A short status summary: what was decided or delivered, and by whom.
- Any supporting document the decision depended on (a proposal, a budget,
  a meeting note) attached to the card.
- Follow-up owners and dates recorded if anything remains outstanding.

### Workflow rules
- A decision only counts as final once confirmed by whoever owns it, not
  assumed from silence.
- A card stalled on an external decision should name that dependency
  explicitly rather than sitting unexplained.
`,
  },
  {
    key: 'review-audit',
    label: 'Review/Audit',
    content: `### Completion requirements
- Every finding written up with the concrete scenario it applies to, not a
  vague concern.
- A severity/risk rating attached to each finding.
- Evidence attached (a log excerpt, a screenshot, a reproduction script) for
  anything non-obvious.

### Workflow rules
- A finding rated critical/high must be either resolved and re-verified, or
  explicitly accepted as a known risk — never left ambiguous — before the
  card is considered complete.
- A card reopened after new evidence should restate what changed, not just
  re-add the old finding.
`,
  },
]
