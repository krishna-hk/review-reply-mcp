# Finding product managers for the pilot

Goal: 3 to 5 product managers or product-minded people who have a real pile of customer feedback and use Claude or ChatGPT on their own paid plan. Traction is a bonus; the real prize is one honest case study and real feedback.

Status: plan only. Nothing here has been sent. Hari approves every message before it goes out.

## Who is a good pilot user
Must have:
- Feedback they are allowed to share (app store reviews, support tickets, survey comments, NPS comments), at least 40 to 50 rows, exportable as CSV.
- A Claude or ChatGPT paid plan (the connector needs one).
- 30 minutes for setup and 30 minutes for a call afterwards.

Nice to have: they do a weekly feedback review today and dislike it.

Skip: anyone who can only paste confidential customer data they have no right to share.

## Where to find them
1. Your own network first: classmates, ex-colleagues, friends of friends in product, support, growth or founder roles. Warmest, fastest. Aim for 10 asks to get 3 yeses.
2. LinkedIn: search "product manager" plus "app" or "SaaS" in your city or alumni network. Short personal note, no pitch decks.
3. Communities: product and indie-maker groups (for example Product Hunt makers, Indie Hackers, Reddit product-management and SaaS threads, Slack or Discord groups for PMs). Read each group's self-promotion rules first and ask a moderator if unsure.
4. Small app makers: indie developers with public app store reviews can use their own public reviews, which avoids privacy problems.

## The message (draft, edit in your own voice)
> Hi <name>, I'm building a small free tool for product people: you give it a CSV of customer feedback and your own Claude or ChatGPT tags the themes, flags serious ones for a human, and gives a summary with exact quotes and counts. I'm looking for 3 to 5 people to try it for 30 minutes and tell me honestly what's useless. Do you have a pile of reviews or tickets you'd test it on? I'll set it up with you and delete everything after.

## What each tester gets
- A personal link and a one-page "how to connect" (docs/HOSTED_SERVER.md steps).
- The privacy statement (docs/PRIVACY.md) before they import anything.
- A promise to delete their data on request.

## What we ask in return
- One import of their own export (names removed if possible).
- Run the weekly check once.
- A 30-minute call: what was useful, what was wrong, would they use it again.

## Tracking (keep in a simple sheet, no review text)
Name or initials, where found, date asked, answered yes/no, link sent, imported, call done, quote allowed (yes/no).

## What counts as success
- 3 testers complete an import and a digest.
- At least 2 say the digest saved time or showed something they had missed.
- 1 testimonial or case-study quote with written permission, names removed.

## Safety rules
- Never send a link before they have read the privacy statement.
- Do not publish any tester's data or name without written permission.
- Pricing and plan limits stay labelled "verify at deploy time".

## Message variants (draft, nothing sent)
**Warm contact (short):** "Hey <name>, can I borrow 30 minutes? I built a small free tool that turns a CSV of customer feedback into tagged themes, flags the serious ones, and drafts replies you approve. I want one real product person to break it. Would you try it on an export of your own?"

**Community post:** "Looking for 3 to 5 product people to test a free tool for customer feedback (app reviews, tickets, survey comments). Works inside your own Claude or ChatGPT. No signup, you can delete everything after. 30 minutes, then a short chat. Comment or DM if you have a feedback export you can share."

**Follow-up after 3 days:** "No worries if it is not a fit. If it is easier, I can run it on a public set of app reviews with you watching, so you need no data."

## Order of work
1. Hari edits and approves one message. 2. Send to 10 warm contacts first; wait 3 days. 3. Post once in one community if fewer than 3 yeses. 4. For each yes: create a link (docs/HOSTED_SERVER.md), send the link, docs/PRIVACY.md and docs/TESTER_GUIDE.md together. 5. Book the call. 6. Track in docs/pilot/tracker-template.csv (keep a private copy outside git if it holds names). 7. After the calls: write the case study with names removed and quotes only with written permission.

## Timing (estimates, mostly waiting)
Day 0 approve message; days 1 to 3 asks; days 3 to 7 setup calls; days 7 to 14 testers try it; days 14 to 18 calls; days 18 to 21 case study.
