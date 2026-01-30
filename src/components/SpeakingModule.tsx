import React, { useState, useEffect, useRef, useCallback } from "react";

/* =======================
   1. TypeScript Interfaces
======================= */
interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface EvaluationReport {
  grammar_score: number;
  vocab_score: number;
  fluency_score: number;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface IWebSpeechRecognition extends EventTarget {
  continuous: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): IWebSpeechRecognition;
}

interface ExtendedWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

/* =======================
   2. Prompt Configurations
======================= */
const COACH_SYSTEM_PROMPT = `
You are a friendly English coach. 
1. If the user starts, suggest 3 topics (e.g., Travel, Food, Hobbies).
2. Briefly correct grammar mistakes in [Square Brackets] before replying.
3. Keep responses under 2 sentences. Always end with a question.
`;

const EVALUATOR_PROMPT = `
Analyze the transcript. Evaluate User's Grammar, Vocabulary, and Fluency (0-10). 
Return ONLY a JSON object:
{
  "grammar_score": number, "vocab_score": number, "fluency_score": number,
  "strengths": ["string", "string"], "weaknesses": ["string", "string"], "feedback": "string"
}
`;

/* =======================
   3. Main Component
======================= */
export const SpeakingModule = ({ onBack }: { onBack: () => void }) => {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);
  const [report, setReport] = useState<EvaluationReport | null>(null);

  const recognitionRef = useRef<IWebSpeechRecognition | null>(null);
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string;

  // --- HÀM PHÁT ÂM (TTS) ---
  const speak = useCallback((text: string) => {
    // Loại bỏ phần sửa lỗi trong ngoặc vuông khi đọc
    const textToRead = text.replace(/\[.*?\]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = "en-US";
    utterance.onstart = () => setIsAISpeaking(true);
    utterance.onend = () => setIsAISpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  // --- HÀM GỌI AI ĐỂ CHAT (LLM) ---
  const fetchAIResponse = useCallback(async (history: Message[]) => {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: COACH_SYSTEM_PROMPT }, ...history],
        }),
      });
      const data = await response.json();
      const aiText = data.choices[0]?.message?.content || "I'm listening...";
      setMessages((prev) => [...prev, { role: "assistant", content: aiText }]);
      speak(aiText);
    } catch (error) { console.error("Chat Error:", error); }
  }, [apiKey, speak]);

  // --- HÀM TẠO BÁO CÁO KẾT THÚC ---
  const handleEndSession = useCallback(async () => {
    setIsEvaluating(true);
    const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: EVALUATOR_PROMPT },
            { role: "user", content: `Transcript:\n${transcript}` }
          ],
          response_format: { type: "json_object" }
        }),
      });
      const data = await response.json();
      setReport(JSON.parse(data.choices[0].message.content));
    } catch (error) { console.error("Eval Error:", error); }
    setIsEvaluating(false);
  }, [apiKey, messages]);

  // --- XỬ LÝ GIỌNG NÓI NGƯỜI DÙNG (CÓ XÁC NHẬN KẾT THÚC) ---
  const handleUserSpeech = useCallback(async (text: string) => {
    const userMsg: Message = { role: "user", content: text };
    const lowerText = text.toLowerCase();
    setMessages((prev) => [...prev, userMsg]);

    // Luồng xác nhận kết thúc
    if (isConfirmingEnd) {
      if (lowerText.match(/\b(yes|ok|okay|sure|yeah|yep)\b/)) {
        setIsConfirmingEnd(false);
        await handleEndSession();
        return;
      } else {
        setIsConfirmingEnd(false);
        const msg = "Great! Let's continue our lesson.";
        setMessages(prev => [...prev, { role: "assistant", content: msg }]);
        speak(msg);
        return;
      }
    }

    // Phát hiện từ khóa kết thúc
    if (lowerText.match(/\b(stop|end session|finish|quit)\b/)) {
      setIsConfirmingEnd(true);
      const confirmText = "Are you sure you want to end this session and see your report?";
      setMessages(prev => [...prev, { role: "assistant", content: confirmText }]);
      speak(confirmText);
      return;
    }

    // Gửi cho AI trả lời bình thường
    setMessages((prev) => {
      const updatedHistory = [...prev];
      void fetchAIResponse(updatedHistory);
      return updatedHistory;
    });
  }, [isConfirmingEnd, handleEndSession, fetchAIResponse, speak]);

  // Khởi tạo Speech Recognition
  useEffect(() => {
    const extendedWindow = window as unknown as ExtendedWindow;
    const SpeechRecognition = extendedWindow.SpeechRecognition || extendedWindow.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = "en-US";
      recognition.onresult = (e: SpeechRecognitionEvent) => {
        void handleUserSpeech(e.results[0][0].transcript);
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [handleUserSpeech]);

  // Bot mở lời khi vào màn hình (Fix Cascading Render)
  useEffect(() => {
    const hello = "Hi! I'm your English coach. Should we talk about Travel, Food, or your Hobbies today?";
    if (messages.length === 0) {
      const timer = setTimeout(() => {
        setMessages([{ role: "assistant", content: hello }]);
        speak(hello);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [messages.length, speak]);

  

  // --- UI: MÀN HÌNH BÁO CÁO ---
  if (report) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center animate-in fade-in duration-500">
        <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 space-y-8">
          <div className="text-center">
            <h2 className="text-4xl font-black text-slate-800 mb-2 italic">SESSION REPORT</h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Phân tích kết quả luyện tập</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[ {label: "Grammar", score: report.grammar_score, color: "text-blue-600"},
               {label: "Vocabulary", score: report.vocab_score, color: "text-green-600"},
               {label: "Fluency", score: report.fluency_score, color: "text-orange-600"}
            ].map(s => (
              <div key={s.label} className="bg-slate-50 p-4 rounded-[2rem] text-center border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{s.label}</p>
                <p className={`text-3xl font-black ${s.color}`}>{s.score}<span className="text-xs opacity-30">/10</span></p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <p className="font-black text-slate-800 mb-2 text-sm">✅ STRENGTHS</p>
              <div className="flex flex-wrap gap-2">
                {report.strengths.map((s, i) => <span key={i} className="bg-green-50 text-green-700 px-3 py-1 rounded-xl text-xs font-bold border border-green-100">{s}</span>)}
              </div>
            </div>
            <div>
              <p className="font-black text-slate-800 mb-2 text-sm">🚀 IMPROVEMENTS</p>
              <div className="flex flex-wrap gap-2">
                {report.weaknesses.map((w, i) => <span key={i} className="bg-orange-50 text-orange-700 px-3 py-1 rounded-xl text-xs font-bold border border-orange-100">{w}</span>)}
              </div>
            </div>
            <p className="text-slate-600 italic leading-relaxed bg-blue-50/50 p-6 rounded-3xl text-sm font-medium">"{report.feedback}"</p>
          </div>

          <button onClick={onBack} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black shadow-xl active:scale-95 transition-all">TIẾP TỤC HỌC</button>
        </div>
      </div>
    );
  }

  // --- UI: MÀN HÌNH CHAT ---
  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center font-sans">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <button onClick={onBack} className="text-slate-400 font-black hover:text-blue-600 uppercase text-xs tracking-widest transition-colors">← EXIT</button>
        <button onClick={() => void handleEndSession()} className="bg-orange-100 text-orange-600 px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-orange-200 transition-all">End & Review</button>
      </div>

      <div className="relative mb-8 flex flex-col items-center">
        <div className={`text-9xl transition-all duration-500 ${isAISpeaking ? "scale-110 rotate-3" : "scale-100"}`}>{isAISpeaking ? "🤖" : "😴"}</div>
        {isAISpeaking && (
          <div className="mt-4 flex gap-2 items-end h-8">
            <div className="w-2 h-4 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-8 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-2 h-5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        )}
      </div>

      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 h-[400px] overflow-y-auto mb-8 space-y-6 border border-white scroll-smooth shadow-blue-50">
        {messages.filter(m => m.role !== "system").map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] p-5 rounded-[1.8rem] font-bold text-sm shadow-sm ${
              m.role === "user" ? "bg-blue-600 text-white shadow-blue-100" : "bg-slate-50 text-slate-700"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {isEvaluating && <div className="text-center font-black text-blue-600 animate-pulse text-xs tracking-widest">ANALYZING YOUR SESSION...</div>}
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          onMouseDown={() => { setIsListening(true); recognitionRef.current?.start(); }}
          className={`w-28 h-28 rounded-full shadow-2xl flex items-center justify-center text-4xl transition-all active:scale-90 touch-none ${
            isListening ? "bg-red-500 animate-pulse" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
          } text-white`}
        >
          {isListening ? "🎙️" : "🎤"}
        </button>
        <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">{isListening ? "Hệ thống đang nghe..." : "Nhấn giữ để nói"}</p>
      </div>
    </div>
  );
};