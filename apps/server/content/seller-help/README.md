# Seller Help content

Every file here ending in `.json` is one Help topic in the seller portal. The server reads this folder; there is no
database. **Add a file and it shows up in the Help menu. Edit a file and the change shows on the next page load.** No
restart and no code change is needed.

Served by `GET /v1/api/seller/help` (the menu) and `GET /v1/api/seller/help/:slug` (one topic).

## Add a topic

1. Copy any file, for example `09-refunds.json`, and give it a new name (the name only sets the tie-break order).
2. Change `slug` (a-z, 0-9 and dashes; it becomes `/seller/help/<slug>`), `title`, `summary` and the sections.
3. Save. Done.

## The file

```json
{
  "slug": "refunds",
  "title": "Refunds",
  "icon": "banknote",
  "order": 90,
  "summary": "One line under the title.",
  "openPath": "/seller/refunds",
  "openLabel": "Open refunds",
  "sections": [
    { "id": "what", "title": "What is this page?", "intro": "Optional text.", "blocks": [ ... ] }
  ]
}
```

| Field | Needed | Meaning |
|---|---|---|
| `slug` | yes | The address. Unique. |
| `title` | yes | The menu name and the page heading. |
| `sections` | yes | The cards on the page, top to bottom. |
| `order` | no | Menu position, small first. Default 1000 (last). Leave gaps (10, 20, 30) to insert later. |
| `icon` | no | A lucide icon name in kebab case, for example `star`. If the portal does not know it, a help icon shows. |
| `summary` | no | One line under the title. |
| `openPath`, `openLabel` | no | The button to the real page. Leave `openPath` empty for no button. |

A section needs `title`. `id` is optional (used for the "On this page" links; a number is added if missing). `intro` is optional.

## Blocks (`blocks` inside a section)

| `type` | Fields |
|---|---|
| `steps` | `title`, `steps`: a list of text, or `{ "text": "...", "detail": "..." }` for a small line under a step. |
| `words` | `title`, `items`: `{ "term": "...", "means": "..." }`. |
| `points` | optional `title`, `items`: a list of text. |
| `faq` | `title`, `items`: `{ "q": "...", "a": "..." }`. |
| `note` | `tone`: `info` or `warn`, `text`. |

## It will not break

Writing mistakes never take Help down. The server skips what it cannot read and says so in its log (look for
`HelpContentService`):

- a file that is not valid JSON, or has no `slug`, `title` or `sections`, is skipped;
- a section with no `title` is skipped; a block with an unknown `type` is dropped;
- a missing `order`, `icon`, `summary` or `openLabel` gets a default;
- extra fields are ignored, so you can add notes for yourself;
- two files with the same slug: the first one by file name is used.

New block types need a small change in the portal; until then use the five above.
