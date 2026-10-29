import { GUIDANCE } from "../generated/prompts.js";
import { OTHER_DEF, type ThemeDef } from "./themes.js";

export interface Preset {
  key: string;
  label: string;
  /** Plain-language note so the user can pick the closest starting point. */
  best_for: string;
  themes: ThemeDef[];
  /** Tagging rules specific to this kind of business, appended to the shared tagging prompt. */
  guidance: string;
}

const t = (name: string, description: string, group: string): ThemeDef => ({ name, description, group });

export const PRESETS: Preset[] = [
  {
    key: "app_feedback",
    label: "App or software feedback",
    best_for: "App Store or Play Store reviews, support tickets, survey comments and in-app feedback for a product team",
    themes: [
      t("Bugs and crashes", "Crashes, error messages, things that do not work as intended", "Quality"),
      t("Speed and performance", "Slow loading, lag, freezing, battery or storage use", "Quality"),
      t("Data loss and sync", "Lost, wrong or duplicated data, sync failures, outages; NOT privacy or security", "Quality"),
      t("Ease of use", "Confusing screens, hard to find things, learning curve; or simple and intuitive", "Experience"),
      t("Setup and onboarding", "Signing up, logging in, password reset, first-run, moving data in", "Experience"),
      t("Design and look", "Appearance, colours, dark mode, layout, icons", "Experience"),
      t("Missing features", "Features asked for or said to be missing; or having everything needed", "Product"),
      t("Integrations and imports", "Connections to other apps, import and export, APIs", "Product"),
      t("Updates and changes", "A new version breaking, removing or improving something people relied on", "Product"),
      t("Price and billing", "Cost, paywalls, plans, subscriptions, charges and refunds", "Money and support"),
      t("Customer support", "How fast and helpful the support team was", "Money and support"),
      t("Privacy and security", "Permissions, tracking, data collection, account security", "Trust"),
      t("Overall impression", "A verdict on the whole product with no reason given, such as Good app or Best one I have used", "Overall"),
      OTHER_DEF,
    ],
    guidance: GUIDANCE["app"] ?? "",
  },
  {
    key: "restaurant",
    label: "Restaurant, cafe or food delivery",
    best_for: "Google Maps, Zomato, Yelp or delivery-app reviews of a place that serves or delivers food",
    themes: [
      t("Wait time and speed", "Waits for a table, food, the bill, or a delivery", "Speed and orders"),
      t("Staff attitude", "Friendly, rude, attentive, dismissive (people inside the venue; couriers go to Delivery and packaging)", "Service"),
      t("Product or food quality", "Taste, temperature, freshness, portion quality", "Food and menu"),
      t("Cleanliness", "Tables, restrooms, cutlery, floors, hair or objects in food", "Place and comfort"),
      t("Price and value", "Cost, portion for the price, deals", "Value and reliability"),
      t("Atmosphere and comfort", "Noise, seating, music, decor, temperature", "Place and comfort"),
      t("Location and access", "Parking, finding the place, step-free access", "Place and comfort"),
      t("Booking and ordering", "Reservations, online ordering, wrong, missing or forgotten items", "Speed and orders"),
      t("Communication and follow-up", "Not called back, no reply to a complaint", "Service"),
      t("Consistency", "Used to be great, good one visit and bad the next, or the same every time", "Value and reliability"),
      t("Menu and dietary needs", "Choice, allergy handling in the menu, vegetarian options", "Food and menu"),
      t("Delivery and packaging", "Takeaway or delivery condition, late courier, spills", "Speed and orders"),
      OTHER_DEF,
    ],
    guidance: GUIDANCE["restaurant"] ?? "",
  },
  {
    key: "general",
    label: "Any other business",
    best_for: "A shop, hotel, salon or any other service, when no closer starting point exists",
    themes: [
      t("Quality of product or service", "How good the product or the work itself was", "Quality"),
      t("Staff and people", "Friendliness, rudeness, helpfulness, attentiveness of people", "Service"),
      t("Speed and waiting", "Waiting times, slow or fast service", "Service"),
      t("Price and value", "Cost compared with what the customer got", "Value"),
      t("Communication and follow-up", "Not called back, no reply, clear or unclear information", "Service"),
      t("Ordering, booking and delivery", "Orders, bookings and deliveries: wrong, missing, late or smooth", "Service"),
      t("Facilities and environment", "The place, website or surroundings: cleanliness, comfort, access", "Quality"),
      t("Consistency", "Used to be good, good one time and bad the next, or the same every time", "Value"),
      OTHER_DEF,
    ],
    guidance: GUIDANCE["general"] ?? "",
  },
];

export function presetByKey(key: string): Preset | undefined {
  return PRESETS.find((p) => p.key === key);
}
