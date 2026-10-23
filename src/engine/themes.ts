export const THEMES = [
  "Wait time and speed",
  "Staff attitude",
  "Product or food quality",
  "Cleanliness",
  "Price and value",
  "Atmosphere and comfort",
  "Location and access",
  "Booking and ordering",
  "Communication and follow-up",
  "Consistency",
  "Menu and dietary needs",
  "Delivery and packaging",
  "Other",
] as const;

export type Theme = (typeof THEMES)[number];
export type Sentiment = "positive" | "negative";

export const UMBRELLA_GROUPS: Record<string, readonly Theme[]> = {
  "Food and menu": ["Product or food quality", "Menu and dietary needs"],
  Service: ["Staff attitude", "Communication and follow-up"],
  "Speed and orders": ["Wait time and speed", "Booking and ordering", "Delivery and packaging"],
  "Place and comfort": ["Cleanliness", "Atmosphere and comfort", "Location and access"],
  "Value and reliability": ["Price and value", "Consistency"],
};

export function groupOf(theme: Theme): string | null {
  for (const [group, themes] of Object.entries(UMBRELLA_GROUPS)) {
    if (themes.includes(theme)) return group;
  }
  return null;
}

export function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}
