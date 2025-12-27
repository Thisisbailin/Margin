import { Book, Familiarity, Project, Sentence, WordOccurrence } from './types';

// Helper to mock parsing text into our domain model
const parseTextToSentences = (text: string, startId: number): Sentence[] => {
  const rawSentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  return rawSentences.map((s, sIdx) => {
    const words = s.trim().split(/\s+/);
    const tokens: WordOccurrence[] = words.map((w, wIdx) => {
      const cleanWord = w.replace(/[.,!?;:"]/g, '');
      return {
        id: `s${startId + sIdx}-w${wIdx}`,
        text: w,
        lemma: cleanWord.toLowerCase(),
        pos: 'noun', // Mock POS
        familiarity: Math.random() > 0.85 ? Familiarity.Unknown : Familiarity.Mastered, // Mostly known for flow
        translation: 'Mock Translation'
      };
    });

    return {
      id: `s${startId + sIdx}`,
      text: s.trim(),
      tokens
    };
  });
};

const text1 = `In this economy, even spectators are transformed into workers. As Jonathan Beller argues, cinema and its derivatives (television, Internet, and so on) are factories, in which spectators work. Now, "to look is to labor." Cinema, which integrated the logic of Taylorist production and the conveyor belt, now spreads the factory wherever it travels. But this type of production is much more intensive than the industrial one. The senses are drafted into production, the media capitalize upon the aesthetic faculties and imaginary practices of viewers.`;

const text2 = `The work of art in the age of mechanical reproduction. Even the most perfect reproduction of a work of art is lacking in one element: its presence in time and space, its unique existence at the place where it happens to be. This unique existence of the work of art determined the history to which it was subject throughout the time of its existence.`;

const createBook = (id: string, title: string, author: string, text: string, progress: number): Book => ({
  id,
  title,
  author,
  progress,
  content: parseTextToSentences(text, parseInt(id) * 100)
});

export const MOCK_BOOKS: Book[] = [
  createBook('1', 'Is a Museum a Factory?', 'Hito Steyerl', text1, 15),
  createBook('2', 'Illuminations', 'Walter Benjamin', text2, 0),
  createBook('3', 'Ways of Seeing', 'John Berger', text1, 0), // Placeholder content
  createBook('4', 'Society of the Spectacle', 'Guy Debord', text1, 0),
];

export const MOCK_PROJECT: Project = {
  id: 'p1',
  name: 'Critical Theory & Visual Culture',
  description: 'Exploring the intersection of labor, aesthetics, and the institution.',
  books: MOCK_BOOKS,
  activeBookId: '1'
};
