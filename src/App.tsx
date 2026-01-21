import React, { useEffect, useRef, useState } from 'react';

/* =======================
   Types
======================= */
type RawVocabulary = {
  word: string;
  type: string;
  topic: string;
  options: string[];
  answer: string;
  example: string;
};

type Vocabulary = {
  word: string;
  options: string[];
  answer: string;
  type: string;
  example: string;
};

type Step = 'setup' | 'testing';

/* =======================
   Google Sheet
======================= */
const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1NdwXWfig1nRRvAcrt6IHwYrjMuLvAcxRIPzeLMxOn9Q/gviz/tq?tqx=out:json';

type SheetCell = { v?: string };
type SheetRow = { c: (SheetCell | null)[] };

const parseGoogleSheet = (text: string): RawVocabulary[] => {
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows: SheetRow[] = json.table.rows;

  return rows
    .map((r) => {
      const word = r.c[0]?.v ?? '';
      const type = r.c[2]?.v ?? '';
      const answer = r.c[3]?.v ?? '';
      const topic = r.c[8]?.v ?? '';
      const example = r.c[4]?.v ?? '';

      const options = [
        answer,
        r.c[5]?.v,
        r.c[6]?.v,
        r.c[7]?.v,
      ].filter((v): v is string => Boolean(v));

      return { word, type, topic, answer, options, example };
    })
    .filter((q) => q.word && q.answer && q.options.length >= 2);
};

/* =======================
   Component
======================= */
export default function App() {
  const [step, setStep] = useState<Step>('setup');
  const [numQuestions, setNumQuestions] = useState<string>('10');
  const [rawData, setRawData] = useState<RawVocabulary[]>([]);
  const [questions, setQuestions] = useState<Vocabulary[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState('all');

  const timerRef = useRef<number | null>(null);

  /* =======================
     Fetch Sheet
  ======================= */
  useEffect(() => {
    fetch(SHEET_URL)
      .then((res) => res.text())
      .then((text) => setRawData(parseGoogleSheet(text)))
      .catch(console.error);
  }, []);

  /* =======================
     Timer
  ======================= */
  useEffect(() => {
    if (step === 'testing' && !isSubmitted) {
      timerRef.current = window.setInterval(
        () => setSeconds((s) => s + 1),
        1000
      );
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, isSubmitted]);

  const formatTime = (sec: number) =>
    `${Math.floor(sec / 60)}:${sec % 60 < 10 ? '0' : ''}${sec % 60}`;

  /* =======================
     Derived data
  ======================= */
  const topics = Array.from(new Set(rawData.map((d) => d.topic))).filter(
    Boolean
  );

  const topicCount = (topic: string) =>
    rawData.filter((q) => q.topic === topic).length;

  /* =======================
     Logic
  ======================= */
  const startNewTest = () => {
    const n = Number(numQuestions);
    if (!Number.isInteger(n) || n <= 0) {
      alert('Số câu phải là số nguyên > 0');
      return;
    }

    let filtered = [...rawData];
    if (selectedTopic !== 'all')
      filtered = filtered.filter((q) => q.topic === selectedTopic);

    const shuffled = filtered.sort(() => Math.random() - 0.5);

    setQuestions(
      shuffled.slice(0, n).map((q) => ({
        word: q.word,
        answer: q.answer,
        type: q.type,
        example: q.example,
        options: [...q.options].sort(() => Math.random() - 0.5),
      }))
    );

    setUserAnswers({});
    setSeconds(0);
    setIsSubmitted(false);
    setStep('testing');
  };

  const retryWrongQuestions = () => {
    const wrong = questions.filter(
      (q, i) => userAnswers[i] !== q.answer
    );

    if (wrong.length === 0) {
      alert('Không có câu sai 🎉');
      return;
    }

    setQuestions(
      wrong.map((q) => ({
        ...q,
        options: [...q.options].sort(() => Math.random() - 0.5),
      }))
    );

    setUserAnswers({});
    setSeconds(0);
    setIsSubmitted(false);
  };

  const score = questions.filter(
    (q, i) => userAnswers[i] === q.answer
  ).length;

  const speak = (word: string) => {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    speechSynthesis.speak(u);
  };

  const getOptionStyle = (i: number, opt: string) => {
    const selected = userAnswers[i] === opt;

    if (!isSubmitted)
      return selected
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-200 hover:border-blue-300';

    if (opt === questions[i].answer)
      return 'border-green-600 bg-green-500 text-white';
    if (selected)
      return 'border-red-600 bg-red-500 text-white';

    return 'border-gray-100 bg-gray-50 text-gray-400';
  };

  /* =======================
     Setup Screen
  ======================= */
  if (step === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md space-y-4">
          <h1 className="text-4xl font-black text-center">Vocabs Quiz</h1>
          <h3 className="text-center">Liệu mà học đi</h3>
          <input
            value={numQuestions}
            onChange={(e) => setNumQuestions(e.target.value)}
            placeholder="Số câu hỏi"
            className="w-full p-3 border rounded-xl text-center font-bold"
          />

          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full p-3 border rounded-xl"
          >
            <option value="all">Tất cả topic</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t} ({topicCount(t)})
              </option>
            ))}
          </select>

          <button
            onClick={startNewTest}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold"
          >
            BẮT ĐẦU HỌC
          </button>
        </div>
      </div>
    );
  }

  /* =======================
     Test Screen
  ======================= */
  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      <div className="sticky top-0 bg-white p-4 flex justify-between">
        <div>⏱ {formatTime(seconds)}</div>
        <div>
          {Object.keys(userAnswers).length}/{questions.length}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {questions.map((q, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl">
            <h3 className="font-bold mb-4">
              Nghĩa của từ "{q.word}"?
            </h3>

            {q.options.map((opt) => (
              <button
                key={opt}
                onClick={() =>
                  !isSubmitted &&
                  setUserAnswers((p) => ({ ...p, [i]: opt }))
                }
                className={`w-full p-4 mb-2 border-2 rounded-xl ${getOptionStyle(
                  i,
                  opt
                )}`}
              >
                {opt}
              </button>
            ))}

            {isSubmitted && (
              <div className="mt-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <button onClick={() => speak(q.word)}>🔊</button>
                  <span className="font-bold">{q.word}</span>
                </div>
                <div>Type: {q.type}</div>
                <div>Example: {q.example}</div>
                {/* Example: cần thêm cột example trong Google Sheet */}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 w-full bg-white p-4 border-t">
        {!isSubmitted ? (
          <button
            onClick={() => setIsSubmitted(true)}
            className="w-[33%] mx-auto block bg-green-600 text-white py-4 rounded-2xl font-bold"
          >
            NỘP BÀI
          </button>
        ) : (
          <div className="space-y-2 text-center">
            <div className="text-2xl font-black">
              {score}/{questions.length} ⏱ {formatTime(seconds)}
            </div>

            <button
              onClick={retryWrongQuestions}
              className="w-[33%] mx-auto block bg-orange-500 text-white py-3 rounded-xl font-bold"
            >
              LÀM LẠI CÂU SAI
            </button>

            <button
              onClick={() => setStep('setup')}
              className="w-[33%] mx-auto block bg-slate-200 py-3 rounded-xl font-bold"
            >
              LÀM BÀI MỚI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
