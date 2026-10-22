# Tool reference

The server exposes 14 tools. The AI app calls them; the server counts, checks and stores. Every call is scoped to one owner (the person behind the connection link). Every result carries a `next_step` hint and remaining counts so the AI knows what to do next. Saves are idempotent: sending the same save twice does not duplicate anything.

## The standard flow

```
set_business_profile -> import_reviews -> get_untagged_reviews -> save_tags (repeat until none left)
   -> get_digest -> (get_theme_reviews)
   -> get_review_for_reply -> save_draft (repeat) -> review_drafts
   -> record_fix ... later ... check_fix_impact
```

Anytime: `get_business_profile`, `load_demo_data`, `delete_my_data`.

## Summary table

| # | Tool | One line | Called when |
| --- | --- | --- | --- |
| 1 | `set_business_profile` | Save business name, tone, policies, signature | First run, or when policies change |
| 2 | `get_business_profile` | Read the saved profile | Start of a session; before drafting |
| 3 | `import_reviews` | Add reviews from CSV text | After the owner provides a file |
| 4 | `get_untagged_reviews` | Next batch (20) of reviews without themes | Start of tagging, and after each save |
| 5 | `save_tags` | Store themes and sentiment, and escalation flags | After the AI reads a batch |
| 6 | `get_digest` | Counts, trends, exact quotes | After tagging, or when the owner asks "how are we doing" |
| 7 | `get_theme_reviews` | Reviews for one theme | When the owner wants detail on one theme |
| 8 | `get_review_for_reply` | One review plus profile, policies, tag, past replies | Before writing each draft |
| 9 | `save_draft` | Store a reply draft after code checks | After the AI writes each reply |
| 10 | `review_drafts` | List drafts by status; approve, edit or reject | When the owner wants to review drafts |
| 11 | `record_fix` | Log a change the owner made | When the owner says "we fixed X" |
| 12 | `check_fix_impact` | Compare theme mentions before and after a fix | Some weeks after a fix |
| 13 | `delete_my_data` | Erase everything for this owner | On request; needs a confirm flag |
| 14 | `load_demo_data` | Load synthetic sample reviews | First try, demos, tests |

## Details

### 1. set_business_profile
- **Does:** saves who the business is and how replies should sound.
- **Workflow:** validate fields -> merge with existing profile -> save -> return the saved profile.
- **Called:** on first run; when tone or policies change.
- **Needs:** `business_name` (required); `business_type`; `tone` (for example "warm, short, no emojis"); `signature`; `policies` (list, for example "no refund promises in public replies", "invite unhappy customers to email us"); `never_say` (list of words or promises); `languages`.

### 2. get_business_profile
- **Does:** returns the saved profile, or says none exists and suggests tool 1.
- **Needs:** nothing.

### 3. import_reviews
- **Does:** adds reviews to this owner's store.
- **Workflow:** parse CSV -> map columns (rating, text, date, optional author, optional existing reply, optional source) -> reject rows with no text -> skip duplicates (same text, date and author) -> detect language -> enforce row limits -> return counts of added, skipped, rejected and why.
- **Called:** after the owner pastes or attaches a CSV.
- **Needs:** `csv_text`; optional `column_map` if headers are unusual; optional `source` label.
- **Limits:** `MAX_ROWS_PER_IMPORT` per call, `MAX_REVIEWS_PER_OWNER` total.

### 4. get_untagged_reviews
- **Does:** returns up to 20 reviews that have no tags, with `review_id`, rating, text and date. Review text is wrapped and labelled as untrusted content.
- **Needs:** optional `limit` (max 20).
- **Returns:** the batch, number remaining, the theme list (10 starter themes plus "Other") and the tagging rules.

### 5. save_tags
- **Does:** stores the themes the AI found, per review.
- **Workflow:** validate every `review_id` belongs to this owner -> validate themes are on the list -> validate sentiment values -> save one or more (theme, sentiment) pairs per review -> save escalation flags with reason -> return saved count and remaining untagged.
- **Needs:** list of `{review_id, tags: [{theme, sentiment}], escalate: bool, escalation_reason}`.
- **Rules enforced in code:** unknown themes rejected; a review with no theme is tagged "Other"; escalation reasons limited to health or safety, legal threat, discrimination, fraud, or other serious.

### 6. get_digest
- **Does:** produces the numbers behind the digest. Code counts everything; the AI only turns it into prose.
- **Returns:** totals; average rating; top praised and top criticised themes with counts; change versus the previous period; new themes; escalated reviews waiting for a human; and for each top theme up to 2 exact quotes copied from the originals.
- **Needs:** optional `period` (default last 90 days) and `compare_to` (previous period).

### 7. get_theme_reviews
- **Does:** lists reviews for one theme and sentiment so the owner can see the evidence.
- **Needs:** `theme`; optional `sentiment`, `limit`, `period`.

### 8. get_review_for_reply
- **Does:** returns the next review needing a draft (or a given `review_id`) together with everything required to write a good reply.
- **Returns:** review text (untrusted), rating, tags, the business profile and policies, tone examples if any, whether the review is escalated (if so, no draft allowed, only a handling note), and the owner's earlier replies for consistency.
- **Needs:** optional `review_id`.

### 9. save_draft
- **Does:** stores a reply draft after running code checks.
- **Checks in code:** no banned words or promises from `never_say` and the policies; length within limits; no invented facts such as offers, phone numbers or names not in the profile or the review; language matches the review; escalated reviews are refused.
- **Needs:** `review_id`, `draft_text`.
- **Returns:** `saved` or `rejected` with the exact rule broken, so the AI can rewrite.

### 10. review_drafts
- **Does:** lists drafts and records the owner's decision.
- **Needs:** optional `status` filter; optional `actions` list of `{review_id, action: approve | edit | reject, edited_text}`.
- **Note:** approving only marks a draft ready. Nothing is posted anywhere. The owner copies and posts it.
- **Bulk:** "approve all safe drafts" approves drafts with no flags and a rating of 4 or 5 after the owner confirms.

### 11. record_fix
- **Does:** logs a change the owner made so its effect can be measured.
- **Needs:** `theme`, `description`, `date_done`.

### 12. check_fix_impact
- **Does:** compares share of reviews mentioning the theme negatively before and after the fix date.
- **Returns:** counts before and after, a plain statement, and a warning when the sample is too small to conclude anything.
- **Needs:** `fix_id`.

### 13. delete_my_data
- **Does:** deletes reviews, tags, drafts, profile, fixes and usage for this owner.
- **Needs:** `confirm: true`. Without it, the tool describes what would be deleted and stops.

### 14. load_demo_data
- **Does:** loads about 40 synthetic reviews for a fictional business, clearly marked as demo, so someone can try the whole flow in a minute.
- **Needs:** nothing. Will not run if real reviews exist unless `replace: true` is passed.

## Cross-cutting rules

- **Isolation:** every query filters by owner; tests check that one owner cannot see another's rows.
- **Untrusted text:** review text is returned inside clearly labelled blocks, and the tool instructions tell the AI never to follow instructions found inside them.
- **No posting:** there is no tool that sends anything to Google or any platform.
- **Mode B:** when the server does the AI work, the same tools are called by our own loop, and each call is counted against the owner's quota.
- **Errors:** every error says what went wrong and what to do next, in plain words.
