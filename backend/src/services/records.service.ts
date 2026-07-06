import { ObjectId, type Collection, type Db, type Filter } from 'mongodb';
import type { RecordListResponse, StoredRecord } from '@vii-pass/shared';
import type { Bindings } from '../env';
import type { CreateRecordInput } from '../schemas/record.schema';
import { getDb } from '../lib/mongo';
import { AppError } from '../middleware/error';

/**
 * Records persistence against MongoDB Atlas (US2, data-model `StoredRecord`).
 *
 * Documents are keyed by Mongo's native `ObjectId`; the string `id` returned to
 * clients is its hex representation. Listing uses keyset (cursor) pagination on
 * `_id` for stable, index-friendly paging.
 */

/** Internal MongoDB document shape (server-only). */
interface RecordDoc {
  _id: ObjectId;
  title: string;
  content?: string;
  fileKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

const COLLECTION = 'records';

async function getCollection(env: Bindings): Promise<Collection<RecordDoc>> {
  const db: Db = await getDb(env);
  return db.collection<RecordDoc>(COLLECTION);
}

/** Map an internal document to the public {@link StoredRecord} contract. */
function toStoredRecord(doc: RecordDoc): StoredRecord {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    content: doc.content,
    fileKey: doc.fileKey ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Insert a new record and return its public representation. */
export async function createRecord(env: Bindings, input: CreateRecordInput): Promise<StoredRecord> {
  const now = new Date().toISOString();
  const doc: RecordDoc = {
    _id: new ObjectId(),
    title: input.title,
    content: input.content,
    fileKey: input.fileKey ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const collection = await getCollection(env);
  await collection.insertOne(doc);
  return toStoredRecord(doc);
}

/**
 * List records newest-first using an opaque `_id` cursor. Fetches `limit + 1`
 * documents to determine whether a further page exists.
 */
export async function listRecords(
  env: Bindings,
  limit: number,
  cursor?: string,
): Promise<RecordListResponse> {
  if (cursor && !ObjectId.isValid(cursor)) {
    throw new AppError(400, 'invalid_cursor', 'The provided cursor is invalid.');
  }
  const filter: Filter<RecordDoc> = cursor ? { _id: { $lt: new ObjectId(cursor) } } : {};

  const collection = await getCollection(env);
  const docs = await collection
    .find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? last._id.toHexString() : null;

  return { items: page.map(toStoredRecord), nextCursor };
}

/** Fetch a single record by its string id, or `null` if not found. */
export async function getRecordById(env: Bindings, id: string): Promise<StoredRecord | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const collection = await getCollection(env);
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return doc ? toStoredRecord(doc) : null;
}
