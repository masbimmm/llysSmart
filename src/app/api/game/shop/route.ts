import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { roomPlayers, users } from '@/db/schema';
import { requireUser } from '@/server/auth/session';
import { ok, fail, handleError } from '@/server/middleware/http';
import { publishToRoom } from '@/server/services/realtime-service';
import { normalizeBodyName } from '@/lib/shop';
import { getLiveShopPrices, saveLiveShopPrices } from '@/server/services/shop-service';

export async function GET() {
  try {
    const user = await requireUser();
    const prices = await getLiveShopPrices();
    const dbUser = await db.select().from(users).where(eq(users.id, user.id)).get();
    if (!dbUser) return fail('User tidak ditemukan', 404);

    let unlocked: string[] = ['cat'];
    try {
      if (dbUser.unlockedBodies) unlocked = JSON.parse(dbUser.unlockedBodies);
    } catch { }

    let customColors = null;
    try {
      if (dbUser.customColors) customColors = JSON.parse(dbUser.customColors);
    } catch { }

    return ok({
      prices,
      totalPoints: dbUser.totalPoints,
      unlockedBodies: Array.from(new Set(['cat', ...unlocked])),
      equippedBody: dbUser.equippedBody ?? 'cat',
      tag1: dbUser.tag1,
      customColors,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const action = body.action;
    const roomId = typeof body.roomId === 'string' ? body.roomId : undefined;

    const dbUser = await db.select().from(users).where(eq(users.id, user.id)).get();
    if (!dbUser) return fail('User tidak ditemukan', 404);

    const prices = await getLiveShopPrices();
    const isStaff = dbUser.role === 'admin' || dbUser.role === 'teacher';

    let unlockedBodies: string[] = ['cat'];
    try {
      if (dbUser.unlockedBodies) unlockedBodies = JSON.parse(dbUser.unlockedBodies);
    } catch { }
    unlockedBodies = Array.from(new Set(['cat', ...unlockedBodies]));

    // =========================================================================
    // 1. BUY BODY / CHARACTER
    // =========================================================================
    if (action === 'buy_body') {
      const rawBody = typeof body.body === 'string' ? body.body : '';
      const bodyKey = normalizeBodyName(rawBody);
      if (!bodyKey) return fail('Nama karakter tidak valid', 400);

      if (prices.hiddenBodies?.includes(bodyKey) && dbUser.role !== 'admin') {
        return fail('Karakter ini sedang disembunyikan oleh Administrator (Only Admin).', 403);
      }

      const canonicalAvatar = bodyKey === 'cat' ? 'cat-blue' : bodyKey;

      if (unlockedBodies.includes(bodyKey)) {
        // Sudah dibeli: langsung equip
        await db
          .update(users)
          .set({ equippedBody: bodyKey, avatar: canonicalAvatar, updatedAt: new Date() })
          .where(eq(users.id, user.id));
        if (roomId) {
          try {
            await db.update(roomPlayers).set({ avatar: canonicalAvatar }).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, user.id)));
          } catch { }
          void publishToRoom(roomId, 'cmd', { op: 'cosmetics', targetId: user.id, avatar: canonicalAvatar, bodyModel: bodyKey });
        }
        return ok({
          ok: true,
          alreadyOwned: true,
          equippedBody: bodyKey,
          avatar: canonicalAvatar,
          unlockedBodies,
          totalPoints: dbUser.totalPoints,
        });
      }

      const cost = isStaff ? 0 : (prices.body[bodyKey] ?? 5000);
      if (dbUser.totalPoints < cost) {
        return fail(`Poin tidak cukup (${dbUser.totalPoints} / ${cost} Poin dibutuhkan).`, 400);
      }

      const newPoints = dbUser.totalPoints - cost;
      const nextUnlocked = Array.from(new Set([...unlockedBodies, bodyKey]));
      await db
        .update(users)
        .set({
          totalPoints: newPoints,
          unlockedBodies: JSON.stringify(nextUnlocked),
          equippedBody: bodyKey,
          avatar: canonicalAvatar,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      if (roomId) {
        try {
          await db.update(roomPlayers).set({ avatar: canonicalAvatar }).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, user.id)));
        } catch { }
        void publishToRoom(roomId, 'cmd', { op: 'cosmetics', targetId: user.id, avatar: canonicalAvatar, bodyModel: bodyKey });
      }

      return ok({
        ok: true,
        alreadyOwned: false,
        equippedBody: bodyKey,
        avatar: canonicalAvatar,
        unlockedBodies: nextUnlocked,
        totalPoints: newPoints,
        pointsDeducted: cost,
      });
    }

    // =========================================================================
    // 2. EQUIP BODY (FREE IF UNLOCKED)
    // =========================================================================
    if (action === 'equip_body') {
      const rawBody = typeof body.body === 'string' ? body.body : '';
      const bodyKey = normalizeBodyName(rawBody);
      if (!bodyKey) return fail('Nama karakter tidak valid', 400);

      if (prices.hiddenBodies?.includes(bodyKey) && dbUser.role !== 'admin') {
        return fail('Karakter ini sedang disembunyikan oleh Administrator (Only Admin).', 403);
      }

      if (!isStaff && !unlockedBodies.includes(bodyKey)) {
        return fail('Karakter ini belum kamu beli. Beli terlebih dahulu menggunakan poin!', 400);
      }

      const canonicalAvatar = bodyKey === 'cat' ? 'cat-blue' : bodyKey;
      await db
        .update(users)
        .set({ equippedBody: bodyKey, avatar: canonicalAvatar, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      if (roomId) {
        try {
          await db.update(roomPlayers).set({ avatar: canonicalAvatar }).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, user.id)));
        } catch { }
        void publishToRoom(roomId, 'cmd', { op: 'cosmetics', targetId: user.id, avatar: canonicalAvatar, bodyModel: bodyKey });
      }

      return ok({
        ok: true,
        equippedBody: bodyKey,
        avatar: canonicalAvatar,
        unlockedBodies,
        totalPoints: dbUser.totalPoints,
      });
    }

    // =========================================================================
    // 3. BUY / CHANGE TAG 1
    // =========================================================================
    if (action === 'buy_tag1') {
      const rawTitle = typeof body.title === 'string' ? body.title : typeof body.tag === 'string' ? body.tag : '';
      const title = rawTitle.trim().slice(0, 24);
      if (!title) return fail('Gelar/tag tidak boleh kosong.', 400);

      // Repeat Buy Check: jika sudah memakai tag yang sama, tidak perlu potong poin lagi
      if (dbUser.tag1 && dbUser.tag1.trim() === title) {
        return ok({
          ok: true,
          alreadyOwned: true,
          tag1: title,
          totalPoints: dbUser.totalPoints,
          pointsDeducted: 0,
        });
      }

      const cost = isStaff ? 0 : (prices.tag ?? 5000);
      if (dbUser.totalPoints < cost) {
        return fail(`Poin tidak cukup (${dbUser.totalPoints} / ${cost} Poin dibutuhkan).`, 400);
      }

      const newPoints = dbUser.totalPoints - cost;
      await db
        .update(users)
        .set({
          totalPoints: newPoints,
          tag1: title,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      if (roomId) {
        void publishToRoom(roomId, 'cmd', { op: 'cosmetics', targetId: user.id, tag1: title, tag: title });
      }

      return ok({
        ok: true,
        tag1: title,
        totalPoints: newPoints,
        pointsDeducted: cost,
      });
    }

    // =========================================================================
    // 4. BUY / CHANGE COLOR
    // =========================================================================
    if (action === 'buy_color') {
      const part = body.part as 'body' | 'tag1' | 'nick';
      const mode = body.mode as 'static' | 'rgb';
      const colorVal = typeof body.color === 'string' && body.color.trim()
        ? body.color.trim()
        : typeof body.colorVal === 'string' && body.colorVal.trim()
          ? body.colorVal.trim()
          : '#ffd43b';

      if (!['body', 'tag1', 'nick'].includes(part)) return fail('Bagian warna tidak valid.', 400);
      if (!['static', 'rgb'].includes(mode)) return fail('Mode warna tidak valid.', 400);

      let curColors: Record<string, string> = {};
      try {
        if (dbUser.customColors) curColors = JSON.parse(dbUser.customColors);
      } catch { }

      const targetValue = mode === 'rgb' ? 'rgb' : colorVal;
      // Repeat Buy Check: jika warna part ini sudah sama dengan pilihan, jangan potong poin lagi
      if (curColors[part] && curColors[part].toLowerCase() === targetValue.toLowerCase()) {
        return ok({
          ok: true,
          alreadyOwned: true,
          customColors: curColors,
          totalPoints: dbUser.totalPoints,
          pointsDeducted: 0,
        });
      }

      const priceKey = `${part}_${mode}`;
      const cost = isStaff ? 0 : (prices.color[priceKey] ?? prices.color[`body_${mode}`] ?? (mode === 'rgb' ? 5000 : 1000));
      if (dbUser.totalPoints < cost) {
        return fail(`Poin tidak cukup (${dbUser.totalPoints} / ${cost} Poin dibutuhkan).`, 400);
      }

      curColors[part] = targetValue;
      const newPoints = dbUser.totalPoints - cost;

      await db
        .update(users)
        .set({
          totalPoints: newPoints,
          customColors: JSON.stringify(curColors),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      if (roomId) {
        void publishToRoom(roomId, 'cmd', { op: 'cosmetics', targetId: user.id, colors: curColors });
      }

      return ok({
        ok: true,
        customColors: curColors,
        totalPoints: newPoints,
        pointsDeducted: cost,
      });
    }

    // =========================================================================
    // 5. TOGGLE HIDE / UNHIDE ITEM (ADMIN ONLY)
    // =========================================================================
    if (action === 'toggle_hide') {
      if (dbUser.role !== 'admin') {
        return fail('Hanya Administrator yang dapat menyembunyikan atau menampilkan item toko.', 403);
      }
      const itemKey = normalizeBodyName(typeof body.itemId === 'string' ? body.itemId : typeof body.body === 'string' ? body.body : '');
      if (!itemKey || itemKey === 'cat') {
        return fail('Karakter default tidak dapat disembunyikan.', 400);
      }

      const currentPrices = await getLiveShopPrices();
      const hidden = new Set(currentPrices.hiddenBodies || []);
      let isHiddenNow = false;
      if (hidden.has(itemKey)) {
        hidden.delete(itemKey);
        isHiddenNow = false;
      } else {
        hidden.add(itemKey);
        isHiddenNow = true;
      }
      currentPrices.hiddenBodies = Array.from(hidden);
      await saveLiveShopPrices(currentPrices);

      if (roomId) {
        void publishToRoom(roomId, 'cmd', { op: 'shop_prices_update', prices: currentPrices });
      }

      return ok({
        ok: true,
        itemId: itemKey,
        isHidden: isHiddenNow,
        hiddenBodies: currentPrices.hiddenBodies,
        prices: currentPrices,
        message: isHiddenNow
          ? `Karakter '${itemKey}' berhasil disembunyikan dari toko (Guru & Siswa tidak dapat melihat/menggunakan).`
          : `Karakter '${itemKey}' berhasil ditampilkan kembali di toko.`,
      });
    }

    // =========================================================================
    // 6. EDIT ITEM NAME, PRICE, AND DESCRIPTION (ADMIN ONLY)
    // =========================================================================
    if (action === 'edit_item') {
      if (dbUser.role !== 'admin') {
        return fail('Hanya Administrator yang dapat mengedit nama, deskripsi, dan harga item toko.', 403);
      }
      const rawId = typeof body.itemId === 'string' ? body.itemId : typeof body.body === 'string' ? body.body : '';
      const itemId = normalizeBodyName(rawId);
      if (!itemId) return fail('ID item tidak valid.', 400);

      const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 40) : undefined;
      const desc = typeof body.desc === 'string' && body.desc.trim() ? body.desc.trim().slice(0, 160) : undefined;
      const price = typeof body.price === 'number' && Number.isFinite(body.price) ? Math.max(0, Math.round(body.price)) : undefined;

      const currentPrices = await getLiveShopPrices();
      if (!currentPrices.bodyMetadata) currentPrices.bodyMetadata = {};

      currentPrices.bodyMetadata[itemId] = {
        ...(currentPrices.bodyMetadata[itemId] || {}),
        ...(name !== undefined ? { name } : {}),
        ...(desc !== undefined ? { desc } : {}),
      };

      if (price !== undefined) {
        currentPrices.body[itemId] = price;
        if (itemId === 'ulat') currentPrices.body.cacing = price;
      }

      await saveLiveShopPrices(currentPrices);
      if (roomId) {
        void publishToRoom(roomId, 'cmd', { op: 'shop_prices_update', prices: currentPrices });
      }

      return ok({
        ok: true,
        itemId,
        prices: currentPrices,
        message: `Karakter [${name || itemId}] berhasil diperbarui!`,
      });
    }

    // =========================================================================
    // 7. SET SHOP PRICE (ADMIN ONLY)
    // =========================================================================
    if (action === 'set_price') {
      if (!isStaff) return fail('Hanya Administrator atau Guru yang dapat mengatur harga toko.', 403);
      const category = body.category as 'tag' | 'body' | 'color';
      const item = typeof body.item === 'string' ? body.item.toLowerCase() : '';
      const mode = typeof body.mode === 'string' ? body.mode.toLowerCase() : '';
      const price = typeof body.price === 'number' && Number.isFinite(body.price) ? Math.max(0, Math.round(body.price)) : 5000;

      const currentPrices = await getLiveShopPrices();
      if (category === 'tag') {
        currentPrices.tag = price;
      } else if (category === 'body') {
        const bodyKey = normalizeBodyName(item);
        currentPrices.body[bodyKey] = price;
        if (bodyKey === 'ulat') currentPrices.body.cacing = price;
      } else if (category === 'color') {
        const itemKey = item || 'body';
        const key = `${itemKey}_${mode}`;
        currentPrices.color[key] = price;
        // Sinkronkan harga ke seluruh bagian warna (tubuh, tag, nick) agar seragam
        if (mode === 'static' || mode === 'rgb') {
          currentPrices.color[`body_${mode}`] = price;
          currentPrices.color[`tag1_${mode}`] = price;
          currentPrices.color[`nick_${mode}`] = price;
        }
      }

      await saveLiveShopPrices(currentPrices);
      if (roomId) {
        void publishToRoom(roomId, 'cmd', { op: 'shop_prices_update', prices: currentPrices });
      }

      return ok({
        ok: true,
        prices: currentPrices,
        message: `Harga toko berhasil diperbarui!`,
      });
    }

    // =========================================================================
    // 6. RESET ITEMS (ADMIN ONLY)
    // =========================================================================
    if (action === 'reset_items') {
      if (dbUser.role !== 'admin') return fail('Hanya Administrator yang dapat mereset item toko.', 403);
      const itemType = body.itemType as 'body' | 'tag' | 'color' | 'all';
      if (!itemType || !['body', 'tag', 'color', 'all'].includes(itemType)) {
        return fail('Parameter itemType wajib diisi (body, tag, color, all).', 400);
      }
      const rawTarget = typeof body.target === 'string' ? body.target.trim().toLowerCase() : '';
      if (!rawTarget) {
        return fail('Parameter target wajib diisi ("all" atau username spesifik).', 400);
      }
      const targetQuery = rawTarget;

      if (targetQuery === 'all') {
        // Reset SEMUA user
        if (itemType === 'body' || itemType === 'all') {
          await db.update(users).set({ unlockedBodies: '["cat"]', equippedBody: 'cat', avatar: 'cat-blue' });
        }
        if (itemType === 'tag' || itemType === 'all') {
          await db.update(users).set({ tag1: null, tag2: null, tag3: null });
        }
        if (itemType === 'color' || itemType === 'all') {
          await db.update(users).set({ customColors: null });
        }
        if (roomId) {
          void publishToRoom(roomId, 'cmd', { op: 'reset_items', itemType, targetId: 'all' });
        }
        return ok({ ok: true, message: `Berhasil mereset item [${itemType.toUpperCase()}] untuk SEMUA user.` });
      }

      // Reset target spesifik
      const resolvedTarget = targetQuery === 'me' ? user.id : targetQuery;
      const targetUser = await db.select().from(users).where(eq(users.username, resolvedTarget)).get() ||
        await db.select().from(users).where(eq(users.id, resolvedTarget)).get();
      if (!targetUser) return fail(`User '${targetQuery}' tidak ditemukan.`, 404);

      if (itemType === 'body' || itemType === 'all') {
        await db.update(users).set({ unlockedBodies: '["cat"]', equippedBody: 'cat', avatar: 'cat-blue' }).where(eq(users.id, targetUser.id));
      }
      if (itemType === 'tag' || itemType === 'all') {
        await db.update(users).set({ tag1: null, tag2: null, tag3: null }).where(eq(users.id, targetUser.id));
      }
      if (itemType === 'color' || itemType === 'all') {
        await db.update(users).set({ customColors: null }).where(eq(users.id, targetUser.id));
      }

      if (roomId) {
        void publishToRoom(roomId, 'cmd', { op: 'reset_items', itemType, targetId: targetUser.id });
      }

      return ok({ ok: true, message: `Berhasil mereset item [${itemType.toUpperCase()}] untuk '${targetUser.username}'.` });
    }

    return fail('Action tidak dikenali', 400);
  } catch (err) {
    return handleError(err);
  }
}
