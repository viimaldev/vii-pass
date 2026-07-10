import { ObjectId, type Collection, type WithId } from 'mongodb';
import type { Chord } from '@vii-pass/shared';
import type { Bindings } from '../env';
import { getDb } from '../lib/mongo';
import { AppError } from '../middleware/error';
import { assertSectionOwned } from './sections.service';

/**
 * Chords service backed by the `chords` collection. A chord is a credential entry
 * tile belonging to exactly one section and one user. Every query is filtered by
 * `userId` (and usually `sectionId`) so a user only ever touches their own data
 * (FR-018). Fields are placeholders for now (`field1`/`field2`/`field3`).
 */

/** Internal chord document stored in the `chords` collection. */
export interface ChordDoc {
  /** Owning user id (redundant with the section's owner for safe scoping). */
  userId: ObjectId;
  /** Parent section id. */
  sectionId: ObjectId;
  /** Order within the section (0-based). */
  position: number;
  /** Placeholder field "1". */
  field1: string | null;
  /** Placeholder field "2". */
  field2: string | null;
  /** Placeholder field "3". */
  field3: string | null;
  /** ISO-8601 creation timestamp (immutable). */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

const COLLECTION = 'chords';
let indexesEnsured: Promise<void> | undefined;

/** Resolve the typed `chords` collection, ensuring indexes once per isolate. */
async function getChords(env: Bindings): Promise<Collection<ChordDoc>> {
  const db = await getDb(env);
  const collection = db.collection<ChordDoc>(COLLECTION);
  if (!indexesEnsured) {
    indexesEnsured = collection
      .createIndex({ userId: 1, sectionId: 1, position: 1 })
      .then(() => undefined);
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
    field1: doc.field1,
    field2: doc.field2,
    field3: doc.field3,
  };
}

/** Normalize an optional/nullable input field to a stored `string | null`. */
function normalizeField(value: string | null | undefined): string | null {
  return value === undefined ? null : value;
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
 * owned by the user or a `404` is thrown.
 */
export async function createChord(
  env: Bindings,
  userId: string,
  sectionId: string,
  input: { field1?: string | null; field2?: string | null; field3?: string | null },
): Promise<Chord> {
  const section = await assertSectionOwned(env, userId, sectionId);
  const owner = new ObjectId(userId);
  const chords = await getChords(env);
  const count = await chords.countDocuments({ userId: owner, sectionId: section });
  const now = new Date().toISOString();
  const doc: ChordDoc = {
    userId: owner,
    sectionId: section,
    position: count,
    field1: normalizeField(input.field1),
    field2: normalizeField(input.field2),
    field3: normalizeField(input.field3),
    createdAt: now,
    updatedAt: now,
  };
  const result = await chords.insertOne(doc);
  return toPublicChord({ ...doc, _id: result.insertedId });
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
 * Edit a chord's placeholder fields. The chord must be owned by the user or a
 * `404` is thrown. Only provided fields are changed.
 */
export async function updateChord(
  env: Bindings,
  userId: string,
  chordId: string,
  input: { field1?: string | null; field2?: string | null; field3?: string | null },
): Promise<Chord> {
  const owner = new ObjectId(toValidUserId(userId));
  if (!ObjectId.isValid(chordId)) {
    throw new AppError(404, 'chord_not_found', 'That entry could not be found.');
  }
  const chords = await getChords(env);
  const update: Partial<ChordDoc> = { updatedAt: new Date().toISOString() };
  if ('field1' in input) update.field1 = normalizeField(input.field1);
  if ('field2' in input) update.field2 = normalizeField(input.field2);
  if ('field3' in input) update.field3 = normalizeField(input.field3);

  const doc = await chords.findOneAndUpdate(
    { _id: new ObjectId(chordId), userId: owner },
    { $set: update },
    { returnDocument: 'after' },
  );
  if (!doc) {
    throw new AppError(404, 'chord_not_found', 'That entry could not be found.');
  }
  return toPublicChord(doc);
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
