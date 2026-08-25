import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateCoupleBody,
  CreateSessionBody,
  GetCoupleEntriesParams,
  GetCoupleParams,
  JoinCoupleBody,
  SaveCoupleEntryBody,
  SaveCoupleEntryParams,
} from "@workspace/api-zod";
import {
  coupleEntriesTable,
  coupleMembersTable,
  couplesTable,
  deviceSessionsTable,
  db,
  type Couple,
  type CoupleEntry,
  type CoupleMember,
  type User,
  usersTable,
} from "@workspace/db";

const router: IRouter = Router();
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_RECOVERY_ATTEMPTS = 5;
const RECOVERY_LOCKOUT_MS = 15 * 60 * 1000;
const recoveryFailures = new Map<string, { attempts: number; lockedUntil?: number }>();

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function newInviteCode(): string {
  return Array.from(
    { length: 6 },
    () => INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)],
  ).join("");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashRecoveryPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifiesRecoveryPin(pin: string, encodedHash: string): boolean {
  const [salt, savedKey] = encodedHash.split(":");
  if (!salt || !savedKey) return false;
  const derivedKey = scryptSync(pin, salt, 64);
  const storedKey = Buffer.from(savedKey, "hex");
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

function normalizeAccountKey(value: string): string {
  return value.trim().replace(/\D/g, "");
}

function recoveryIsLocked(accountKey: string): boolean {
  const failure = recoveryFailures.get(accountKey);
  if (!failure?.lockedUntil) return false;
  if (failure.lockedUntil > Date.now()) return true;
  recoveryFailures.delete(accountKey);
  return false;
}

function recordRecoveryFailure(accountKey: string): void {
  const failure = recoveryFailures.get(accountKey) ?? { attempts: 0 };
  const attempts = failure.attempts + 1;
  recoveryFailures.set(accountKey, {
    attempts,
    lockedUntil: attempts >= MAX_RECOVERY_ATTEMPTS
      ? Date.now() + RECOVERY_LOCKOUT_MS
      : undefined,
  });
}

function badRequest(res: Response, message: string): void {
  res.status(400).json({ message });
}

function parseOrRespond<T extends { safeParse: (input: unknown) => { success: boolean; data?: unknown } }>(
  schema: T,
  input: unknown,
  res: Response,
): unknown | null {
  const result = schema.safeParse(input);
  if (!result.success) {
    badRequest(res, "Please check the information and try again.");
    return null;
  }
  return result.data;
}

async function findCoupleWithMembers(coupleId: string): Promise<{
  couple: Couple;
  members: CoupleMember[];
} | null> {
  const [couple] = await db
    .select()
    .from(couplesTable)
    .where(eq(couplesTable.id, coupleId))
    .limit(1);

  if (!couple) return null;

  const members = await db
    .select()
    .from(coupleMembersTable)
    .where(eq(coupleMembersTable.coupleId, coupleId))
    .orderBy(asc(coupleMembersTable.joinedAt));

  return { couple, members };
}

function responseForMember(couple: Couple, members: CoupleMember[], userId: string) {
  const partner = members.find((member) => member.userId !== userId);

  return {
    id: couple.id,
    inviteCode: couple.inviteCode,
    partnerName: partner?.name ?? "Waiting...",
    userId,
    startDate: couple.startDate,
    currentStreak: couple.currentStreak,
    longestStreak: couple.longestStreak,
    isDemoMode: false,
  };
}

function responseForUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    birthday: user.birthday ?? undefined,
    pronouns: user.pronouns ?? undefined,
  };
}

async function coupleResponseForUser(userId: string) {
  const [membership] = await db
    .select({ coupleId: coupleMembersTable.coupleId })
    .from(coupleMembersTable)
    .where(eq(coupleMembersTable.userId, userId))
    .limit(1);
  if (!membership) return undefined;

  const result = await findCoupleWithMembers(membership.coupleId);
  return result ? responseForMember(result.couple, result.members, userId) : undefined;
}

async function requireMember(coupleId: string, userId: string, res: Response) {
  const result = await findCoupleWithMembers(coupleId);
  if (!result || !result.members.some((member) => member.userId === userId)) {
    res.status(404).json({ message: "This shared space could not be found." });
    return null;
  }
  return result;
}

async function requireUserId(req: Request, res: Response): Promise<string | null> {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) {
    res.status(401).json({ message: "A private device session is required." });
    return null;
  }

  const [session] = await db
    .select({ userId: deviceSessionsTable.userId })
    .from(deviceSessionsTable)
    .where(eq(deviceSessionsTable.tokenHash, hashToken(token)))
    .limit(1);

  if (!session) {
    res.status(401).json({ message: "Your private device session has expired." });
    return null;
  }
  return session.userId;
}

function sharedEntry(
  date: string,
  userId: string,
  entries: CoupleEntry[],
) {
  const mine = entries.find((entry) => entry.userId === userId);
  const partner = entries.find((entry) => entry.userId !== userId);
  const bothSubmitted = Boolean(mine?.submitted && partner?.submitted);

  return {
    date,
    grateful: mine?.grateful ?? "",
    cute: mine?.cute ?? "",
    grow: mine?.grow ?? "",
    submitted: mine?.submitted ?? false,
    partnerGrateful: bothSubmitted ? (partner?.grateful ?? "") : "",
    partnerCute: bothSubmitted ? (partner?.cute ?? "") : "",
    partnerGrow: bothSubmitted ? (partner?.grow ?? "") : "",
    partnerSubmitted: partner?.submitted ?? false,
    myReaction: mine?.reaction ?? undefined,
    partnerReaction: bothSubmitted ? partner?.reaction ?? undefined : undefined,
    // Opening the reveal is a local UI moment for each partner. The server only
    // decides whether both private entries are available to reveal.
    revealed: false,
  };
}

router.post("/couples", async (req, res) => {
  const body = parseOrRespond(CreateCoupleBody, req.body, res);
  if (!body) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const { userName } = body as { userName: string };

  const existingMembership = await db
    .select({ coupleId: coupleMembersTable.coupleId })
    .from(coupleMembersTable)
    .where(eq(coupleMembersTable.userId, userId))
    .limit(1);

  if (existingMembership.length > 0) {
    res.status(409).json({ message: "This device is already paired." });
    return;
  }

  let inviteCode = newInviteCode();
  while (
    (
      await db
        .select({ id: couplesTable.id })
        .from(couplesTable)
        .where(eq(couplesTable.inviteCode, inviteCode))
        .limit(1)
    ).length > 0
  ) {
    inviteCode = newInviteCode();
  }

  const couple: Couple = {
    id: randomUUID(),
    inviteCode,
    createdAt: new Date(),
    startDate: getToday(),
    currentStreak: 0,
    longestStreak: 0,
    memberCount: 1,
  };

  await db.transaction(async (tx) => {
    await tx.insert(couplesTable).values(couple);
    await tx.insert(coupleMembersTable).values({
      coupleId: couple.id,
      userId,
      name: userName.trim(),
    });
  });

  res.status(201).json(responseForMember(couple, [], userId));
});

router.post("/sessions", async (req, res) => {
  const body = parseOrRespond(CreateSessionBody, req.body, res);
  if (!body) return;

  const {
    accountKey: rawAccountKey,
    recoveryPin,
    userName,
    birthday,
    pronouns,
  } = body as {
    accountKey: string;
    recoveryPin: string;
    userName?: string;
    birthday?: string;
    pronouns?: string;
  };
  const accountKey = normalizeAccountKey(rawAccountKey);
  if (accountKey.length < 8) {
    badRequest(res, "Please enter a valid phone number.");
    return;
  }
  if (recoveryIsLocked(accountKey)) {
    res.status(429).json({ message: "Too many attempts. Please try again in 15 minutes." });
    return;
  }

  let user: User;
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.accountKey, accountKey))
    .limit(1);

  if (existingUser) {
    if (!verifiesRecoveryPin(recoveryPin, existingUser.recoveryPinHash)) {
      recordRecoveryFailure(accountKey);
      res.status(401).json({ message: "That backup code is not correct." });
      return;
    }
    recoveryFailures.delete(accountKey);
    const [updatedUser] = await db
      .update(usersTable)
      .set({
        ...(userName?.trim() ? { name: userName.trim() } : {}),
        ...(birthday ? { birthday } : {}),
        ...(pronouns !== undefined ? { pronouns: pronouns || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existingUser.id))
      .returning();
    user = updatedUser ?? existingUser;
  } else {
    const [createdUser] = await db
      .insert(usersTable)
      .values({
        id: randomUUID(),
        accountKey,
        recoveryPinHash: hashRecoveryPin(recoveryPin),
        name: userName?.trim() || "You",
        birthday: birthday ?? null,
        pronouns: pronouns || null,
      })
      .returning();
    user = createdUser;
  }

  const token = randomBytes(32).toString("base64url");
  await db.insert(deviceSessionsTable).values({
    tokenHash: hashToken(token),
    userId: user.id,
  });
  res.status(201).json({
    userId: user.id,
    token,
    user: responseForUser(user),
    couple: await coupleResponseForUser(user.id),
  });
});

router.post("/couples/join", async (req, res) => {
  const body = parseOrRespond(JoinCoupleBody, req.body, res);
  if (!body) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const { inviteCode, userName } = body as {
    inviteCode: string;
    userName: string;
  };

  const [couple] = await db
    .select()
    .from(couplesTable)
    .where(eq(couplesTable.inviteCode, inviteCode.trim().toUpperCase()))
    .limit(1);

  if (!couple) {
    badRequest(res, "That invite code isn't available. Ask your partner to check it.");
    return;
  }

  const members = await db
    .select()
    .from(coupleMembersTable)
    .where(eq(coupleMembersTable.coupleId, couple.id))
    .orderBy(asc(coupleMembersTable.joinedAt));

  const existingMember = members.find((member) => member.userId === userId);
  if (existingMember) {
    res.json(responseForMember(couple, members, userId));
    return;
  }

  const existingElsewhere = await db
    .select({ coupleId: coupleMembersTable.coupleId })
    .from(coupleMembersTable)
    .where(eq(coupleMembersTable.userId, userId))
    .limit(1);

  if (existingElsewhere.length > 0) {
    badRequest(res, "This invite code is no longer available.");
    return;
  }

  const joinedCouple = await db.transaction(async (tx) => {
    const [reserved] = await tx
      .update(couplesTable)
      .set({ memberCount: sql`${couplesTable.memberCount} + 1` })
      .where(
        and(
          eq(couplesTable.id, couple.id),
          lt(couplesTable.memberCount, 2),
        ),
      )
      .returning();
    if (!reserved) return null;

    await tx.insert(coupleMembersTable).values({
      coupleId: couple.id,
      userId,
      name: userName.trim(),
    });
    return reserved;
  });
  if (!joinedCouple) {
    badRequest(res, "This invite code is no longer available.");
    return;
  }

  res.json(
    responseForMember(
      joinedCouple,
      [...members, { coupleId: couple.id, userId, name: userName.trim(), joinedAt: new Date() }],
      userId,
    ),
  );
});

router.get("/couples/:coupleId", async (req, res) => {
  const params = parseOrRespond(GetCoupleParams, req.params, res);
  if (!params) return;

  const { coupleId } = params as { coupleId: string };
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const result = await requireMember(coupleId, userId, res);
  if (!result) return;

  res.json(responseForMember(result.couple, result.members, userId));
});

router.get("/couples/:coupleId/entries", async (req, res) => {
  const params = parseOrRespond(GetCoupleEntriesParams, req.params, res);
  if (!params) return;

  const { coupleId } = params as { coupleId: string };
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const membership = await requireMember(coupleId, userId, res);
  if (!membership) return;

  const rows = await db
    .select()
    .from(coupleEntriesTable)
    .where(eq(coupleEntriesTable.coupleId, coupleId))
    .orderBy(asc(coupleEntriesTable.date));

  const byDate = new Map<string, CoupleEntry[]>();
  for (const row of rows) {
    byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
  }

  res.json(
    Array.from(byDate.entries()).map(([date, entries]) => sharedEntry(date, userId, entries)),
  );
});

router.put("/couples/:coupleId/entries/:date", async (req, res) => {
  const params = parseOrRespond(SaveCoupleEntryParams, req.params, res);
  const body = parseOrRespond(SaveCoupleEntryBody, req.body, res);
  if (!params || !body) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;

  const { coupleId, date } = params as { coupleId: string; date: string };
  const entry = body as {
    grateful: string;
    cute: string;
    grow: string;
    submitted: boolean;
    reaction?: string;
  };

  if (Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    badRequest(res, "Please use a valid date.");
    return;
  }

  const membership = await requireMember(coupleId, userId, res);
  if (!membership) return;

  const [existing] = await db
    .select()
    .from(coupleEntriesTable)
    .where(
      and(
        eq(coupleEntriesTable.coupleId, coupleId),
        eq(coupleEntriesTable.date, date),
        eq(coupleEntriesTable.userId, userId),
      ),
    )
    .limit(1);

  const submitted = existing?.submitted || entry.submitted;
  const reaction = entry.reaction ?? existing?.reaction ?? null;

  await db
    .insert(coupleEntriesTable)
    .values({
      coupleId,
      date,
      userId,
      grateful: entry.grateful,
      cute: entry.cute,
      grow: entry.grow,
      submitted,
      reaction,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        coupleEntriesTable.coupleId,
        coupleEntriesTable.date,
        coupleEntriesTable.userId,
      ],
      set: {
        grateful: entry.grateful,
        cute: entry.cute,
        grow: entry.grow,
        submitted,
        reaction,
        updatedAt: new Date(),
      },
    });

  const savedRows = await db
    .select({ date: coupleEntriesTable.date, submitted: coupleEntriesTable.submitted })
    .from(coupleEntriesTable)
    .where(eq(coupleEntriesTable.coupleId, coupleId));
  const submittedDates = new Set(
    savedRows.filter((row) => row.submitted).map((row) => row.date),
  );
  const dateBefore = (dateValue: string): string => {
    const dateObject = new Date(`${dateValue}T00:00:00.000Z`);
    dateObject.setUTCDate(dateObject.getUTCDate() - 1);
    return dateObject.toISOString().slice(0, 10);
  };
  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: string | undefined;
  for (const dateValue of [...submittedDates].sort()) {
    runningStreak = previousDate && dateBefore(dateValue) === previousDate
      ? runningStreak + 1
      : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = dateValue;
  }
  let currentStreak = 0;
  let cursor = getToday();
  while (submittedDates.has(cursor)) {
    currentStreak += 1;
    cursor = dateBefore(cursor);
  }
  const [coupleState] = await db
    .select({ longestStreak: couplesTable.longestStreak })
    .from(couplesTable)
    .where(eq(couplesTable.id, coupleId))
    .limit(1);
  await db
    .update(couplesTable)
    .set({
      currentStreak,
      longestStreak: Math.max(coupleState?.longestStreak ?? 0, longestStreak),
    })
    .where(eq(couplesTable.id, coupleId));

  const rows = await db
    .select()
    .from(coupleEntriesTable)
    .where(
      and(
        eq(coupleEntriesTable.coupleId, coupleId),
        eq(coupleEntriesTable.date, date),
      ),
    );

  res.json(sharedEntry(date, userId, rows));
});

export default router;