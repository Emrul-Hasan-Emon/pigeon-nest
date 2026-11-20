// Which homepage a section belongs to.
// MAIN: free-form, admin can add / remove / reorder any number of sections.
// SLOTS: fixed set of slots seeded by a migration; admin can only edit them.
export enum HomepagePage {
  MAIN = 'main',
  SLOTS = 'slots',
}

export const HOMEPAGE_SLOT_COUNT = 4;
export const HOMEPAGE_MAIN_MAX_SECTIONS = 100;
