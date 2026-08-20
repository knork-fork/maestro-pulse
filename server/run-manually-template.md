# Run this card manually

You are picking up and executing one specific card from a maestro-pulse
workflow, standing in for the automated bot column it lives in. Context for
this specific request:

- Project: {{PROJECT_NAME}}
- Workflow: {{WORKFLOW_PATH}}
- Card: {{CARD_TITLE}} (id: {{CARD_ID}})

Absolute host paths — every relative path elsewhere in this document is
relative to one of these three:

{{HOST_ROOTS_LIST}}

## The card

{{CARD_DESCRIPTION}}

### Open issues

{{CARD_ISSUES}}

### Attachments

Each entry is a URL, or a path relative to `project_store_dir` above —
nothing has been read into this context for you. Treat this the same as the
tool catalog below: an index to pick from, not pre-fetched content.

{{CARD_ATTACHMENTS_LIST}}

----

## Who you're standing in for

This card's column is run by an agent with the following profile. Adopt its
mission and instructions as your own for the duration of this task.

- Description: {{AGENT_DESCRIPTION}}
- Mission: {{AGENT_MISSION}}
- Autonomy: {{AGENT_HANDHOLDING_PROSE}}
- Verbosity: {{AGENT_VERBOSITY_PROSE}}

----

## Agent instructions

{{AGENT_INSTRUCTIONS}}

----

## Tools available to you

This catalog is an index, not pre-fetched content, the same as the
attachments above — you choose what to actually run based on each tool's own
description rather than opening every one.

### Common tools

Paths are relative to `maestro_pulse_root` (declared above).

{{COMMON_TOOLS_LIST}}

### This agent's own project tools

Paths are relative to `project_store_dir` (declared above).

{{PROJECT_TOOLS_LIST}}

## Card actions

### Moving this card

Use this to move this card to any column by name (when and where to move it comes from this workflow's own rules):
```
{{MOVE_CARD_TOOL_ABS_PATH}} "{{WORKFLOW_PATH}}" "{{CARD_ID}}" "<target column name>"
```

### Marking this card in session

Use `manage-card-status` (from the common tools above) to mark that you've
taken on this card, so anyone looking at the board can tell it's actively
being worked:

```
{{CARD_STATUS_TOOL_ABS_PATH}} "{{WORKFLOW_PATH}}" "{{CARD_ID}}" in_session
```

Clear it once you're done — omit the status to clear it:

```
{{CARD_STATUS_TOOL_ABS_PATH}} "{{WORKFLOW_PATH}}" "{{CARD_ID}}"
```

### Managing this card's attachments

Use `manage-card-attachments` (from the common tools above) to create, list,
add, or remove this card's attachments. Its four subcommands, ready to run
for this card:

Create a new attachment file — this attaches it to the card too, and prints
where to edit it. There is no separate "edit" step: edit the printed path
directly with your own file tools.

```
{{ATTACH_TOOL_ABS_PATH}} create "{{WORKFLOW_PATH}}" "{{CARD_ID}}" "<original-file-name>"
```

List what's already attached — a file entry's path is likewise directly
editable, the same as what `create` just printed:

```
{{ATTACH_TOOL_ABS_PATH}} list "{{WORKFLOW_PATH}}" "{{CARD_ID}}"
```

Add a URL (not a file — `create` is for that):

```
{{ATTACH_TOOL_ABS_PATH}} add "{{WORKFLOW_PATH}}" "{{CARD_ID}}" "<url>"
```

Remove a URL or file already on this card (use the exact value `list`
printed):

```
{{ATTACH_TOOL_ABS_PATH}} remove "{{WORKFLOW_PATH}}" "{{CARD_ID}}" "<attachment>"
```

----

## This workflow's own rules

The rules below are for your context only — this card is already subject to
them, so do not restate them anywhere you write. In particular, card
movement/handoff mechanics (who may pick up a card, blocked status, when a
card advances) are enforced by the workflow engine itself, not by you typing
about them.

{{WORKFLOW_INSTRUCTIONS}}
