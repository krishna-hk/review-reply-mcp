# Blind labelling check (23 Oct 2026)

Hari labelled 30 reviews (R061 to R117, none of which had a published answer) in `data/sample/blind_labelling_sheet.xlsx`. Claude labelled the same 30 separately and kept them sealed until Hari's sheet came back (`data/sample/blind_check_my_labels.csv`). Then the two were compared.

## Result

| Measure | Result |
| --- | --- |
| Reviews where all tags matched | 14 of 30 |
| Serious flag | Matched on all 30 |
| Spam flag | Matched on all 30 |
| Tags Hari chose that Claude also chose | 25 of 33 (76%) |
| Tags Claude chose that Hari also chose | 25 of 43 (58%) |

The PRD target for theme agreement is at least 80% (provisional). Most disagreements came from guide wording, not from a wrong answer, so the guide was changed instead of either set of labels.

## What we found and decided

| Disagreement | Decision (Hari, 23 Oct 2026) | Guide rule |
| --- | --- | --- |
| Small mentions tagged by one of us only (R072, R090, R101, R067) | Tag every theme clearly mentioned, even briefly | 1 |
| Missing or mixed-up items: Staff attitude or Booking and ordering (R093, R106, R066) | Booking and ordering | 11 |
| Couriers (R108, R064, R079) | Delivery and packaging only (late delivery also Wait time) | 12 |
| Waiting to be seated: Wait time or Staff attitude (R063, R074) | Wait time for the wait, Staff attitude for ignoring or rudeness | 13 |
| Evenly mixed theme (R112) | Negative | 14 |
| Staff arguing in the kitchen (R077) | Staff attitude negative | 15 |
| "Called twice" (R113) | Not Communication unless nobody replied | 16 |
| Spam rows (R117) | Spam is automatically Other negative; labeller only ticks Spam | 17 |

Also changed in the answer key because of rule 12: R026 is now Delivery and packaging positive only, and R035 is Delivery and packaging negative plus Food quality negative.

## Next

When the importer and tagging prompts are tested (checkpoint 3), these 30 reviews, labelled under the updated guide, can join the tuning set. The test set (R041 to R060) stays sealed.
