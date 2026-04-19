import React, { useState, useRef, useCallback, useEffect } from "react";

// ─────────────────────────────────────────────────────────────
//  100% FREE STACK:
//  - Voice recognition : Web Speech API (browser built-in, free)
//  - AI analysis       : Groq API with Llama 3 (free tier)
//                        Sign up FREE at https://console.groq.com
//                        No credit card required
//  - Add key to .env   : REACT_APP_GROQ_KEY=gsk_xxxxxxxxxxxx
// ─────────────────────────────────────────────────────────────

const GROQ_KEY = process.env.NEXT_PUBLIC_GROQ_KEY || "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const ANALYSIS_DELAY_MS = 5000; // analyse after 5s of silence

const SYSTEM_PROMPT = `You are a clinical AI assistant in a live telemedicine consultation.
Analyse the transcript and return ONLY a JSON object — no markdown, no explanation:
{
  "doctor_said": "brief summary of doctor speech",
  "patient_said": "brief summary of patient speech",
  "symptoms": ["symptom 1", "symptom 2"],
  "possible_conditions": [
    { "name": "Condition", "confidence": "High|Medium|Low", "reason": "one sentence" }
  ],
  "red_flags": ["urgent warning signs — empty array if none"],
  "suggested_questions": ["what doctor should ask next"],
  "recommended_tests": ["tests to consider"],
  "summary": "2-sentence clinical summary"
}`;

async function analyseWithGroq(transcript: string) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Transcript:\n${transcript}` },
      ],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const raw = data.choices?.[0]?.message?.content || "{}";
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse Groq response:", raw);
    return {
      doctor_said: "",
      patient_said: "",
      symptoms: [],
      possible_conditions: [],
      red_flags: [],
      suggested_questions: [],
      recommended_tests: [],
      summary: "Error parsing AI response"
    };
  }
}

// ── small UI helpers ──────────────────────────────────────────

const pill = (bg: string, text: string, border: string) => ({
  display: "inline-block", padding: "2px 10px", borderRadius: 99,
  fontSize: 11, fontWeight: 600, background: bg, color: text,
  border: `1px solid ${border}`, letterSpacing: 0.2,
});

const CONF: Record<string, any> = {
  High:   pill("#fee2e2","#991b1b","#fecaca"),
  Medium: pill("#fef9c3","#854d0e","#fef08a"),
  Low:    pill("#f1f5f9","#475569","#e2e8f0"),
};

function Dot({ active }: { active: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: active ? "#22c55e" : "#94a3b8",
      animation: active ? "blink 1.2s ease-in-out infinite" : "none",
      marginRight: 6, verticalAlign: "middle",
    }}/>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 13, height: 13,
      border: "2px solid #bae6fd", borderTopColor: "#0ea5e9",
      borderRadius: "50%", animation: "spin .7s linear infinite",
      verticalAlign: "middle", marginRight: 6,
    }}/>
  );
}

interface AIVoiceScribeProps {
  hidden?: boolean;
  onLocalTranscript?: (text: string) => void;
  externalTranscript?: { text: string; sender: string } | null;
}

export default function AIVoiceScribe({ hidden, onLocalTranscript, externalTranscript }: AIVoiceScribeProps) {
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [analysis,   setAnalysis]   = useState<any>(null);
  const [analysing,  setAnalysing]  = useState(false);
  const [error,      setError]      = useState("");
  const [tab,        setTab]        = useState("analysis");
  const [snapshots,  setSnapshots]  = useState<any[]>([]);
  const [volume,     setVolume]     = useState(0);

  const recRef      = useRef<any>(null);
  const timerRef    = useRef<any>(null);
  const tRef        = useRef("");   
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  useEffect(() => { tRef.current = transcript; }, [transcript]);



  // Visualizer Logic (Canvas Waveform)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const startVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const ana = ctx.createAnalyser();
      ana.fftSize = 512;
      src.connect(ana);
      
      const data = new Uint8Array(ana.frequencyBinCount);
      const canvas = canvasRef.current;
      const cc = canvas?.getContext('2d');

      const draw = () => {
        if (!audioCtxRef.current || !canvas || !cc) return;
        ana.getByteFrequencyData(data);
        
        // Update simple volume state for other UI
        const avg = data.reduce((a, b) => a + b) / data.length;
        setVolume(avg);

        // Draw waveform
        cc.clearRect(0, 0, canvas.width, canvas.height);
        cc.fillStyle = '#22c55e';
        const barWidth = (canvas.width / data.length) * 2.5;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
          const barHeight = (data[i] / 255) * canvas.height;
          cc.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
        requestAnimationFrame(draw);
      };
      draw();
    } catch (e) {
      console.warn("Visualizer failed", e);
      setError("Microphone Hardware Error: Could not connect to any audio input.");
    }
  };

  const stopVisualizer = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setVolume(0);
  };

  const runAnalysis = useCallback(async () => {
    const t = tRef.current.trim();
    if (t.length < 20) return;
    setAnalysing(true);
    try {
      const result = await analyseWithGroq(t);
      setAnalysis(result);
      setSnapshots(prev => [{ time: new Date().toLocaleTimeString(), ...result }, ...prev].slice(0, 8));
    } catch (e: any) {
      setError("AI error: " + e.message);
    }
    setAnalysing(false);
  }, []);

  const scheduleAnalysis = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runAnalysis, ANALYSIS_DELAY_MS);
  }, [runAnalysis]);

  // Use external transcript from Jitsi Data Channel
  useEffect(() => {
    if (externalTranscript?.text) {
      setTranscript(prev => prev + `\n(${externalTranscript.sender}): ` + externalTranscript.text + " ");
      scheduleAnalysis();
    }
  }, [externalTranscript, scheduleAnalysis]);
  const toggle = useCallback(() => {
    if (listening) {
      recRef.current?.stop();
      recRef.current = null;
      setListening(false);
      clearTimeout(timerRef.current);
      stopVisualizer();
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError("Use Chrome or Edge — Firefox doesn't support speech recognition."); return; }
    if (!GROQ_KEY) { setError("Add process.env.NEXT_PUBLIC_GROQ_KEY=gsk_... to your .env"); return; }
    
    // Check for Secure Context (HTTPS) - required for Web Speech API on non-localhost
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setError("HTTPS REQUIRED: Voice recognition is disabled by your browser on insecure connections. Please use HTTPS or localhost.");
      return;
    }

    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true; // Changed to true for real-time feedback
    rec.lang           = "en-US";

    rec.onstart = () => {
      setListening(true);
      setError("");
      console.log("Speech recognition started " + (hidden ? "(Hidden Mode)" : ""));
    };

    rec.onresult = (e: any) => {
      let final = "";
      let interim = "";
      
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += text + " ";
        } else {
          interim += text;
        }
      }

      setInterimTranscript(interim);
      if (final) {
        setTranscript(prev => prev + final);
        
        // RELAY via Jitsi (Parent Callback)
        if (onLocalTranscript) {
          onLocalTranscript(final);
        }

        scheduleAnalysis();
      }
    };

    rec.onerror = (e: any) => { 
      console.error("Speech Recognition Error:", e.error);
      if (e.error === 'not-allowed') {
        setError("Microphone access denied. Please click the 'Lock' icon in your browser address bar and allow microphone access for this site.");
        setListening(false);
        stopVisualizer();
      } else if (e.error === 'network') {
        setError("Network error: Speech recognition requires an active internet connection to process voice.");
      } else if (e.error !== "no-speech") {
        setError("Mic Error: " + e.error);
      }
    };

    rec.onend = () => { 
      console.log("Speech recognition ended");
      if (recRef.current && listening) {
        try { recRef.current.start(); } catch(err) { /* ignore restart errors */ }
      } else {
        setListening(false);
        stopVisualizer();
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      if (!hidden) startVisualizer();
    } catch (err) {
      setError("Failed to start microphone. Please refresh the page.");
      setListening(false);
    }
  }, [listening, scheduleAnalysis, hidden]);

  // Auto-start if hidden (background mode)
  useEffect(() => {
    if (hidden && !listening && !recRef.current) {
      // Small delay to ensure browser readiness
      const timer = setTimeout(() => {
        try { toggle(); } catch (e) { console.error("Auto-start failed", e); }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hidden, listening, toggle]);

  const clear = () => { setTranscript(""); setAnalysis(null); setError(""); };

  if (hidden && !error) return null;

  // ── styles ────────────────────────────────────────────────

  const c = {
    wrap:   { fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif", background: "#f8fafc", color: "#0f172a", height: "100%", display: "flex", flexDirection: "column" as const, overflow: "hidden" },
    header: { background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px", display: "flex", flexDirection: "column" as const, gap: 12, flexShrink: 0 },
    body:   { display: "flex", flexDirection: "column" as const, flex: 1, overflowY: "auto" as const, background: "#fff" },
    left:   { padding: 18, borderBottom: "1px solid #e2e8f0", background: "#f8fafc", flexShrink: 0 },
    right:  { padding: 18, flex: 1 },
    btn: (on: boolean, bg = "#0ea5e9") => ({
      padding: "7px 15px", borderRadius: 7, border: "none", cursor: "pointer",
      fontWeight: 600, fontSize: 12, background: on ? bg : "#f1f5f9",
      color: on ? "#fff" : "#475569", display: "flex", alignItems: "center", gap: 5,
    }),
    card:  { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 13, marginBottom: 10 },
    label: { fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: "#94a3b8", marginBottom: 7 },
    tab: (on: boolean) => ({
      padding: "7px 13px", fontSize: 12, fontWeight: 600, border: "none",
      background: "none", cursor: "pointer", color: on ? "#0ea5e9" : "#64748b",
      borderBottom: `2px solid ${on ? "#0ea5e9" : "transparent"}`, marginBottom: -1,
    }),
    sym:   { display: "inline-block", background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 99, padding: "3px 9px", fontSize: 12, margin: "2px 3px 2px 0" },
    red:   { background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 7, padding: "7px 11px", marginBottom: 5, fontSize: 12, color: "#be123c" },
    green: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: "7px 11px", marginBottom: 5, fontSize: 12, color: "#166534" },
    row:   { display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 9px", borderRadius: 7, background: "#f8fafc", border: "1px solid #f1f5f9", marginBottom: 6 },
  };

  return (
    <div style={c.wrap}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {/* header */}
      <div style={c.header}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>AI Clinical Scribe</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {analysing && <span style={{ fontSize: 12, color: "#0ea5e9", display: "flex", alignItems: "center" }}><Spinner/></span>}
          <button style={c.btn(listening, "#22c55e")} onClick={toggle}>
            <Dot active={listening}/>{listening ? "Stop" : "Listen"}
          </button>
          <button style={c.btn(false)} onClick={clear}>Clear</button>
          <button style={c.btn(false)} onClick={runAnalysis} disabled={!transcript}>Analyse</button>
        </div>
      </div>

      <div style={c.body}>

        {/* LEFT — transcript */}
        <div style={c.left}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              {hidden ? "AI Voice Tracking (Patient Side)" : "Live Transcript"}
            </span>
            {listening && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 800 }}>LIVE MIC </span>
                <canvas ref={canvasRef} width="100" height="20" style={{ background: "#f1f5f9", borderRadius: 4 }} />
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#be123c" }}>
              {error}
            </div>
          )}

          <div style={{
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
            padding: 15, minHeight: 150, fontSize: 14, lineHeight: 1.75,
            color: "#1e293b", whiteSpace: "pre-wrap",
          }}>
            {transcript || interimTranscript || (
              <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                {listening
                  ? "Listening… speak clearly. Both doctor and patient voices will be captured."
                  : "Click 'Start Listening' to begin."}
              </span>
            )}
            {interimTranscript && (
              <span style={{ color: "#64748b", opacity: 0.7 }}>{interimTranscript}</span>
            )}
          </div>

          {/* doctor / patient split */}
          {analysis && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <div style={{ ...c.card, borderLeft: "3px solid #3b82f6", borderRadius: 0, borderTopRightRadius: 10, borderBottomRightRadius: 10 }}>
                <div style={{ ...c.label, color: "#1d4ed8" }}>Doctor said</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>{analysis.doctor_said || "—"}</div>
              </div>
              <div style={{ ...c.card, borderLeft: "3px solid #22c55e", borderRadius: 0, borderTopRightRadius: 10, borderBottomRightRadius: 10 }}>
                <div style={{ ...c.label, color: "#166534" }}>Patient said</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>{analysis.patient_said || "—"}</div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — AI panel */}
        <div style={c.right}>
          <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 14 }}>
            <button style={c.tab(tab === "analysis")}  onClick={() => setTab("analysis")}>Analysis</button>
            <button style={c.tab(tab === "snapshots")} onClick={() => setTab("snapshots")}>
              History ({snapshots.length})
            </button>
          </div>

          {tab === "analysis" && (
            <>
              {!analysis && !analysing && (
                <div style={{ textAlign: "center", padding: "50px 20px", color: "#94a3b8" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎙️</div>
                  <div style={{ fontSize: 13 }}>Start speaking to analyse.</div>
                </div>
              )}

              {analysing && !analysis && (
                <div style={{ textAlign: "center", padding: "50px 20px", color: "#0ea5e9" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🧠</div>
                  <div style={{ fontSize: 13 }}>Analysing with Llama 3…</div>
                </div>
              )}

              {analysis && <>

                {/* symptoms */}
                {analysis.symptoms?.length > 0 && (
                  <div style={c.card}>
                    <div style={c.label}>Reported symptoms</div>
                    {analysis.symptoms.map((s: string, i: number) => <span key={i} style={c.sym}>{s}</span>)}
                  </div>
                )}

                {/* red flags */}
                {analysis.red_flags?.length > 0 && (
                  <div style={c.card}>
                    <div style={{ ...c.label, color: "#dc2626" }}>Red flags</div>
                    {analysis.red_flags.map((f: string, i: number) => <div key={i} style={c.red}>⚠️ {f}</div>)}
                  </div>
                )}

                {/* possible conditions */}
                {analysis.possible_conditions?.length > 0 && (
                  <div style={c.card}>
                    <div style={c.label}>Possible conditions</div>
                    {analysis.possible_conditions.map((cond: any, i: number) => (
                      <div key={i} style={c.row}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{cond.name}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{cond.reason}</div>
                        </div>
                        <span style={CONF[cond.confidence] || CONF.Low}>{cond.confidence}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* suggested questions */}
                {analysis.suggested_questions?.length > 0 && (
                  <div style={c.card}>
                    <div style={c.label}>Suggested questions</div>
                    {analysis.suggested_questions.map((q: string, i: number) => <div key={i} style={c.green}>{q}</div>)}
                  </div>
                )}
              </>}
            </>
          )}

          {tab === "snapshots" && (
            snapshots.length === 0
              ? <div style={{ textAlign: "center", padding: "50px 20px", color: "#94a3b8", fontSize: 13 }}>No snapshots yet.</div>
              : snapshots.map((s, i) => (
                <div key={i} style={{ ...c.card, cursor: "pointer" }} onClick={() => { setAnalysis(s); setTab("analysis"); }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 3 }}>{s.time}</div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                    {s.possible_conditions?.[0]?.name || "Snapshot"}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
