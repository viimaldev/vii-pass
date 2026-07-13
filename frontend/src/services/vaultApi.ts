import type {
  Chord,
  ChordResponse,
  ChordsResponse,
  CreateChordRequest,
  CreateSectionRequest,
  Section,
  SectionResponse,
  SectionsResponse,
  UpdateChordRequest,
} from '@vii-pass/shared';
import { del, get, patch, post } from './apiClient';

/**
 * Typed client for the credential vault (sections + chords). Thin wrappers over
 * the shared get/post/patch helpers (which send the session cookie and surface
 * typed errors). All calls target the session-protected `/api/sections` and
 * `/api/chords` routes.
 *
 * Encryption (specs/010-credential-encryption): chord `url` and
 * `fields[].value` are `EncryptedValue | null` Level-1 envelopes on the wire.
 * This module is transport-only — encryption/decryption happens exclusively in
 * `vault/VaultContext.tsx`; no plaintext secret ever passes through here.
 */

/** List the user's sections (auto-provisions "Mine" on first use). */
export async function listSections(): Promise<Section[]> {
  const { sections } = await get<SectionsResponse>('/api/sections');
  return sections;
}

/** Create a section; the caller selects it after creation. */
export async function createSection(input: CreateSectionRequest): Promise<Section> {
  const { section } = await post<SectionResponse>('/api/sections', input);
  return section;
}

/** Reorder the user's sections from a full ordered id list. */
export async function reorderSections(orderedIds: string[]): Promise<Section[]> {
  const { sections } = await post<SectionsResponse>('/api/sections/reorder', { orderedIds });
  return sections;
}

/** Rename/recolor a section. */
export async function updateSection(
  sectionId: string,
  input: CreateSectionRequest,
): Promise<Section> {
  const { section } = await patch<SectionResponse>(`/api/sections/${sectionId}`, input);
  return section;
}

/** Delete a section and all of its chords (cascade). */
export async function deleteSection(sectionId: string): Promise<void> {
  await del(`/api/sections/${sectionId}`);
}

/** List a section's chords in order. */
export async function listChords(sectionId: string): Promise<Chord[]> {
  const { chords } = await get<ChordsResponse>(`/api/sections/${sectionId}/chords`);
  return chords;
}

/** Add a chord to a section. */
export async function createChord(
  sectionId: string,
  input: CreateChordRequest,
): Promise<Chord> {
  const { chord } = await post<ChordResponse>(`/api/sections/${sectionId}/chords`, input);
  return chord;
}

/** Reorder chords within a section from a full ordered id list. */
export async function reorderChords(sectionId: string, orderedIds: string[]): Promise<Chord[]> {
  const { chords } = await post<ChordsResponse>(`/api/sections/${sectionId}/chords/reorder`, {
    orderedIds,
  });
  return chords;
}

/** Edit a chord's title, URL, and option rows. */
export async function updateChord(chordId: string, input: UpdateChordRequest): Promise<Chord> {
  const { chord } = await patch<ChordResponse>(`/api/chords/${chordId}`, input);
  return chord;
}

/** Delete a chord. */
export async function deleteChord(chordId: string): Promise<void> {
  await del(`/api/chords/${chordId}`);
}
