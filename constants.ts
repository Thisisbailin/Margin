
import { Book, MaterialType, Project, Sentence, WordOccurrence, Paragraph } from './types';

const parseChapterContent = (text: string, materialId: string, chIdx: number): Paragraph[] => {
  const blocks = text.split(/\n\s*\n/);
  return blocks.map((block, pIdx) => {
    const rawSentences = block.match(/[^.!?]+[.!?]*/g) || [block];
    const sentences: Sentence[] = rawSentences.map((s, sIdx) => {
      const words = s.trim().split(/\s+/);
      const tokens: WordOccurrence[] = words.map((w, wIdx) => {
        const cleanLemma = w.replace(/[.,!?;:«»"()]/g, '').toLowerCase();
        return {
          id: `${materialId}-c${chIdx}-p${pIdx}-s${sIdx}-w${wIdx}`,
          text: w,
          lemma: cleanLemma,
          pos: 'unknown',
          masteryScore: Math.random() > 0.9 ? 0.1 : 0.9,
        };
      });
      return { id: `${materialId}-c${chIdx}-p${pIdx}-s${sIdx}`, text: s.trim(), tokens };
    });
    const type = block.includes('"') || block.includes('«') ? 'dialogue' : 'prose';
    return { id: `${materialId}-c${chIdx}-p${pIdx}`, type, sentences };
  });
};

const ppCh1 = `Lorsque j’avais six ans j’ai vu, une fois, une magnifique image, dans un livre sur la Forêt Vierge qui s’appelait "Histoires Vécues". Ça représentait un serpent boa qui avalait un fauve. Voilà la copie du dessin.

J’ai montré mon chef-d’œuvre aux grandes personnes et je leur ai demandé si mon dessin leur faisait peur. Elles m’ont répondu : "Pourquoi un chapeau ferait-il peur ?" Mon dessin ne représentait pas un chapeau. Il représentait un serpent boa qui digérait un éléphant.`;

const articlePhilosophy = `The unexamined life is not worth living. This provocative claim by Socrates suggests that critical reflection is the engine of human meaning. 

In our digital age, the "unexamined life" often takes the form of algorithmic passivity. We consume without contemplating; we react without reasoning. To reclaim our agency, we must return to the margin of our own thoughts, where the slow work of understanding begins.`;

export const MOCK_BOOKS: Book[] = [
  {
    id: 'pp-fr',
    type: MaterialType.Book,
    title: 'Le Petit Prince',
    author: 'Antoine de Saint-Exupéry',
    language: 'French',
    progress: 15,
    wordCount: 15000,
    readingTime: 120,
    chapters: [
      { id: 'pp-c1', number: 1, title: 'Chapitre I', subtitle: 'Le boa et l’éléphant', content: parseChapterContent(ppCh1, 'pp', 1) }
    ]
  },
  {
    id: 'socrates-essay',
    type: MaterialType.Article,
    title: 'The Margin of Thought',
    author: 'Dr. Julian Thorne',
    language: 'English',
    progress: 0,
    wordCount: 450,
    readingTime: 5,
    sourceUrl: 'https://philosophy-daily.com/margin-of-thought',
    chapters: [
      { id: 'essay-c1', number: 1, title: 'Essay Content', content: parseChapterContent(articlePhilosophy, 'essay', 1) }
    ]
  }
];

export const MOCK_PROJECT: Project = {
  id: 'p1',
  name: 'Existential Inquiries',
  description: 'A cross-disciplinary study of meaning, from literature to modern philosophy.',
  books: MOCK_BOOKS,
  vocabularyStats: {}
};
