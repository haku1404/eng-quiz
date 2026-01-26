interface SetupProps {
  numQuestions: string;
  setNumQuestions: (v: string) => void;
  selectedTopic: string;
  setSelectedTopic: (v: string) => void;
  topics: Record<string, number>;
  onStart: () => void;
}

export const SetupScreen = ({ numQuestions, setNumQuestions, selectedTopic, setSelectedTopic, topics, onStart }: SetupProps) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-xl space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-black text-blue-600">Vocabs Quiz</h1>
        <p className="text-slate-500 mt-2">Học đi chờ chi!</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm font-bold text-slate-700 ml-1">Số câu hỏi</label>
          <input
            type="number"
            value={numQuestions}
            onChange={(e) => setNumQuestions(e.target.value)}
            className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-lg"
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700 ml-1">Chủ đề</label>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none transition-all appearance-none"
          >
            <option value="all">Tất cả topic</option>
            {Object.entries(topics).map(([name, count]) => (
              <option key={name} value={name}>{name} ({count})</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-bold shadow-lg shadow-blue-200 transition-transform active:scale-95"
      >
        BẮT ĐẦU HỌC
      </button>
    </div>
  </div>
);