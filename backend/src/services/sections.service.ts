import { ObjectId, type Collection, type WithId } from 'mongodb';
import type { Section } from '@vii-pass/shared';
import type { Bindings } from '../env';
import { getDb } from '../lib/mongo';
import { AppError } from '../middleware/error';

/**
 * Sections service backed by the `sections` collection. Sections are the
 * color-coded tabs of the credential vault; every document is owned by exactly
 * one user and every query is filtered by `userId` so a user can only ever see or
 * modify their own sections (FR-018).
 */

/** Internal section document stored in the `sections` collection. */
export interface SectionDoc {
  /** Owning user id. */
  userId: ObjectId;
  /** Display label (1–50 chars). Not unique per user. */
  name: string;
  /** Tab color as `#RRGGBB`. */
  color: string;
  /** Order within the user's sections (0-based). */
  position: number;
  /** `true` only for the auto-provisioned, non-deletable "Mine" section. */
  isDefault: boolean;
  /** ISO-8601 creation timestamp (immutable). */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

const COLLECTION = 'sections';
/** Name of the default section provisioned for every user. */
const DEFAULT_SECTION_NAME = 'Mine';
/** Fixed brand color for the default section. */
const DEFAULT_SECTION_COLOR = '#0b5cad';

let indexesEnsured: Promise<void> | undefined;

/** Resolve the typed `sections` collection, ensuring indexes once per isolate. */
async function getSections(env: Bindings): Promise<Collection<SectionDoc>> {
  const db = await getDb(env);
  const collection = db.collection<SectionDoc>(COLLECTION);
  if (!indexesEnsured) {
    indexesEnsured = collection.createIndex({ userId: 1, position: 1 }).then(() => undefined);
  }
  await indexesEnsured;
  return collection;
}

/** Project an internal document to its public, client-safe shape. */
function toPublicSection(doc: WithId<SectionDoc>): Section {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    color: doc.color,
    position: doc.position,
    isDefault: doc.isDefault,
  };
}

/** Parse a user id string into an ObjectId, or throw a generic 401-safe error. */
function toUserObjectId(userId: string): ObjectId {
  if (!ObjectId.isValid(userId)) {
    throw new AppError(401, 'unauthenticated', 'You must sign in to access this resource.');
  }
  return new ObjectId(userId);
}

/**
 * List a user's sections in order. If the user has none yet, the default "Mine"
 * section is lazily provisioned (position 0, non-deletable) and returned, so
 * every user always has at least one section (FR-002).
 */
export async function listSections(env: Bindings, userId: string): Promise<Section[]> {
  const sections = await getSections(env);
  const owner = toUserObjectId(userId);
  const docs = await sections.find({ userId: owner }).sort({ position: 1 }).toArray();
  if (docs.length > 0) {
    return docs.map(toPublicSection);
  }

  // Lazily provision the default "Mine" section for a first-time user.
  const now = new Date().toISOString();
  const doc: SectionDoc = {
    userId: owner,
    name: DEFAULT_SECTION_NAME,
    color: DEFAULT_SECTION_COLOR,
    position: 0,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
  const result = await sections.insertOne(doc);
  return [toPublicSection({ ...doc, _id: result.insertedId })];
}

/**
 * Create a new section for the user, appended after existing sections. The client
 * selects it after creation (FR-007).
 */
export async function createSection(
  env: Bindings,
  userId: string,
  input: { name: string; color: string },
): Promise<Section> {
  const sections = await getSections(env);
  const owner = toUserObjectId(userId);
  const count = await sections.countDocuments({ userId: owner });
  const now = new Date().toISOString();
  const doc: SectionDoc = {
    userId: owner,
    name: input.name,
    color: input.color,
    position: count,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  const result = await sections.insertOne(doc);
  return toPublicSection({ ...doc, _id: result.insertedId });
}

/**
 * Reorder a user's sections from a full ordered list of ids. All ids must belong
 * to the user and cover every section exactly once; positions are rewritten
 * 0..n-1. Returns the sections in the new order.
 */
export async function reorderSections(
  env: Bindings,
  userId: string,
  orderedIds: string[],
): Promise<Section[]> {
  const sections = await getSections(env);
  const owner = toUserObjectId(userId);

  const existing = await sections.find({ userId: owner }).toArray();
  const existingIds = new Set(existing.map((d) => d._id.toHexString()));

  if (
    orderedIds.length !== existing.length ||
    new Set(orderedIds).size !== orderedIds.length ||
    !orderedIds.every((id) => existingIds.has(id))
  ) {
    throw new AppError(
      400,
      'invalid_reorder',
      'The reorder list must include each section exactly once.',
    );
  }

  const now = new Date().toISOString();
  await sections.bulkWrite(
    orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: new ObjectId(id), userId: owner },
        update: { $set: { position: index, updatedAt: now } },
      },
    })),
  );

  const docs = await sections.find({ userId: owner }).sort({ position: 1 }).toArray();
  return docs.map(toPublicSection);
}

/**
 * Assert that a section exists and is owned by the user, returning its ObjectId.
 * Throws a `404` {@link AppError} otherwise so callers never leak another user's
 * data or the existence of foreign sections.
 */
export async function assertSectionOwned(
  env: Bindings,
  userId: string,
  sectionId: string,
): Promise<ObjectId> {
  const owner = toUserObjectId(userId);
  if (!ObjectId.isValid(sectionId)) {
    throw new AppError(404, 'section_not_found', 'That section could not be found.');
  }
  const sections = await getSections(env);
  const section = new ObjectId(sectionId);
  const doc = await sections.findOne({ _id: section, userId: owner });
  if (!doc) {
    throw new AppError(404, 'section_not_found', 'That section could not be found.');
  }
  return section;
}

/**
 * Update a section's name and color (US2 edit). The section must be owned by the
 * user or a `404` is thrown. The default "Mine" section can be renamed/recolored.
 */
export async function updateSection(
  env: Bindings,
  userId: string,
  sectionId: string,
  input: { name: string; color: string },
): Promise<Section> {
  const owner = toUserObjectId(userId);
  if (!ObjectId.isValid(sectionId)) {
    throw new AppError(404, 'section_not_found', 'That section could not be found.');
  }
  const sections = await getSections(env);
  const doc = await sections.findOneAndUpdate(
    { _id: new ObjectId(sectionId), userId: owner },
    { $set: { name: input.name, color: input.color, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  if (!doc) {
    throw new AppError(404, 'section_not_found', 'That section could not be found.');
  }
  return toPublicSection(doc);
}

/**
 * Delete a section and every chord it contains (cascade). The section must be
 * owned by the user (`404` otherwise) and MUST NOT be the default "Mine" section
 * (`400`), so a user is never left with zero sections. After deletion the
 * remaining sections' positions are compacted to 0..n-1.
 */
export async function deleteSection(
  env: Bindings,
  userId: string,
  sectionId: string,
): Promise<void> {
  const owner = toUserObjectId(userId);
  if (!ObjectId.isValid(sectionId)) {
    throw new AppError(404, 'section_not_found', 'That section could not be found.');
  }
  const sections = await getSections(env);
  const section = new ObjectId(sectionId);
  const doc = await sections.findOne({ _id: section, userId: owner });
  if (!doc) {
    throw new AppError(404, 'section_not_found', 'That section could not be found.');
  }
  if (doc.isDefault) {
    throw new AppError(
      400,
      'default_section_undeletable',
      'The default section cannot be deleted.',
    );
  }

  // Cascade: remove the section's chords first, then the section itself.
  const db = await getDb(env);
  await db.collection('chords').deleteMany({ userId: owner, sectionId: section });
  await sections.deleteOne({ _id: section, userId: owner });

  // Compact remaining positions to 0..n-1 for a stable order.
  const remaining = await sections.find({ userId: owner }).sort({ position: 1 }).toArray();
  const now = new Date().toISOString();
  if (remaining.length > 0) {
    await sections.bulkWrite(
      remaining.map((s, index) => ({
        updateOne: {
          filter: { _id: s._id },
          update: { $set: { position: index, updatedAt: now } },
        },
      })),
    );
  }
}
