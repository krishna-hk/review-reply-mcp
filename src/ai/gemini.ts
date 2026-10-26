import type { ModelClient } from "./model.js";

/** Gemini client used only for our own early accuracy tests. Not part of the shipped product. */
export class GeminiClient implements ModelClient {
  readonly name: string;
  constructor(
    private readonly apiKey: string,
    private readonly model = "gemini-3.8-flash",
    private readonly minGapMs = 6500,
  ) {
    this.name = `gemini:${model}`;
  }
  private last = 0;

  async complete(system: string, user: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const wait = this.last + this.minGapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(240_000),
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
        });
      } catch (err) {
        // Network drop or timeout: wait and try again.
        console.log(`  network problem (${(err as Error).name}), retrying...`);
        await new Promise((r) => setTimeout(r, 10000 * (attempt + 1)));
        continue;
      }
      if (res.status === 429) {
        const body = await res.text();
        if (/PerDay|per day/i.test(body)) throw new Error("Gemini free-tier daily limit reached for this model. It resets after a day. Wait, use another key, or switch model.");
        await new Promise((r) => setTimeout(r, 15000 * (attempt + 1)));
        continue;
      }
      if (res.status >= 500) {
        await new Promise((r) => setTimeout(r, 15000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Gemini returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) throw new Error("Gemini returned no text");
      return text;
    }
    throw new Error("Gemini kept refusing or failing after 5 tries (rate limit?)");
  }
}
