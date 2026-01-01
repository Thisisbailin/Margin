
import { Book, Familiarity, Project, Sentence, WordOccurrence, Paragraph, Chapter } from './types';

const parseChapterContent = (text: string, bookId: string, chIdx: number): Paragraph[] => {
  const blocks = text.split(/\n\s*\n/);
  return blocks.map((block, pIdx) => {
    const rawSentences = block.match(/[^.!?]+[.!?]*/g) || [block];
    const sentences: Sentence[] = rawSentences.map((s, sIdx) => {
      const words = s.trim().split(/\s+/);
      const tokens: WordOccurrence[] = words.map((w, wIdx) => {
        const cleanLemma = w.replace(/[.,!?;:«»"()]/g, '').toLowerCase();
        // Updated to match WordOccurrence interface: removed invalid familiarity and added masteryScore
        return {
          id: `${bookId}-c${chIdx}-p${pIdx}-s${sIdx}-w${wIdx}`,
          text: w,
          lemma: cleanLemma,
          pos: 'unknown',
          masteryScore: Math.random() > 0.9 ? 0.1 : 0.9,
        };
      });
      return { id: `${bookId}-c${chIdx}-p${pIdx}-s${sIdx}`, text: s.trim(), tokens };
    });
    // 简单逻辑：如果包含引号通常标记为对话或散文
    const type = block.includes('"') || block.includes('«') ? 'dialogue' : 'prose';
    return { id: `${bookId}-c${chIdx}-p${pIdx}`, type, sentences };
  });
};

const ppCh1 = `Lorsque j’avais six ans j’ai vu, une fois, une magnifique image, dans un livre sur la Forêt Vierge qui s’appelait "Histoires Vécues". Ça représentait un serpent boa qui avalait un fauve. Voilà la copie du dessin.

J’ai montré mon chef-d’œuvre aux grandes personnes et je leur ai demandé si mon dessin leur faisait peur. Elles m’ont répondu : "Pourquoi un chapeau ferait-il peur ?" Mon dessin ne représentait pas un chapeau. Il représentait un serpent boa qui digérait un éléphant.`;

const ppCh2 = `J’ai ainsi vécu seul, sans personne avec qui parler véritablement, jusqu’à une panne dans le désert du Sahara, il y a six ans. Quelque chose s’était cassé dans mon moteur.

Le premier soir je me suis donc endormi sur le sable à mille milles de toute terre habitée. J’étais bien plus isolé qu’un naufragé sur un radeau au milieu de l’océan. Alors vous imaginez ma surprise, au lever du jour, quand une drôle de petite voice m’a réveillé. Elle disait : "S’il vous plaît… dessine-moi un mouton !"`;

const rilkeS1 = `Da stieg ein Baum. O reine Übersteigung!
O Orpheus singt! O hoher Baum im Ohr!
Und alles schwieg. Doch selbst in der Verschweigung
ging neuer Anfang, Wink und Wandlung vor.`;

const rilkeS2 = `Und fast ein Mädchen wars und ging hervor
aus diesem einigen Glück von Sang und Saiten
und glänzte klar durch ihre Frühlingsschleier
und machte sich ein Bett in meinem Ohr.`;

export const MOCK_BOOKS: Book[] = [
  {
    id: 'pp-fr',
    title: 'Le Petit Prince',
    author: 'Antoine de Saint-Exupéry',
    language: 'French',
    progress: 15,
    chapters: [
      { id: 'pp-c1', number: 1, title: 'Chapitre I', subtitle: 'Le boa et l’éléphant', content: parseChapterContent(ppCh1, 'pp', 1) },
      { id: 'pp-c2', number: 2, title: 'Chapitre II', subtitle: 'Le mouton au désert', content: parseChapterContent(ppCh2, 'pp', 2) }
    ]
  },
  {
    id: 'rilke-de',
    title: 'Die Sonette an Orpheus',
    author: 'Rainer Maria Rilke',
    language: 'German',
    progress: 8,
    chapters: [
      { id: 'rilke-c1', number: 1, title: 'Sonett I', content: parseChapterContent(rilkeS1, 'rilke', 1).map(p => ({...p, type: 'poetry'})) },
      { id: 'rilke-c2', number: 2, title: 'Sonett II', content: parseChapterContent(rilkeS2, 'rilke', 2).map(p => ({...p, type: 'poetry'})) }
    ]
  }
];

export const MOCK_PROJECT: Project = {
  id: 'p1',
  name: 'European Literature & Existentialism',
  description: 'A study of innocence and poetic transformation.',
  books: MOCK_BOOKS,
  vocabularyStats: {}
};
