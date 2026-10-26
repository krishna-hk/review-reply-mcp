/** Anything that can answer a prompt: Claude, Gemini, or a stand-in used in tests. */
export interface ModelClient {
  readonly name: string;
  complete(system: string, user: string): Promise<string>;
}
