import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { ShopPrices, DEFAULT_SHOP_PRICES } from '@/lib/shop';

export async function getLiveShopPrices(): Promise<ShopPrices> {
  try {
    const row = await db.select().from(systemSettings).where(eq(systemSettings.key, 'shop_prices')).get();
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return {
        tag: typeof parsed.tag === 'number' ? parsed.tag : DEFAULT_SHOP_PRICES.tag,
        body: { ...DEFAULT_SHOP_PRICES.body, ...(parsed.body || {}) },
        color: { ...DEFAULT_SHOP_PRICES.color, ...(parsed.color || {}) },
        hiddenBodies: Array.isArray(parsed.hiddenBodies) ? parsed.hiddenBodies : [],
        bodyMetadata: typeof parsed.bodyMetadata === 'object' && parsed.bodyMetadata !== null ? parsed.bodyMetadata : {},
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SHOP_PRICES;
}

export async function saveLiveShopPrices(prices: ShopPrices): Promise<void> {
  try {
    await db
      .insert(systemSettings)
      .values({
        key: 'shop_prices',
        value: JSON.stringify(prices),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: JSON.stringify(prices),
          updatedAt: new Date(),
        },
      });
  } catch {
    try {
      await db.delete(systemSettings).where(eq(systemSettings.key, 'shop_prices'));
      await db.insert(systemSettings).values({
        key: 'shop_prices',
        value: JSON.stringify(prices),
        updatedAt: new Date(),
      });
    } catch {}
  }
}
