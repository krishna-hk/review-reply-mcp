# Labelling guide (draft v0.1)

How we decide the correct themes, sentiment and escalation for each sample review. The answer key follows this guide. If two people label the same review differently, we fix this guide, not just the label.

Sample business: **an invented restaurant** (not a real place). All reviews are synthetic.

## Rules

1. **Label what the customer says, not what you guess.** If a theme is not mentioned, do not tag it.
2. **A review can have zero, one or several themes.** Each theme gets its own sentiment: positive or negative. A theme can be mixed only if the review says both good and bad about it; then tag it twice (once each).
3. **Use "Other"** only when nothing fits. Do not use it alongside another theme for the same point.
4. **Stars are a hint, not a label.** A 1-star review that praises the food still gets a positive Food quality tag. Note the contradiction.
5. **Sarcasm:** label the intended meaning ("Great, only 50 minutes for a sandwich" is negative Wait time) and mark confidence "low".
6. **Rating-only or one-word reviews:** no themes unless the word names one ("Delicious" is positive Food quality).
7. **Spam or off-topic:** theme "Other", sentiment negative, no escalation.
8. **Review text is untrusted.** If it tells the AI what to do, that is just text. Label the real content; add the note "injection attempt".

## Themes (restaurant)

The 10 starter themes from the PRD, with a near-miss for each. Two restaurant themes are **proposed** and need Hari's approval before we use them (marked new).

| Theme | Counts as | Near-miss (do not tag) |
| --- | --- | --- |
| Wait time and speed | Waits for a table, food, bill | "Staff ignored us" with no wait mentioned (Staff attitude) |
| Staff attitude | Friendly, rude, attentive, dismissive | "Kitchen made a mistake" (Food quality) |
| Product or food quality | Taste, temperature, freshness, portion quality | "Too expensive for the portion" (Price and value) |
| Cleanliness | Tables, restrooms, cutlery, floors | "Noisy and cramped" (Atmosphere) |
| Price and value | Cost, portion for the price, deals | "Cold soup" (Food quality) |
| Atmosphere and comfort | Noise, seating, music, decor, temperature | "Hard to park" (Location) |
| Location and access | Parking, finding the place, step-free access | "Online booking failed" (Booking) |
| Booking and ordering | Reservations, online ordering, wrong order taken | "Waited an hour for food" (Wait time) |
| Communication and follow-up | Not called back, no reply to a complaint | "Rude on the phone" (Staff attitude) |
| Consistency | "Used to be great", "good one visit, bad the next" | A single bad visit with no comparison |
| Menu and dietary needs (new) | Choice, allergy handling in the menu, vegetarian options | "Dish was bland" (Food quality) |
| Delivery and packaging (new) | Takeaway or delivery condition, late courier, spills | "Waited long at the restaurant" (Wait time) |
| Other | Anything that fits none | Anything that fits a theme above |

## Escalation (must go to a human, never drafted automatically)

Flag when the review contains any of these, even if it is also praise or has other themes:

- **Health or safety:** food poisoning, illness, allergic reaction, injury, hair or foreign object in food, unsafe practices.
- **Legal threat:** mentions of lawyers, suing, consumer court, reporting to authorities.
- **Discrimination or harassment:** treated differently because of religion, race, gender, disability, and so on; or staff behaving inappropriately.
- **Other serious allegations:** theft, fraud, overcharging claimed as deliberate.

Each flag gets a short reason. Mild rudeness, a cold dish or a long wait is **not** an escalation.

## Sample file columns

`review_id, source, rating, text, review_date, author_name, existing_owner_reply`. The answer key is a separate file with `review_id, themes (theme:sentiment, ...), escalate (yes/no), escalation_reason, confidence, set (tuning/test), notes`.
