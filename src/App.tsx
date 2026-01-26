import React, { useEffect, useRef, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { QuizCard } from './components/QuizCard'; // <-- Đảm bảo import đúng

/* =======================
   1. Types & Helpers
======================= */
interface RawVocabulary {
  word: string;
  type: string;
  topic: string;
  options: string[];
  answer: string;
  example: string;
}
type Vocabulary = Omit<RawVocabulary, 'topic'>
type Step = 'setup' | 'testing';
interface SheetCell { v: string | number | null }
interface SheetRow { c: (SheetCell | null)[] }
interface SheetJson { table: { rows: SheetRow[] } }

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1NdwXWfig1nRRvAcrt6IHwYrjMuLvAcxRIPzeLMxOn9Q/gviz/tq?tqx=out:json';

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const formatTime = (sec: number): string =>
  `${Math.floor(sec / 60)}:${sec % 60 < 10 ? '0' : ''}${sec % 60}`;

/* =======================
   2. Main Component
======================= */
export default function App() {
  const [step, setStep] = useState<Step>('setup');
  const [numQuestions, setNumQuestions] = useState<string>('10');
  const [rawData, setRawData] = useState<RawVocabulary[]>([]);
  const [questions, setQuestions] = useState<Vocabulary[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState('all');

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    fetch(SHEET_URL)
      .then((res) => res.text())
      .then((text) => {
        const json = JSON.parse(text.substring(47).slice(0, -2)) as SheetJson;
        const parsed: RawVocabulary[] = json.table.rows.map((r) => {
          const answer = String(r.c[3]?.v ?? '');
          return {
            word: String(r.c[0]?.v ?? ''),
            type: String(r.c[2]?.v ?? ''),
            answer,
            topic: String(r.c[8]?.v ?? ''),
            example: String(r.c[4]?.v ?? ''),
            options: [answer, r.c[5]?.v, r.c[6]?.v, r.c[7]?.v].filter((v): v is string => !!v),
          };
        }).filter(q => q.word && q.answer);
        setRawData(parsed);
      });
  }, []);

  useEffect(() => {
    if (step === 'testing' && !isSubmitted) {
      timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step, isSubmitted]);

  const topics = useMemo(() => {
    const counts: Record<string, number> = {};
    rawData.forEach(d => { if (d.topic) counts[d.topic] = (counts[d.topic] || 0) + 1; });
    return counts;
  }, [rawData]);

  const result = useMemo(() => {
    const correctCount = questions.filter((q, i) => userAnswers[i] === q.answer).length;
    const total = questions.length;
    const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return { correctCount, total, percent };
  }, [isSubmitted, questions, userAnswers]);

  const triggerCelebration = (percent: number) => {
    if (percent >= 90) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: ReturnType<typeof setInterval> = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    } 
    else if (percent >= 80) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6, x: 0 }, zIndex: 100 });
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6, x: 1 }, zIndex: 100 });
    }
  };

  const submitQuiz = () => {
    setIsSubmitted(true);
    setShowConfirm(false);
    triggerCelebration(result.percent);
  };

  const handleContinueTesting = () => {
    setShowConfirm(false);
    for (let i = 0; i < questions.length; i++) {
      if (!userAnswers[i]) {
        const element = document.getElementById(`question-${i}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      }
    }
  };

  const handlePreSubmit = () => {
    if (Object.keys(userAnswers).length < questions.length) setShowConfirm(true);
    else submitQuiz();
  };

  const startNewTest = () => {
    const filtered = selectedTopic === 'all' ? rawData : rawData.filter(q => q.topic === selectedTopic);
    const n = Math.min(Number(numQuestions) || 10, filtered.length);
    const selected = shuffleArray(filtered).slice(0, n);
    setQuestions(selected.map(q => ({ ...q, options: shuffleArray([...q.options]) })));
    setUserAnswers({}); setSeconds(0); setIsSubmitted(false); setShowConfirm(false);
    setStep('testing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retryWrongQuestions = () => {
    const wrong = questions.filter((q, i) => userAnswers[i] !== q.answer);
    if (wrong.length === 0) return;
    setQuestions(wrong.map(q => ({ ...q, options: shuffleArray([...q.options]) })));
    setUserAnswers({}); setSeconds(0); setIsSubmitted(false); setShowConfirm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (step === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 animate-in fade-in zoom-in-95 duration-500 font-sans">
        <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl space-y-8 border border-white">
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black text-blue-600 tracking-tighter italic">CASQUIZ!</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cố lên cố lên, sắp tới rồi</p>
          </div>
          <div className="space-y-4">
            <input type="number" value={numQuestions} onChange={e => setNumQuestions(e.target.value)} className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold text-lg" placeholder="Số câu" />
            <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none cursor-pointer">
              <option value="all">Tất cả chủ đề</option>
              {Object.entries(topics).map(([name, count]) => (<option key={name} value={name}>{name} ({count})</option>))}
            </select>
          </div>
          <button onClick={startNewTest} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all">START</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-72 animate-in fade-in duration-500 font-sans">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white/70 backdrop-blur-xl border-b z-30 p-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="text-blue-600 font-black text-xl flex items-center gap-2">⏱ {formatTime(seconds)}</div>
          <div className="bg-slate-100 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400">
            {Object.keys(userAnswers).length} / {questions.length} DONE
          </div>
        </div>
      </div>

      {/* Quiz List */}
      <div className="max-w-2xl mx-auto p-4 space-y-6 mt-4">
        {questions.map((q, i) => (
          <div 
            key={i} 
            id={`question-${i}`} 
            className="animate-in slide-in-from-bottom-10 duration-700 fill-mode-both" 
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <QuizCard
              question={q}
              index={i}
              userAnswer={userAnswers[i]}
              isSubmitted={isSubmitted}
              onSelect={(val) => setUserAnswers(p => ({ ...p, [i]: val }))}
            />
          </div>
        ))}
      </div>

      {/* Fixed Bottom Control */}
      <div className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t p-6 z-40 shadow-2xl">
        <div className="max-w-2xl mx-auto">
          {!isSubmitted ? (
            <button onClick={handlePreSubmit} className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black text-xl shadow-xl shadow-green-100 active:scale-95 transition-all">NỘP BÀI</button>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-500">
              <div className="bg-blue-600 rounded-[2.5rem] p-8 flex justify-between items-center text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[10px] font-black opacity-60 tracking-widest uppercase mb-1">Score</p>
                  <div className="text-4xl font-black italic">{result.correctCount}/{result.total} <span className="text-xs opacity-50 font-bold">({result.percent}%)</span></div>
                </div>
                <div className="text-right relative z-10">
                  <p className="text-[10px] font-black opacity-60 tracking-widest uppercase mb-1">Time spent</p>
                  <div className="text-4xl font-black italic">{formatTime(seconds)}</div>
                </div>
                <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              </div>
              <div className="flex gap-4">
                <button onClick={retryWrongQuestions} className="flex-1 bg-orange-500 text-white py-5 rounded-2xl font-black shadow-lg active:scale-95 transition-all">LÀM LẠI CÂU SAI</button>
                <button onClick={startNewTest} className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black shadow-lg active:scale-95 transition-all">BÀI MỚI</button>
              </div>
              <button onClick={() => setStep('setup')} className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest text-center hover:text-slate-600 py-2">← Back to Settings</button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl animate-in zoom-in-90 duration-300 text-center">
            <div className="text-5xl mb-4 text-orange-400">⚠️</div>
            <h2 className="text-3xl font-black mb-4 tracking-tight text-slate-800 uppercase">Chưa xong!</h2>
            <p className="text-slate-500 mb-10 font-medium">Bạn còn <span className="text-orange-500 font-bold underline underline-offset-4 decoration-2">{questions.length - Object.keys(userAnswers).length} câu</span> trống. Học hành cho cẩn thận!</p>
            <div className="space-y-4">
              <button onClick={handleContinueTesting} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 active:scale-95 transition-all">LÀM TIẾP</button>
              <button onClick={submitQuiz} className="w-full text-slate-400 font-bold hover:text-red-500 transition-colors uppercase text-[10px] tracking-widest">Cứ nộp đi</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        .animate-bounce-short { animation: bounce 0.6s ease-in-out 0s 1; }
      `}</style>
    </div>
  );
}