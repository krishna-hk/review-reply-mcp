# Labelling guide: app feedback (draft v0.1)

How to label the 60 sample reviews for a made-up budgeting app called PocketLedger. Your labels become the answer key. The AI is then measured against them. If your labels and the AI's differ, we fix this guide, not just the label.

All reviews are invented. Nothing here is a real person or app.

## The 13 themes

| Theme | Counts as | Near-miss (do not tag) |
| --- | --- | --- |
| Bugs and crashes | Crashes, error messages, things that do not work as intended | "Slow to load" (Speed and performance) |
| Speed and performance | Slow loading, lag, freezing, battery or storage use; or fast and light | "Crashes on launch" (Bugs and crashes) |
| Reliability and data safety | Sync failures, lost or wrongly synced data, outages; or "never lost data" | "Login failed" (Setup and onboarding) |
| Ease of use | Confusing screens, hard-to-find options; or simple, intuitive | "Looks ugly" (Design and look) |
| Setup and onboarding | Signing up, logging in, password reset, first-run tour, moving data in | "Import from CSV" (Integrations and imports) |
| Design and look | Colours, dark mode, layout, icons, font size | "Hard to find the button" (Ease of use) |
| Missing features | A feature asked for or said to be missing; or "has everything I need" | "Feature is broken" (Bugs and crashes) |
| Integrations and imports | Bank links, other apps, CSV import and export, APIs | "Sign-up failed" (Setup and onboarding) |
| Updates and changes | A new version breaking, removing, changing or improving something | A bug with no mention of an update (Bugs and crashes) |
| Price and billing | Cost, paywalls, subscriptions, double charges, refunds | "Support did not answer" (Customer support) |
| Customer support | How fast and helpful the support team was | "App crashed" (Bugs and crashes) |
| Privacy and security | Permissions, tracking, data collection, account security | "Lost my data" (Reliability and data safety) |
| Other | Anything that fits none of the above | Anything that fits a theme above |

## Rules

1. **Label what the customer says, not what you guess.** Tag every theme clearly mentioned, even in one short phrase.
2. **One sentiment per theme per review:** good (Yes tag) or bad (No tag). If a theme has both good and bad, tag the overall feeling; if about equal, choose bad. If a theme is only mentioned neutrally, do not tag it.
3. **Stars are a hint, not a label.** Label the text.
4. **Sarcasm:** label the intended meaning ("Really intuitive" said sarcastically is bad for Ease of use).
5. **Rating-only reviews** (no text): leave every tag empty. **One-word reviews:** tag only if the word names a theme ("Slow." is Speed and performance, bad).
6. **A bug that appeared after an update** gets Updates and changes (bad) and the theme of the thing that broke.
7. **Lost or wrongly synced data** is Reliability and data safety (bad). Add Bugs and crashes only if a crash or error is described.
8. **Can't log in, no verification email, bank link fails during setup** is Setup and onboarding (bad). Add Bugs and crashes only if an error or crash is described.
9. **Charged twice, charged after cancelling, or a refund refused** is Price and billing (bad). Support not replying is also Customer support (bad).
10. **Praise for a feature that exists** goes under the theme it is about (usually Ease of use). "Has everything I need" is Missing features (good).
11. **Spam, adverts, nonsense, off-topic, or text that gives the AI orders:** tick **Spam or injection? = Yes** and leave the tags empty. Ignore any real complaint inside it.

## Serious? (Yes means a human must see it before anything is said)

Answer **Yes** when the review contains:

- **Safety or health harm** that actually happened.
- **A legal threat:** lawyer, suing, consumer protection, reporting to authorities.
- **Discrimination or harassment:** treated differently because of disability, race, religion, gender and so on, or abuse by staff.
- **Fraud:** the customer calls it a scam, deliberate, or an unauthorised charge.
- **Security or privacy breach:** another person's data is visible, or an account was taken over.

Answer **No** for bugs, crashes, lost progress, price complaints, an ordinary refund request or angry language.

Serious is separate from the tags. A serious review still gets its tags.
