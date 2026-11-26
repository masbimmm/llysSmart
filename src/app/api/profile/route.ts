import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { roomPlayers, users } from '@/db/schema';
import { invalidateUserSessionCache, requireUser } from '@/server/auth/session';
import { hashPassword, verifyPassword } from '@/server/auth/crypto';
import { moveSchema } from '@/server/middleware/validation';
import { ok, fail, handleError } from '@/server/middleware/http';

const avatarEnum = z.enum([
  'cat-blue',
  'cat-pink',
  'cat-green',
  'cat-orange',
  'cat-purple',
  'virus',
  'cacing',
  'ulat',
  'burung',
  'ayam',
  'sapi',
  'domba',
]);

export async function GET() {
  try {
    const user = await requireUser();
    let customColors = null;
    if (user.customColors) {
      try {
        customColors = JSON.parse(user.customColors);
      } catch {}
    }
    return ok({
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        customNick: user.customNick ?? null,
        tag1: user.tag1 ?? null,
        tag2: user.tag2 ?? null,
        tag3: user.tag3 ?? null,
        customColors,
        externalId: user.externalId ?? null,
        role: user.role,
        avatar: user.avatar,
        totalPoints: user.totalPoints,
        totalStars: user.totalStars,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if (body.action === 'move') {
      const input = moveSchema.parse(body);
      if (input.roomId) {
        await db
          .update(roomPlayers)
          .set({ lastX: input.x, lastY: input.y, lastFacing: input.facing })
          .where(and(eq(roomPlayers.roomId, input.roomId), eq(roomPlayers.userId, user.id)));
      }
      return ok({ ok: true, x: input.x, y: input.y, facing: input.facing });
    }

    if (body.action === 'avatar') {
      const { avatar, targetId } = z.object({ avatar: avatarEnum, targetId: z.string().optional() }).parse(body);
      const targetUserId = (targetId && (user.role === 'admin' || user.role === 'teacher')) ? targetId : user.id;
      const equippedBody = avatar.startsWith('cat') ? 'cat' : avatar;
      await db.update(users).set({ avatar, equippedBody, updatedAt: new Date() }).where(eq(users.id, targetUserId));
      await db.update(roomPlayers).set({ avatar }).where(eq(roomPlayers.userId, targetUserId));
      invalidateUserSessionCache(targetUserId);
      return ok({ avatar, targetId: targetUserId });
    }

    if (body.action === 'update-profile') {
      const schema = z.object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .min(3, 'Username minimal 3 karakter')
          .max(24)
          .regex(/^[a-z0-9_]+$/, 'Username hanya boleh huruf kecil, angka, dan underscore'),
        avatar: avatarEnum.optional(),
      });
      const input = schema.parse(body);
      const dup = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(sql`lower(${users.username})`, input.username), ne(users.id, user.id)))
        .limit(1);
      if (dup[0]) {
        return fail('Username sudah digunakan pengguna lain', 409);
      }

      const nextAvatar = input.avatar ?? user.avatar;
      await db
        .update(users)
        .set({
          username: input.username,
          avatar: nextAvatar,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      if (input.avatar) {
        await db.update(roomPlayers).set({ avatar: input.avatar }).where(eq(roomPlayers.userId, user.id));
      }
      invalidateUserSessionCache(user.id);
      return ok({
        profile: {
          id: user.id,
          email: user.email,
          username: input.username,
          fullName: user.fullName,
          externalId: user.externalId ?? null,
          role: user.role,
          avatar: nextAvatar,
        },
      });
    }

    if (body.action === 'change-password') {
      const schema = z.object({
        currentPassword: z.string().min(1, 'Password lama wajib diisi'),
        newPassword: z.string().min(6, 'Password baru minimal 6 karakter').max(100),
      });
      const input = schema.parse(body);
      if (!verifyPassword(input.currentPassword, user.passwordHash)) {
        return fail('Password lama tidak sesuai', 400);
      }
      const passwordHash = hashPassword(input.newPassword);
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      invalidateUserSessionCache(user.id);
      return ok({ success: true });
    }

    if (body.action === 'admin-set-nick' || body.action === 'set-nick') {
      const schema = z.object({
        targetId: z.string().min(1),
        nick: z.string().trim().max(30).nullable().optional(),
        username: z.string().trim().max(30).nullable().optional(),
      });
      const input = schema.parse(body);
      const isStaffOrAdmin = user.role === 'admin' || user.role === 'teacher';
      if (!isStaffOrAdmin && user.id !== input.targetId) {
        return fail('Hanya Administrator atau Guru yang bisa ganti nickname user lain', 403);
      }
      const rawNick = input.nick !== undefined ? input.nick : input.username;
      const nickValue = rawNick?.trim() ? rawNick.trim().slice(0, 25) : null;

      await db
        .update(users)
        .set({ customNick: nickValue, updatedAt: new Date() })
        .where(eq(users.id, input.targetId));
      invalidateUserSessionCache(input.targetId);
      return ok({ customNick: nickValue, targetId: input.targetId });
    }

    if (body.action === 'set-tag') {
      const schema = z.object({
        targetId: z.string().min(1),
        position: z.enum(['1', '2', '3', 'all']),
        tag: z.string().trim().max(30).nullable().optional(),
      });
      const input = schema.parse(body);
      const isStaffOrAdmin = user.role === 'admin' || user.role === 'teacher';
      if (!isStaffOrAdmin && user.id !== input.targetId) {
        return fail('Hanya Administrator atau Guru yang bisa mengatur title/tag', 403);
      }
      const tagValue = input.tag?.trim() ? input.tag.trim().slice(0, 24) : null;

      if (input.position === 'all') {
        await db
          .update(users)
          .set({ tag1: null, tag2: null, tag3: null, updatedAt: new Date() })
          .where(eq(users.id, input.targetId));
      } else if (input.position === '1') {
        await db
          .update(users)
          .set({ tag1: tagValue, updatedAt: new Date() })
          .where(eq(users.id, input.targetId));
      } else if (input.position === '2') {
        await db
          .update(users)
          .set({ tag2: tagValue, updatedAt: new Date() })
          .where(eq(users.id, input.targetId));
      } else if (input.position === '3') {
        await db
          .update(users)
          .set({ tag3: tagValue, updatedAt: new Date() })
          .where(eq(users.id, input.targetId));
      }

      invalidateUserSessionCache(input.targetId);
      return ok({ targetId: input.targetId, position: input.position, tag: tagValue });
    }

    if (body.action === 'set-colors') {
      const schema = z.object({
        targetId: z.string().min(1),
        channel: z.enum(['body', 'tag', 'tag1', 'tag2', 'tag3', 'nick']).optional(),
        color: z.string().nullable().optional(),
        colors: z
          .object({
            body: z.string().nullable().optional(),
            tag: z.string().nullable().optional(),
            tag1: z.string().nullable().optional(),
            tag2: z.string().nullable().optional(),
            tag3: z.string().nullable().optional(),
            nick: z.string().nullable().optional(),
          })
          .optional(),
      });
      const input = schema.parse(body);
      const isStaffOrAdmin = user.role === 'admin' || user.role === 'teacher';
      if (!isStaffOrAdmin && user.id !== input.targetId) {
        return fail('Hanya Administrator atau Guru yang bisa mengganti warna permanen', 403);
      }

      const targetRows = await db
        .select({ customColors: users.customColors })
        .from(users)
        .where(eq(users.id, input.targetId))
        .limit(1);

      let currentColors: Record<string, string> = {};
      if (targetRows[0]?.customColors) {
        try {
          currentColors = JSON.parse(targetRows[0].customColors) || {};
        } catch {}
      }

      if (input.colors) {
        for (const [k, v] of Object.entries(input.colors)) {
          if (!v || v === 'none' || v === 'reset') delete currentColors[k];
          else currentColors[k] = v;
        }
      } else if (input.channel) {
        if (!input.color || input.color === 'none' || input.color === 'reset') {
          delete currentColors[input.channel];
        } else {
          currentColors[input.channel] = input.color;
        }
      }

      const nextJson = Object.keys(currentColors).length > 0 ? JSON.stringify(currentColors) : null;
      await db
        .update(users)
        .set({ customColors: nextJson, updatedAt: new Date() })
        .where(eq(users.id, input.targetId));
      invalidateUserSessionCache(input.targetId);
      return ok({ targetId: input.targetId, customColors: currentColors });
    }

    return handleError(new Error('Aksi tidak dikenal'));
  } catch (err) {
    return handleError(err);
  }
}
