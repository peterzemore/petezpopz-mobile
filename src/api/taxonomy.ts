// PetezPopz — Storefront tag taxonomy
//
// The franchise vocabulary the store is tagged against. Products carry these as
// bare tags (e.g. "Lilo & Stitch"), alongside their parent category tag
// ("Disney") and brand tag ("Funko Pop" / "Loungefly").
//
// This is the lookup used to decide whether two products share a theme, which
// is what drives cross-merch and the Loungefly→Funko upsell.

export const FRANCHISES_BY_CATEGORY: Record<string, readonly string[]> = {
  Disney: [
    'Aladdin', 'Alice in Wonderland', 'Bambi', 'Beauty and the Beast', 'Cinderella',
    'A Goofy Movie', 'Lady and the Tramp', 'Peter Pan', 'Snow White', 'Winnie the Pooh',
    'Lilo & Stitch', 'Moana', 'Toy Story', 'Little Mermaid', 'Jungle Book', 'Up',
    'Sleeping Beauty', 'Robin Hood', 'The Nightmare Before Christmas', 'Haunted Mansion',
    'Other Great Disney Movies',
  ],
  Marvel: [
    'Ant-Man', 'Avengers', 'Black Panther', 'Captain America', 'Deadpool',
    'Doctor Strange', 'Eternals', 'Fantastic Four', 'Guardians of the Galaxy',
    'Iron Man', 'Loki', 'Spider-Man', 'Thor', 'Venom', 'More Marvel Comics',
  ],
  DC: [
    'Batman', 'The Flash', 'Superman', 'Aquaman', 'Suicide Squad', 'Wonder Woman',
    'Justice League', 'Green Lantern', 'More DC Comics',
  ],
  'Video Games': [
    'Sonic the Hedgehog', 'Overwatch', "Baldur's Gate", 'Batman: Gotham Knights',
    'Bioshock', 'Call of Duty', 'Halo', 'Cuphead', 'Diablo', 'Dungeons & Dragons',
    'Fallout', "Five Nights at Freddy's", 'Fortnite', 'Funko Fusion', 'Pokemon',
    'Silent Hill', 'More Video Games',
  ],
  Sports: ['NFL', 'NBA', 'MLB', 'NHL', 'WWE', 'More Sports'],
  Horror: [
    'Chucky', 'Pennywise', 'Nightmare on Elm Street', 'Terrifier', 'Beetlejuice',
    'Friday the 13th', 'Candyman', 'Silence of the Lambs', 'Addams Family',
    'Pet Sematary', 'The Nun', 'Annabelle', 'Killer Klowns from Outer Space',
    'Hocus Pocus', 'Texas Chainsaw Massacre', 'Rocky Horror Picture Show',
    'Insidious', 'The Conjuring', 'Ghostface', 'More Great Horror',
  ],
  Animation: [
    'Simpsons', 'Hazbin Hotel', 'KPop Demon Hunters', 'Animaniacs', 'Looney Tunes',
    'Fairly OddParents', "The Wild Thornberry's", 'King of the Hill', 'Captain Planet',
    'Grim Adventures of Billy & Mandy', 'Rick and Morty', 'Real Monsters',
    'Ghostbusters', 'Jem and the Holograms', 'Courage the Cowardly Dog',
    'More Animation',
  ],
  Anime: [
    'Attack on Titan', 'Avatar', 'Black Clover', 'Bleach', 'Boruto', 'Chainsaw Man',
    'Cowboy Bebop', 'Dandadan', 'Demon Slayer', 'Dragon Ball', 'Fairtail', 'Frieren',
    'Fullmetal Alchemist', "Hell's Paradise", 'Hunter X Hunter', 'Inuyasha',
    'Jujutsu Kaisen', 'Kaiju No. 8', 'My Hero Academia', 'Naruto', 'One Piece',
    'Re-ZERO', 'Sakamoto Days', 'Solo Leveling', 'Tokyo Ghoul:re', 'Yu-Gi-Oh',
    'More Anime Favorites',
  ],
  'Movies & TV': [
    'Avatar', 'Star Wars', 'Harry Potter', 'Lord of the Rings', 'Jurassic Park',
    'The Office', 'Game of Thrones', 'House of the Dragon', 'Ted Lasso',
    '007 James Bond', 'More Movies & TV',
  ],
};

/** Category-level tags — the top level of the Fandom Grid. */
export const CATEGORY_TAGS = Object.keys(FRANCHISES_BY_CATEGORY);

/**
 * Every specific franchise, minus the "More …" catch-alls. Catch-alls are
 * deliberately excluded: two products both tagged "More Great Horror" share a
 * bucket, not a theme, so pairing them would surface nonsense recommendations.
 */
export const SPECIFIC_FRANCHISES: readonly string[] = Object.values(FRANCHISES_BY_CATEGORY)
  .flat()
  .filter((f) => !/^(More |Other Great )/i.test(f));

const FRANCHISE_LOOKUP = new Set(SPECIFIC_FRANCHISES.map((f) => f.toLowerCase()));

/** Brand tags identifying which product line something belongs to. */
export const BRAND_TAG = {
  funko: 'Funko Pop',
  loungefly: 'Loungefly',
  protector: 'Protector',
} as const;

/**
 * Marks a product as VIP-early-access. Matched case-insensitively via hasTag,
 * so "vip_only:true" typed into Shopify still works — a strict === here meant
 * a casing slip silently disabled every VIP surface with no error anywhere.
 */
export const VIP_ONLY_TAG = 'VIP_Only';

/** Prefix for the drop-countdown tag, e.g. "Launch_Time:2026-08-15-10:00". */
export const LAUNCH_TIME_PREFIX = 'Launch_Time:';

export function hasTag(tags: string[], tag: string): boolean {
  return tags.some((t) => t.trim().toLowerCase() === tag.toLowerCase());
}

/**
 * The most specific franchise a product belongs to, or null.
 *
 * Longest match wins so a product tagged both "Batman" and
 * "Batman: Gotham Knights" resolves to the more specific of the two.
 */
export function resolveFranchise(tags: string[]): string | null {
  const matches = tags
    .map((t) => t.trim())
    .filter((t) => FRANCHISE_LOOKUP.has(t.toLowerCase()));
  if (!matches.length) return null;
  return matches.sort((a, b) => b.length - a.length)[0];
}

/** Pop display size, read from the size tags kept during the tag cleanup. */
export type PopSize = 'standard' | '6-inch' | '10-inch';

export function resolvePopSize(tags: string[], title = ''): PopSize {
  const hay = `${tags.join(' | ')} ${title}`.toLowerCase();
  if (/\b10[-\s]?inch\b/.test(hay)) return '10-inch';
  if (/\b6[-\s]?inch\b|\bsuper\s*6\b/.test(hay)) return '6-inch';
  return 'standard';
}
