export type ShopPrices = {
  tag: number;
  body: {
    ulat: number;
    burung: number;
    ayam: number;
    sapi: number;
    domba: number;
    virus: number;
    cacing: number;
    [key: string]: number;
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
  },
  color: {
    body_static: 1000,
    body_rgb: 5000,
    tag1_static: 1000,
    tag1_rgb: 5000,
    nick_static: 1000,
    nick_rgb: 5000,
  },
};

export function normalizeBodyName(name: string): string {
  const clean = name.trim().toLowerCase();
  if (clean === 'item1' || clean === 'cacing' || clean === 'ulat') return 'ulat';
  if (clean === 'item2' || clean === 'burung') return 'burung';
  if (clean === 'item3' || clean === 'ayam') return 'ayam';
  if (clean === 'item4' || clean === 'sapi') return 'sapi';
  if (clean === 'item5' || clean === 'domba') return 'domba';
  if (clean === 'item6' || clean === 'virus') return 'virus';
  if (clean === 'cat' || clean === 'kucing' || clean.startsWith('cat-')) return 'cat';
  return clean;
}
