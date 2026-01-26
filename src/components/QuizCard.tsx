import type { Vocabulary } from '../types/vocabulary';

interface QuizCardProps {
  question: Vocabulary;
  index: number;
  userAnswer?: string;
  isSubmitted: boolean;
  onSelect: (val: string) => void;
}

export const QuizCard = ({ question, index, userAnswer, isSubmitted, onSelect }: QuizCardProps) => {
  const speak = (word: string) => {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
  };

  const getStyle = (opt: string) => {
    const isSelected = userAnswer === opt;
    if (!isSubmitted) {
      return isSelected 
        ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-sm' 
        : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50';
    }
    
    // Sau khi nộp bài
    if (opt === question.answer) {
      return 'border-green-500 bg-green-500 text-white animate-bounce-short';
    }
    if (isSelected) {
      return 'border-red-500 bg-red-500 text-white animate-shake';
    }
    return 'border-slate-50 opacity-40 scale-95';
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 transition-all hover:shadow-md">
      <h3 className="text-xl font-black mb-6 flex items-start gap-4 text-slate-800">
        <span className="bg-blue-600 text-white w-8 h-8 flex items-center justify-center rounded-xl text-xs shrink-0 shadow-lg shadow-blue-100">
          {index + 1}
        </span>
        Nghĩa của từ "{question.word}"?
      </h3>

      <div className="grid gap-3">
        {question.options.map((opt) => (
          <button
            key={opt}
            disabled={isSubmitted}
            onClick={() => onSelect(opt)}
            className={`w-full p-5 text-left border-2 rounded-2xl font-bold transition-all duration-300 ${getStyle(opt)}`}
          >
            {opt}
          </button>
        ))}
      </div>

      {isSubmitted && (
        <div className="mt-6 p-6 bg-slate-50 rounded-[1.5rem] border border-slate-200 animate-in zoom-in-95 duration-500 text-sm italic text-slate-600">
          <div className="flex items-center gap-3 mb-3 font-black text-slate-800 not-italic">
            <button 
              onClick={() => speak(question.word)} 
              className="w-10 h-10 flex items-center justify-center bg-white border rounded-full shadow-sm hover:scale-110 active:scale-90 transition-all"
            >
              🔊
            </button> 
            <span className="text-lg underline decoration-blue-200 underline-offset-4">{question.word}</span>
            <span className="text-slate-400 font-bold italic text-xs">({question.type})</span>
          </div>
          <p className="leading-relaxed">" {question.example} "</p>
        </div>
      )}
    </div>
  );
};