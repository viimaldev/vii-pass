import { MongoServerError, ObjectId, type Collection, type WithId } from 'mongodb';
import type { Chord, ChordField } from '@vii-pass/shared';
import type { Bindings } from '../env';
import { getDb } from '../lib/mongo';
import { AppError } from '../middleware/error';
import { assertSectionOwned } from './sections.service';

/**
 * Chords service backed by the `chords` collection. A chord is a credential
 * entry belonging to exactly one section and one user, holding a title (unique
 * per section, case-insensitively), an optional URL, and exactly three typed
 * option rows. Every query is filtered by `userId` (and usually `sectionId`) so
 * a user only ever touches their own data (FR-015).
 */

/** Internal chord document stored in the `chords` collection. */
export interface ChordDoc {
  /** Owning user id (redundant with the section's owner for safe scoping). */
  userId: ObjectId;
  /** Parent section id. */
  sectionId: ObjectId;
  /** Order within the section (0-based). */
  position: number;
  /** Display title (trimmed, original casing preserved). */
  title: string;
  /** `title` lowercased for the per-section case-insensitive unique index. */
  titleNormalized: string;
  /** Normalized absolute `http(s)` URL, or `null` when unset. */
  url: string | null;
  /** Exactly three option rows, in slot order. */
  fields: ChordField[];
  /** ISO-8601 creation timestamp (immutable). */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/** Editable chord attributes accepted from validated request payloads. */
export interface ChordInput {
  title: string;
  url: string | null;
  fields: ChordField[];
}

const COLLECTION = 'chords';
let indexesEnsured: Promise<void> | undefined;

/** Resolve the typed `chords` collection, ensuring indexes once per isolate. */
async function getChords(env: Bindings): Promise<Collection<ChordDoc>> {
  const db = await getDb(env);
  const collection = db.collection<ChordDoc>(COLLECTION);
  if (!indexesEnsured) {
    indexesEnsured = Promise.all([
      collection.createIndex({ userId: 1, sectionId: 1, position: 1 }),
      // Race-proof backstop for the duplicate-title pre-check (research D2).
      collection.createIndex(
        { userId: 1, sectionId: 1, titleNormalized: 1 },
        { unique: true },
      ),
    ]).then(() => undefined);
  }
  await indexesEnsured;
  return collection;
}

/** Project an internal document to its public, client-safe shape. */
function toPublicChord(doc: WithId<ChordDoc>): Chord {
  return {
    id: doc._id.toHexString(),
    sectionId: doc.sectionId.toHexString(),
    position: doc.position,
    title: doc.title,
    url: doc.url,
    fields: doc.fields,
  };
}

/** Normalize a title for case-insensitive, whitespace-insensitive uniqueness. */
function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** The 409 thrown when a title collides within the section (FR-002). */
function duplicateTitleError(): AppError {
  return new AppError(
    409,
    'chord_title_taken',
    'A chord with this title already exists in this section.',
  );
}

/** True when `err` is the unique-index violation from a concurrent save. */
function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof MongoServerError && err.code === 11000;
}

/**
 * Reject with a 409 when another chord in the section already uses this title
 * (case-insensitively). `excludeId` skips the chord being edited so a chord
 * never conflicts with itself (FR-014).
 */
async function assertTitleAvailable(
  chords: Collection<ChordDoc>,
  userId: ObjectId,
  sectionId: ObjectId,
  titleNormalized: string,
  excludeId?: ObjectId,
): Promise<void> {
  const clash = await chords.findOne({
    userId,
    sectionId,
    titleNormalized,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (clash) {
    throw duplicateTitleError();
  }
}

/**
 * List a section's chords in order. The section must be owned by the user
 * (verified first) or a `404` is thrown.
 */
export async function listChords(
  env: Bindings,
  userId: string,
  sectionId: string,
): Promise<Chord[]> {
  const section = await assertSectionOwned(env, userId, sectionId);
  const chords = await getChords(env);
  const docs = await chords
    .find({ userId: new ObjectId(userId), sectionId: section })
    .sort({ position: 1 })
    .toArray();
  return docs.map(toPublicChord);
}

/**
 * Add a chord to a section, appended after existing chords. The section must be
 * owned by the user or a `404` is thrown; a duplicate title within the section
 * (case-insensitive) is rejected with a `409` (FR-001, FR-002).
 */
export async function createChord(
  env: Bindings,
  userId: string,
  sectionId: string,
  input: ChordInput,
): Promise<Chord> {
  const section = await assertSectionOwned(env, userId, sectionId);
  const owner = new ObjectId(userId);
  const chords = await getChords(env);
  const titleNormalized = normalizeTitle(input.title);
  await assertTitleAvailable(chords, owner, section, titleNormalized);

  const count = await chords.countDocuments({ userId: owner, sectionId: section });
  const now = new Date().toISOString();
  const doc: ChordDoc = {
    userId: owner,
    sectionId: section,
    position: count,
    title: input.title,
    titleNormalized,
    url: input.url,
    fields: input.fields,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const result = await chords.insertOne(doc);
    return toPublicChord({ ...doc, _id: result.insertedId });
  } catch (err) {
    // Concurrent save slipped past the pre-check; the unique index caught it.
    if (isDuplicateKeyError(err)) throw duplicateTitleError();
    throw err;
  }
}

/**
 * Reorder chords within a section from a full ordered list of ids. All ids must
 * belong to the user within that section and cover every chord exactly once;
 * positions are rewritten 0..n-1. Returns the chords in the new order.
 */
export async function reorderChords(
  env: Bindings,
  userId: string,
  sectionId: string,
  orderedIds: string[],
): Promise<Chord[]> {
  const section = await assertSectionOwned(env, userId, sectionId);
  const owner = new ObjectId(userId);
  const chords = await getChords(env);

  const existing = await chords.find({ userId: owner, sectionId: section }).toArray();
  const existingIds = new Set(existing.map((d) => d._id.toHexString()));

  if (
    orderedIds.length !== existing.length ||
    new Set(orderedIds).size !== orderedIds.length ||
    !orderedIds.every((id) => existingIds.has(id))
  ) {
    throw new AppError(
      400,
      'invalid_reorder',
      'The reorder list must include each chord exactly once.',
    );
  }

  const now = new Date().toISOString();
  await chords.bulkWrite(
    orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: new ObjectId(id), userId: owner, sectionId: section },
        update: { $set: { position: index, updatedAt: now } },
      },
    })),
  );

  const docs = await chords
    .find({ userId: owner, sectionId: section })
    .sort({ position: 1 })
    .toArray();
  return docs.map(toPublicChord);
}

/**
 * Edit a chord's title, URL, and option rows (full editable state each save).
 * The chord must be owned by the user or a `404` is thrown; a duplicate title
 * within its section is rejected with a `409`, excluding the chord itself so
 * casing-only renames succeed (FR-014). `position`/`sectionId` are untouched.
 */
export async function updateChord(
  env: Bindings,
  userId: string,
  chordId: string,
  input: ChordInput,
): Promise<Chord> {
  const owner = new ObjectId(toValidUserId(userId));
  if (!ObjectId.isValid(chordId)) {
    throw new AppError(404, 'chord_not_found', 'That entry could not be found.');
  }
  const chords = await getChords(env);
  const id = new ObjectId(chordId);

  const current = await chords.findOne({ _id: id, userId: owner });
  if (!current) {
    throw new AppError(404, 'chord_not_found', 'That entry could not be found.');
  }

  const titleNormalized = normalizeTitle(input.title);
  await assertTitleAvailable(chords, owner, current.sectionId, titleNormalized, id);

  try {
    const doc = await chords.findOneAndUpdate(
      { _id: id, userId: owner },
      {
        $set: {
          title: input.title,
          titleNormalized,
          url: input.url,
          fields: input.fields,
          updatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' },
    );
    if (!doc) {
      throw new AppError(404, 'chord_not_found', 'That entry could not be found.');
    }
    return toPublicChord(doc);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw duplicateTitleError();
    throw err;
  }
}

/** Validate a user id string, throwing a generic 401-safe error otherwise. */
function toValidUserId(userId: string): string {
  if (!ObjectId.isValid(userId)) {
    throw new AppError(401, 'unauthenticated', 'You must sign in to access this resource.');
  }
  return userId;
}

/**
 * Delete a chord. The chord must be owned by the user or a `404` is thrown. The
 * remaining chords in the same section are compacted to positions 0..n-1.
 */
export async function deleteChord(env: Bindings, userId: string, chordId: string): Promise<void> {
  const owner = new ObjectId(toValidUserId(userId));
  if (!ObjectId.isValid(chordId)) {
    throw new AppError(404, 'chord_not_found', 'That entry could not be found.');
  }
  const chords = await getChords(env);
  const doc = await chords.findOneAndDelete({ _id: new ObjectId(chordId), userId: owner });
  if (!doc) {
    throw new AppError(404, 'chord_not_found', 'That entry could not be found.');
  }

  // Compact remaining positions within the same section.
  const remaining = await chords
    .find({ userId: owner, sectionId: doc.sectionId })
    .sort({ position: 1 })
    .toArray();
  const now = new Date().toISOString();
  if (remaining.length > 0) {
    await chords.bulkWrite(
      remaining.map((c, index) => ({
        updateOne: {
          filter: { _id: c._id },
          update: { $set: { position: index, updatedAt: now } },
        },
      })),
    );
  }
}
