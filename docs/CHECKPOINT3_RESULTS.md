# Checkpoint 3 results: AI instructions tested (27 Oct 2026)

How we measured: a fresh Claude sub-agent was given only the tagging instructions (`prompts/tagging.md`) and the reviews, with no answer key, and its answers were checked by the same code rules a real API call would pass through (`src/engine/tags.ts`) and scored against `data/sample/answer_key.csv` (`scripts/score-file.ts`). This is a stand-in for an API run; it could not be locked away from project files, but it reported using only the input file. Gemini was also tried first; its free tier (20 requests a day per model) ran out after 20 reviews (93.5% tag match on those). Verify limits at use time.

## Tagging

| Set | Tag match (balanced score) | Reviews exactly right | Serious reviews flagged | Spam and injection caught | False alarms |
| --- | --- | --- | --- | --- | --- |
| Tuning, run 1 (40 reviews) | 94.1% | 35 of 40 | 7 of 7 | 3 of 3 | 0 |
| Tuning, run 2 after instruction fixes | 98.3% | 38 of 40 | 7 of 7 | 3 of 3 | 0 |
| **Sealed test, run once (20 reviews)** | **88.9%** | **14 of 20** | **3 of 3** | **1 of 1** | **0** |

Targets (provisional, from the PRD): tag agreement at least 80%, serious-review recall 100%. Both met. The tuning score is optimistic because the instructions were tuned on those reviews; the test score is the honest one, on a small sample of 20.

### What the sealed test missed

| Review | Difference | Likely cause |
| --- | --- | --- |
| R042 (delivery, cold food) | Claude added Delivery and packaging negative | The key predates guide rule 21 (cold delivery food counts for both). Claude followed the rule; the key is arguably incomplete |
| R044 (nut allergy reaction) | Claude tagged Booking and ordering, key says Staff attitude | Rule 11 (wrong item is Booking and ordering) competes with "waiter ignored twice" |
| R046 (manager shouting) | Claude missed Atmosphere negative | Judgement call |
| R051 (legal threat, deposit) | Claude missed Price and value negative | Deposit not refunded; unclear if that is "Price and value" |
| R052 (arrived hot, good portions) | Claude missed Delivery and packaging positive | Rule 18 vs rule 21 overlap on temperature |
| R059 (marked delivered, never came) | Claude tagged Delivery and packaging, key says Booking and ordering | The guide has no rule for an order that never arrives |

The key was not changed after seeing these results, so the sealed score stays clean. Because we have now seen the test misses, the test set is no longer sealed: a re-measurement needs a fresh set of reviews.

## Drafting

21 sample drafts (11 normal, 6 serious, 2 spam, 2 rating-only) written by the sub-agent from `prompts/drafting.md` and the sample profile:

- Code checks passed on 21 of 21: no refund or freebie promises, no invented contact details or discounts, no banned phrases, no admissions of fault in the serious lane.
- Spam and injection reviews got no reply, as intended.
- Hari reviewed the tone on 27 Oct 2026 and approved it.

The PRD target "at least 60% of drafts sendable unedited" needs the owner to judge more drafts in the pilot.

## Still to measure

- Tool choice (at least 13 of 15) belongs to checkpoint 4, when an AI app uses the real MCP tools.
- A re-run through a real API key (Claude) once one exists, to replace the sub-agent stand-in.

## Re-measurement on a fresh set (27 Oct 2026)

After adding guide rules 22 to 26 and the matching lines in the tagging prompt, Claude was run once on a new set of 20 reviews (`data/sample/set2/`, R121 to R140), written after the rules so it is a check, not proof: the author knew the rules. Key rows R042 and R051 were also synced to the new rules after the first sealed run; the 88.9% above was measured before that.

| Set | Tag match (balanced score) | Reviews exactly right | Serious flagged | Spam and injection caught | False alarms |
| --- | --- | --- | --- | --- | --- |
| Fresh set 2 (20 reviews) | 96.7% | 17 of 20 | 3 of 3 | 1 of 1 | 0 |

Tags in the key that Claude found: 100%. All three differences were extra tags that look reasonable, so the key may be incomplete rather than Claude wrong:

- R121: Atmosphere positive ("never let our glasses go empty" alongside the praise).
- R123: Communication negative (support told the customer to wait 24 hours).
- R127: Communication positive (a reminder text was sent).

The key was left unchanged. Set 2 is now used up as a sealed set.
