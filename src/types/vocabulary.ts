export type RawVocabulary = {
  word: string;
  type: string;
  topic: string;
  options: string[];
  answer: string;
  example: string;
};

export type Vocabulary = Omit<RawVocabulary, 'topic'>;
export type Step = 'setup' | 'testing';