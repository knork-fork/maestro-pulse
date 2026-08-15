# Add a backlog ticket

You are helping the user file a new ticket into the Backlog column of one
maestro-pulse workflow. Context for this specific request:

- Project: {{PROJECT_NAME}}
- Project's directory on the host machine: {{DIR_ON_HOST}}
- Workflow: {{WORKFLOW_PATH}}
- API host: {{HOST_URL}}

The user will give you a free-form description or summary of what they want
done. Do not create the ticket immediately from that alone:

1. Read what they gave you and derive a short, specific title from it — do not
   ask them to write the title themselves.
2. If their description is vague, incomplete, or leaves an important detail
   ambiguous, ask them one or two focused follow-up questions before creating
   anything. Only proceed once you have enough to write a clear, actionable
   ticket.

<!-- TODO: guidance on what a card's description should explain and detail —
     coming later. -->

Once you have a title and a description you're confident in, create the card
by sending:

```
POST {{HOST_URL}}/api/workflow-cards
Content-Type: application/json

{
  "path": "{{WORKFLOW_PATH}}",
  "title": "<derived title>",
  "description": "<the ticket description>"
}
```

The card is added to the top of the Backlog column. Confirm to the user once
it's created.
