import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { createRecordSchema, listRecordsQuerySchema } from '../schemas/record.schema';
import { parseJsonBody, parseQuery } from '../middleware/validate';
import { AppError } from '../middleware/error';
import { createRecord, getRecordById, listRecords } from '../services/records.service';

/**
 * Records router (US2): `POST /api/records`, `GET /api/records`,
 * `GET /api/records/:id`.
 *
 * Any failure originating from the data layer that is not an explicit
 * {@link AppError} is surfaced as `503 database_unavailable`, so transient
 * MongoDB outages produce a clear, actionable response rather than a generic 500
 * (FR-012).
 */
export const recordsRouter = new Hono<AppEnv>();

/** Run a data-layer operation, translating unexpected failures into a 503. */
async function runDbOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Records database operation failed:', error);
    throw new AppError(
      503,
      'database_unavailable',
      'The database is currently unavailable. Please try again later.',
    );
  }
}

recordsRouter.post('/', async (c) => {
  const input = await parseJsonBody(c, createRecordSchema);
  const record = await runDbOperation(() => createRecord(c.env, input));
  return c.json(record, 201);
});

recordsRouter.get('/', async (c) => {
  const query = parseQuery(c, listRecordsQuerySchema);
  const page = await runDbOperation(() => listRecords(c.env, query.limit, query.cursor));
  return c.json(page);
});

recordsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const record = await runDbOperation(() => getRecordById(c.env, id));
  if (!record) {
    throw new AppError(404, 'not_found', 'No record was found with that id.');
  }
  return c.json(record);
});
