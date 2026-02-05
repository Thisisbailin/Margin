import type { SyncAdapter, SyncSnapshot } from './types';
import { fetchProjectMeta, fetchProjectSnapshot, upsertDocumentSnapshot, upsertProjectSnapshot } from '../supabaseService';
import { buildProjectIndexes } from '../documentBuilder';
import type { Project } from '../../types';

const buildProjectFromSnapshot = (snapshot: NonNullable<Awaited<ReturnType<typeof fetchProjectSnapshot>>>): Project => {
  const { project, documents } = snapshot;
  const { occurrenceIndex, lexemeIndex, interactionLog } = buildProjectIndexes(
    documents,
    project.lexeme_index || undefined,
    project.interaction_log || undefined
  );

  return {
    id: project.id,
    name: project.name || 'Margin Project',
    description: project.description || '',
    documents,
    occurrenceIndex,
    lexemeIndex,
    interactionLog
  };
};

export const supabaseSyncAdapter: SyncAdapter = {
  name: 'supabase',
  peek: async (token: string) => {
    const meta = await fetchProjectMeta(token);
    if (!meta) return null;
    return {
      projectId: meta.id,
      remoteUpdatedAt: meta.updated_at || undefined
    };
  },
  pull: async (token: string) => {
    const snapshot = await fetchProjectSnapshot(token);
    if (!snapshot) return null;

    const project = buildProjectFromSnapshot(snapshot);
    return {
      project,
      documents: project.documents,
      activeDocumentId: snapshot.project.active_document_id || undefined,
      remoteUpdatedAt: snapshot.project.updated_at || undefined
    };
  },
  push: async (snapshot: SyncSnapshot, token: string) => {
    const { project, documents, activeDocumentId } = snapshot;
    const storedProject = await upsertProjectSnapshot(project, token, activeDocumentId);
    if (!storedProject) {
      throw new Error('PROJECT_SYNC_FAILED');
    }
    const documentResults = await Promise.all(
      documents.map((doc) => upsertDocumentSnapshot(doc, project.id, token))
    );
    if (documentResults.some((ok) => !ok)) {
      throw new Error('DOCUMENT_SYNC_FAILED');
    }

    return {
      remoteUpdatedAt: storedProject?.updated_at || undefined
    };
  }
};
