# Connect the Claude desktop app to the local server

This runs the server on your own Mac and connects the Claude desktop app to it. Nothing goes to the internet except what Claude itself sends in your chat. Menu names in the app change over time, so check them against what you see.

## 1. Add the server to Claude's settings file

The file is `~/Library/Application Support/Claude/claude_desktop_config.json`. In the Claude desktop app you can also find it under Settings, Developer, Edit Config.

If the file already has an `"mcpServers"` section, add the `"review-reply"` block inside it and keep your other servers. If not, use this whole file:

```json
{
  "mcpServers": {
    "review-reply": {
      "command": "/Users/harikrishna/.nvm/versions/node/v22.22.0/bin/node",
      "args": [
        "/Users/harikrishna/Downloads/MCP Product/review-reply-mcp/node_modules/tsx/dist/cli.mjs",
        "/Users/harikrishna/Downloads/MCP Product/review-reply-mcp/src/stdio.ts"
      ],
      "env": {
        "REVIEW_REPLY_DB": "/Users/harikrishna/Downloads/MCP Product/review-reply-mcp/data/private/local.sqlite"
      }
    }
  }
}
```

The full path to `node` is needed because the Claude app does not see the Node.js you installed with nvm. Reviews are stored in the `local.sqlite` file in `data/private/`, which Git ignores.

## 2. Restart the Claude desktop app

Quit it completely (Cmd+Q) and open it again. In a new chat, click the tools or connectors icon. You should see "review-reply" with 14 tools. If it shows an error, open the Developer settings to see the log and send it to me.

## 3. Try it

In a new chat, say:

> Load the demo data, then run my weekly review check.

You can also pick the "weekly_review" prompt from the app's prompt menu. Claude should load the demo reviews, label them in batches, show a digest, and offer to draft replies. Watch for these:

- Serious reviews (food poisoning, discrimination, a legal threat) are mentioned first and their drafts say they need your approval.
- Spam gets no reply.
- Nothing is ever posted. You copy approved replies yourself.

## 4. Use your own reviews

Say "Here is my reviews file" and attach or paste the CSV text, then ask Claude to import it. Before that, tell Claude to delete the demo data (it will ask you to confirm), or ask it to load your own with `replace`.

## Starting over

Ask Claude to "delete all my data", or delete the file `data/private/local.sqlite` while the app is closed.
