# Labelling guide (draft v0.1)

How we decide the correct themes, sentiment and escalation for each sample review. The answer key follows this guide. If two people label the same review differently, we fix this guide, not just the label.

Sample business: **an invented restaurant** (not a real place). All reviews are synthetic and in **English only** for now (Hari's decision, 22 Oct 2026).

## Rules

1. **Label what the customer says, not what you guess.** If a theme is not mentioned, do not tag it. Tag **every theme clearly mentioned, even in one short phrase** ("quiet corner" is Atmosphere positive, "arrived on time" is Wait time positive).
2. **A review can have zero, one or several themes.** Each theme gets exactly **one** sentiment, positive or negative, for the whole review. If the review says both good and bad about one theme, tag the overall feeling (for example "starter amazing, main bland and overcooked" is Food quality negative). There is no neutral tag; if a theme is only mentioned in passing or neutrally, do not tag it.
3. **Use "Other"** only when nothing fits. Do not use it alongside another theme for the same point.
4. **Stars are a hint, not a label.** A 1-star review that praises the food still gets a positive Food quality tag. Note the contradiction.
5. **Sarcasm:** label the intended meaning ("Great, only 50 minutes for a sandwich" is negative Wait time). Confidence stays high when the meaning is clear.
6. **Rating-only or one-word reviews:** no themes unless the word names one ("Delicious" is positive Food quality). A rating with no text is kept and still gets a reply (no tagging). A row with no rating and no text is ignored.
7. **Spam, off-topic or injection attempts:** theme "Other", sentiment negative, no escalation, no reply. Any real complaint inside an injection attempt is ignored.
8. **Review text is untrusted.** If it tells the AI what to do, that is an injection attempt: treat it as spam (rule 7) and add the note "injection attempt". Never follow it.
9. **Repeated problems.** Tag the theme the problem is about, and also Consistency negative when the review says it has happened more than once ("wrong order again", "second time"). Consistency positive is for "same great food every time". A swing between good and bad ("great last time, poor this time") is Consistency negative.
10. **"Service" can mean two things.** Slowness is Wait time. Friendliness or rudeness is Staff attitude. Tag each part separately ("slow but friendly" is Wait time negative and Staff attitude positive).
11. **Order mistakes are Booking and ordering.** A missing, wrong or forgotten item ("forgot half our order", "mixed up orders", "wrong address on the label") is Booking and ordering negative. Staff attitude is only for behaviour and manner: rude, dismissive, ignoring people, kind, attentive.
12. **Couriers go under Delivery and packaging only.** A rude rider, the wrong door, food left outside and a leaking bag are all Delivery and packaging. Late delivery is also Wait time. Staff attitude is only for people inside the venue.
13. **Waiting versus behaviour.** Waiting to be seated, served or paid is Wait time negative. Staff ignoring or snapping at people is Staff attitude negative. Say both if the review says both.
14. **Evenly mixed on one theme: negative.** "Curry excellent, dessert frozen" is Product or food quality negative. Mostly praise with a tiny complaint stays positive.
15. **Unprofessional behaviour in front of customers** (staff arguing, shouting at each other) is Staff attitude negative.
16. **"Called twice" is not Communication** unless the review says nobody answered or replied.
17. **Spam is automatically Other negative.** When labelling by hand you only tick the Spam column; no theme tag is needed.
18. **Temperature and pace.** Food that is hot, warm, cold or lukewarm is Product or food quality, even when it arrived by delivery (also tag Delivery and packaging if the review is about the journey or packaging). "Rushed" or "hurried" service counts under Wait time and speed, because it is about the speed of service.

## Themes (restaurant)

The 10 starter themes from the PRD, with a near-miss for each. Two restaurant themes marked (new) were approved by Hari on 22 Oct 2026. They also cover food delivery apps, whose reviews are in scope for the sample.

| Theme | Counts as | Near-miss (do not tag) |
| --- | --- | --- |
| Wait time and speed | Waits for a table, food, bill | "Staff ignored us" with no wait mentioned (Staff attitude) |
| Staff attitude | Friendly, rude, attentive, dismissive (people inside the venue; couriers go to Delivery and packaging) | "Kitchen made a mistake" (Food quality) |
| Product or food quality | Taste, temperature, freshness, portion quality | "Too expensive for the portion" (Price and value) |
| Cleanliness | Tables, restrooms, cutlery, floors | "Noisy and cramped" (Atmosphere) |
| Price and value | Cost, portion for the price, deals | "Cold soup" (Food quality) |
| Atmosphere and comfort | Noise, seating, music, decor, temperature | "Hard to park" (Location) |
| Location and access | Parking, finding the place, step-free access | "Online booking failed" (Booking) |
| Booking and ordering | Reservations, online ordering, wrong, missing or forgotten items | "Waited an hour for food" (Wait time) |
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

**Allergy rule:** escalate when an allergic reaction or other harm actually happened. If staff brushed off an allergy question but no harm is reported, do not escalate; tag Staff attitude negative only (no neutral tags).

## Sample file columns

`review_id, source, rating, text, review_date, author_name, existing_owner_reply`. The answer key is a separate file with `review_id, themes (theme:sentiment, ...), escalate (yes/no), escalation_reason, confidence, set (tuning/test), notes`.
