export type ShopPrices = {
  tag: number;
  body: {
    ulat: number;
    burung?: number;
    ayam: number;
    sapi: number;
    domba?: number;
    virus: number;
    cacing: number;
    kangguru: number;
    pinguin: number;
    capybara: number;
    bebek: number;
    naga: number;
    hacker: number;
    [key: string]: number | undefined;
  };
  color: {
    body_static: number;
    body_rgb: number;
    tag1_static: number;
    tag1_rgb: number;
    nick_static: number;
    nick_rgb: number;
    [key: string]: number;
  };
  hiddenBodies?: string[];
  bodyMetadata?: Record<string, { name?: string; desc?: string }>;
};

export const DEFAULT_BODY_METADATA: Record<string, { name: string; num: string; desc: string; defaultPrice: number; isLimited?: boolean; isCyber?: boolean }> = {
  cat: { name: 'Kucing Petualang', num: 'Default', desc: 'Karakter utama petualang llysSmart.', defaultPrice: 0 },
  ulat: { name: 'Cacing / Ulat Melar', num: 'Item 1', desc: 'Animasi akordeon melar & mengkerut.', defaultPrice: 5000 },
  pinguin: { name: 'Pinguin Perut Luncur', num: 'Item 2', desc: 'Animasi megal-megol gemoy, meluncur tengkurap pakai perut & syal merah berkibar!', defaultPrice: 5000 },
  ayam: { name: 'Ayam Jago', num: 'Item 3', desc: 'Animasi kepala mengangguk & jengger merah.', defaultPrice: 5000 },
  sapi: { name: 'Sapi Padang', num: 'Item 4', desc: 'Animasi 4 kuku melangkah & belang hitam-putih.', defaultPrice: 5000 },
  capybara: { name: 'Capybara Masbro Jeruk', num: 'Item 5', desc: 'Santai tanpa beban hidup, buah jeruk membal di atas kepala & telinga kedut!', defaultPrice: 5000 },
  virus: { name: 'Virus Matrix', num: 'Item 6', desc: 'Animasi menggelinding muter saat jalan.', defaultPrice: 5000 },
  kangguru: { name: 'Kangguru Gemoy (Joey Pouch)', num: 'Item 7', desc: 'Animasi lompat membal gembul, kantung bayi lucu mengintip & telinga goyang!', defaultPrice: 5000 },
  bebek: { name: 'Bebek Baling-Baling', num: 'Item 8', desc: 'Pantat goyang heboh kiri-kanan, paruh kwek-kwek & topi baling-baling muter kencang!', defaultPrice: 5000 },
  naga: { name: 'Naga Cyber (Mecha Dragon)', num: 'LIMITED ⭐', desc: 'Edisi Terbatas! Sayap mecha mengepak, ekor bergelombang, jet plasma & aura orb energi.', defaultPrice: 10000, isLimited: true },
  hacker: { name: 'Hacker Cyber (Glitch Cipher)', num: 'CYBER 💻', desc: 'Topeng LED matrix, hujan kode binary hijau, glitch aura & terminal hologram!', defaultPrice: 10000, isCyber: true },
};

export const DEFAULT_SHOP_PRICES: ShopPrices = {
  tag: 5000,
  body: {
    ulat: 5000,
    burung: 5000,
    ayam: 5000,
    sapi: 5000,
    domba: 5000,
    virus: 5000,
    cacing: 5000,
    kangguru: 5000,
    pinguin: 5000,
    capybara: 5000,
    bebek: 5000,
    naga: 10000,
    hacker: 10000,
  },
  color: {
    body_static: 1000,
    body_rgb: 5000,
    tag1_static: 1000,
    tag1_rgb: 5000,
    nick_static: 1000,
    nick_rgb: 5000,
  },
  hiddenBodies: [],
  bodyMetadata: {},
};

export function normalizeBodyName(name: string): string {
  const clean = name.trim().toLowerCase();
  if (clean === 'item1' || clean === 'cacing' || clean === 'ulat') return 'ulat';
  if (clean === 'item2' || clean === 'pinguin' || clean === 'penguin' || clean === 'burung' || clean === 'bird') return 'pinguin';
  if (clean === 'item3' || clean === 'ayam' || clean === 'chicken') return 'ayam';
  if (clean === 'item4' || clean === 'sapi' || clean === 'cow') return 'sapi';
  if (clean === 'item5' || clean === 'capybara' || clean === 'kapibara' || clean === 'masbro' || clean === 'domba' || clean === 'sheep') return 'capybara';
  if (clean === 'item6' || clean === 'virus') return 'virus';
  if (clean === 'item7' || clean === 'kangguru' || clean === 'kangaroo' || clean === 'kango') return 'kangguru';
  if (clean === 'item8' || clean === 'bebek' || clean === 'duck') return 'bebek';
  if (clean === 'item9' || clean === 'naga' || clean === 'dragon' || clean === 'mecha') return 'naga';
  if (clean === 'item10' || clean === 'hacker' || clean === 'cyber' || clean === 'anon') return 'hacker';
  if (clean === 'cat' || clean === 'kucing' || clean.startsWith('cat-')) return 'cat';
  return clean;
}
