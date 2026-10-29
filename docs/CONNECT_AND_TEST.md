# Connect it and test it: your step-by-step

Do these on your own accounts. Nothing here needs code.

## A. Claude app (custom connector)
1. Get your personal link. Your own is the one made earlier; if you lost it, make a new one with the "Create a link" command in docs/HOSTED_SERVER.md (it prints once; save it privately).
2. In the Claude app: Settings, Connectors, Add custom connector. Name: Review Reply. URL: your link (`https://review-reply-mcp.hk-reviews-mcp.workers.dev/mcp/<secret>`). Leave sign-in fields empty. Menu names change; follow what you see.
3. New chat. Type: "Load the app demo data, then run my weekly review check."
4. Expected: Claude asks to confirm a theme list (the app list), tags 60 reviews in batches, then shows the digest with counts and quotes. Serious reviews (5 in the demo) should be listed for you first.
5. Tell me what happened, in any words. Screenshots are welcome with no secret link visible.

## B. ChatGPT (needs a paid plan and Developer Mode)
1. ChatGPT Settings, Connectors (Advanced), turn on Developer mode. Names change; check the app.
2. Add a new connector. Server URL: your personal link. Authentication: none.
3. New chat with that connector enabled: "Load the app demo data, then run my weekly review check."
4. Same expected result as A. Note anything different: tools not found, errors, tags in wrong format, refusing to call tools.
5. Tell me the result. I cannot test this myself because it needs your ChatGPT account.
