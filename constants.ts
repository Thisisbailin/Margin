import { Document, DocumentType, Project } from './types';
import { buildDocumentFromTextSections, buildProjectIndexes } from './services/documentBuilder';

const ppCh1 = `Lorsque j’avais six ans j’ai vu, une fois, une magnifique image, dans un livre sur la Forêt Vierge qui s’appelait "Histoires Vécues". Ça représentait un serpent boa qui avalait un fauve. Voilà la copie du dessin.

J’ai montré mon chef-d’œuvre aux grandes personnes et je leur ai demandé si mon dessin leur faisait peur. Elles m’ont répondu : "Pourquoi un chapeau ferait-il peur ?" Mon dessin ne représentait pas un chapeau. Il représentait un serpent boa qui digérait un éléphant.`;

const articlePhilosophy = `The unexamined life is not worth living. This provocative claim by Socrates suggests that critical reflection is the engine of human meaning.

In our digital age, the "unexamined life" often takes the form of algorithmic passivity. We consume without contemplating; we react without reasoning. To reclaim our agency, we must return to the margin of our own thoughts, where the slow work of understanding begins.`;

export const MOCK_DOCUMENTS: Document[] = [
  buildDocumentFromTextSections({
    id: 'pp-fr',
    type: DocumentType.Book,
    title: 'Le Petit Prince',
    author: 'Antoine de Saint-Exupéry',
    language: 'French',
    sections: [{ title: 'Chapitre I', content: ppCh1 }]
  }),
  buildDocumentFromTextSections({
    id: 'socrates-essay',
    type: DocumentType.Article,
    title: 'The Margin of Thought',
    author: 'Dr. Julian Thorne',
    language: 'English',
    sections: [{ title: 'Essay Content', content: articlePhilosophy }]
  })
];

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
