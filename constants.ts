import { Document, Project } from './types';
import { buildProjectIndexes } from './services/documentBuilder';

export const MOCK_DOCUMENTS: Document[] = [];

const { occurrenceIndex, lexemeIndex, interactionLog } = buildProjectIndexes(MOCK_DOCUMENTS);

export const MOCK_PROJECT: Project = {
  id: 'p1',
  name: 'Existential Inquiries',
  description: 'A cross-disciplinary study of meaning, from literature to modern philosophy.',
  documents: MOCK_DOCUMENTS,
  occurrenceIndex,
  lexemeIndex,
  interactionLog
};
