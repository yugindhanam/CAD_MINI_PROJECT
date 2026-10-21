import type { State } from "./domain";
const items = [
  [
    "Scientific calculator",
    "found",
    "electronics",
    "Central Library",
    "A scientific calculator was found near the second-floor study desks. Tell us its model and identifying marks.",
    "▦",
  ],
  [
    "Navy blue backpack",
    "lost",
    "bags",
    "Engineering Block",
    "A navy backpack with lecture notes and a water bottle in the side pocket.",
    "▱",
  ],
  [
    "A little set of keys",
    "found",
    "keys",
    "Student Centre",
    "Three keys on a ring, found on a bench outside the student centre.",
    "⚿",
  ],
  [
    "Wireless headphones",
    "found",
    "electronics",
    "Cafeteria",
    "Over-ear headphones left at a table. Describe the colour and brand in your claim.",
    "♬",
  ],
  [
    "Engineering mathematics",
    "lost",
    "books",
    "Central Library",
    "A well-loved mathematics textbook with handwritten notes tucked inside.",
    "▤",
  ],
  [
    "Campus ID card",
    "found",
    "ID cards",
    "Sports Complex",
    "A student ID was handed in at the sports reception. Please identify yourself privately.",
    "▣",
  ],
];
export const glyphs: Record<string, string> = {
  electronics: "♬",
  bags: "▱",
  keys: "⚿",
  books: "▤",
  "ID cards": "▣",
  accessories: "◉",
  others: "◇",
};
export function seed(): State {
  return {
    reports: items.map((x, i) => ({
      id: `sample-${i}`,
      title: x[0],
      type: x[1] as "lost" | "found",
      category: x[2] as any,
      location: x[3],
      description: x[4],
      date: "2026-10-20",
      reporterId: i === 1 ? "student" : "finder",
      status: "open",
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      version: 0,
    })),
    claims: [],
  };
}
