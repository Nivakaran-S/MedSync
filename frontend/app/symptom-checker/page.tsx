'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { symptomApi } from '../services/api';
import { Card, Button, Badge, showToast, Tabs } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import {
  Stethoscope, Hourglass, Search, Brain, AlertTriangle, FileText, Camera,
  MessageCircle, Send, ImagePlus, Pill, ShieldAlert, UserCheck, X, Trash2,
  ThumbsUp, ThumbsDown, AlertCircle, Mic, Square, Download, Languages,
  TrendingUp, TrendingDown, Activity, FileImage, FileBarChart,
} from 'lucide-react';

const commonSymptoms = [
  'Headache', 'Fever', 'Cough', 'Sore throat', 'Chest pain',
  'Shortness of breath', 'Nausea', 'Stomach pain', 'Rash',
  'Joint pain', 'Back pain', 'Dizziness', 'Fatigue',
  'Blurred vision', 'Anxiety', 'Insomnia', 'Wheezing',
  'Frequent urination', 'Ear pain', 'Numbness',
];

interface Disclaimer {
  type: string;
  text: string;
}

interface ICD10Code { code: string; description: string }

interface AnalyzeResult {
  results: Array<{
    specialty: string;
    suggestions: string;
    urgency: string;
    matchedKeywords?: string[];
    confidence?: number;
    icd10Codes?: ICD10Code[];
    demographicNote?: string;
  }>;
  overallUrgency: string;
  overallConfidence?: number;
  confidenceFlag?: 'LOW' | 'OK';
  aiSummary?: string;
  drugInteractionWarnings?: string[];
  allergyWarnings?: string[];
  possibleDrugSideEffects?: Array<{ drug: string; symptomMatch: string; note: string; advice: string }>;
  redFlags?: Array<{ code: string; label: string; advice: string }>;
  urgencyOverrideReason?: string | null;
  impliedSeverity?: string;
  severityMismatchNote?: string | null;
  progression?: { trend: string; explanation?: string; referenceCheckIds?: string[] } | null;
  recommendedDoctors?: Array<{
    doctorId: string;
    name: string;
    specialty: string;
    consultationFee?: number;
    nextSlot?: string | null;
  }>;
  contextUsed?: boolean;
  visibleFindings?: string[];
  extractedValues?: Array<{ label: string; value: string; isAbnormal?: boolean }>;
  imageKind?: string;
  disclaimer?: string;
  disclaimers?: Disclaimer[];
  sourceModel?: string;
  promptVersion?: string;
  cacheHit?: boolean;
  followUpAt?: string | null;
  language?: string;
  checkId?: string;
}

interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string }

const urgencyVariant = (u?: string) => {
  if (u === 'emergency') return 'emergency';
  if (u === 'high') return 'high';
  if (u === 'medium') return 'medium';
  return 'low';
};

export default function SymptomCheckerPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  // ── Triage form state ──
  const [symptoms, setSymptoms] = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | 'unspecified'>('unspecified');
  const [durationDays, setDurationDays] = useState<string>('');
  const [bodyLocation, setBodyLocation] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [language, setLanguage] = useState<string>('en');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  // ── Voice input (#10) ──
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // ── Image analysis state ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDescription, setImageDescription] = useState('');
  const [imageKind, setImageKind] = useState<'skin' | 'rash' | 'wound' | 'lab-report' | 'xray' | 'ecg' | 'other'>('skin');
  const [imageLoading, setImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Conversation state ──
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // ── History state ──
  const [history, setHistory] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());

  const toggleHistorySelection = (id: string) => {
    setSelectedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkDeleteSelected = async () => {
    const ids = Array.from(selectedHistory);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} symptom check${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    try {
      const res = await symptomApi.bulkDeleteChecks(ids);
      setHistory((prev) => prev.filter((h) => !selectedHistory.has(h._id)));
      setHistoryTotal((prev) => Math.max(0, prev - (res.deleted || ids.length)));
      setSelectedHistory(new Set());
      showToast(`Deleted ${res.deleted || ids.length} check${(res.deleted || ids.length) === 1 ? '' : 's'}`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Bulk delete failed', 'error');
    }
  };

  useEffect(() => {
    if (user?.id) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    if (!user?.id) return;
    try {
      const data = await symptomApi.getHistory(user.id, 1, 10);
      setHistory(data.items || []);
      setHistoryTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleChip = (s: string) =>
    setSelectedChips((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const allSymptoms = [...selectedChips, symptoms].filter(Boolean).join(', ');
    if (!allSymptoms.trim()) {
      showToast('Please enter or select at least one symptom.', 'warning');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await symptomApi.analyzeSymptoms({
        symptoms: allSymptoms,
        severity,
        durationDays: durationDays ? Number(durationDays) : undefined,
        bodyLocation: bodyLocation || undefined,
        additionalContext: additionalContext || undefined,
        language,
      });
      setResult(data);
      fetchHistory();
    } catch (err: any) {
      showToast(err.message || 'Error analyzing symptoms.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setSymptoms('');
    setSelectedChips([]);
    setSeverity('unspecified');
    setDurationDays('');
    setBodyLocation('');
    setAdditionalContext('');
    setResult(null);
  };

  // ── #10 Voice input via Web Speech API ──
  const supportsVoice = typeof window !== 'undefined'
    && (window as any).SpeechRecognition || (typeof window !== 'undefined' && (window as any).webkitSpeechRecognition);

  const startVoice = () => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      showToast('Voice input is not supported in this browser. Try Chrome.', 'warning');
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = language === 'en' ? 'en-US' : language;
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        setSymptoms((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onerror = (e: any) => {
      console.warn('voice error', e);
      showToast('Voice input failed', 'error');
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const stopVoice = () => {
    try { recognitionRef.current?.stop(); } catch { /* */ }
    setRecording(false);
  };

  // ── Image handlers ──
  const onImagePick = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    if (!/^image\//.test(file.type)) {
      showToast('Please choose an image file.', 'warning');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageAnalyze = async () => {
    if (!imageFile) {
      showToast('Pick an image first.', 'warning');
      return;
    }
    setImageLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      if (imageDescription) fd.append('description', imageDescription);
      fd.append('imageKind', imageKind);
      fd.append('language', language);
      const data = await symptomApi.analyzeImage(fd);
      setResult(data);
      fetchHistory();
    } catch (err: any) {
      showToast(err.message || 'Image analysis failed.', 'error');
    } finally {
      setImageLoading(false);
    }
  };

  // ── Conversation handlers ──
  const startChat = async () => {
    if (!chatInput.trim()) {
      showToast('Type a message first.', 'warning');
      return;
    }
    setChatLoading(true);
    try {
      const data = await symptomApi.startConversation(chatInput);
      setConversationId(data.conversationId);
      setChatMessages([
        { role: 'user', content: chatInput },
        { role: 'assistant', content: data.reply },
      ]);
      setChatInput('');
    } catch (err: any) {
      showToast(err.message || 'Failed to start conversation', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  const continueChat = async () => {
    if (!chatInput.trim() || !conversationId) return;
    const msg = chatInput;
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const data = await symptomApi.continueConversation(conversationId, msg);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      showToast(err.message || 'Reply failed', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  const closeChat = async () => {
    if (!conversationId) return;
    try {
      await symptomApi.closeConversation(conversationId);
      showToast('Conversation closed', 'info');
    } catch {
      /* non-fatal */
    } finally {
      setConversationId(null);
      setChatMessages([]);
    }
  };

  return (
    <div className="animate-in">
      <h1 className="page-title">AI Symptom Checker</h1>
      <p className="page-subtitle">
        Triage by free-text, photo, or guided conversation — analysis is tailored to your medical history.
      </p>

      <Tabs
        tabs={['Triage', 'Photo Analysis', 'Conversation', 'History']}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="tab-content">
        {/* ─── TAB 0: Triage ─────────────────────────────────────────────── */}
        {activeTab === 0 && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <Card title="How are you feeling?" icon={<Stethoscope size={20} />}>
              <form onSubmit={handleAnalyze}>
                <div style={{ marginBottom: '20px' }}>
                  <label className="med-label">Quick-select common symptoms</label>
                  <div className="chips-container">
                    {commonSymptoms.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`symptom-chip ${selectedChips.includes(s) ? 'selected' : ''}`}
                        onClick={() => toggleChip(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="med-input-group">
                  <label className="med-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span>Describe your symptoms</span>
                    {supportsVoice && (
                      <button
                        type="button"
                        onClick={recording ? stopVoice : startVoice}
                        title={recording ? 'Stop recording' : 'Speak your symptoms'}
                        style={{
                          background: recording ? '#ef4444' : 'transparent',
                          color: recording ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid var(--card-border)',
                          borderRadius: 6,
                          padding: '4px 10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          gap: 6,
                          alignItems: 'center',
                          fontSize: '0.85rem',
                        }}
                      >
                        {recording ? <Square size={14} /> : <Mic size={14} />}
                        {recording ? 'Stop' : 'Voice'}
                      </button>
                    )}
                  </label>
                  <textarea
                    className="med-input"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={3}
                    placeholder="e.g. dull chest pain for 3 days with shortness of breath when climbing stairs..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div className="med-input-group">
                    <label className="med-label">Severity</label>
                    <select className="med-input" value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
                      <option value="unspecified">Not sure</option>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                  <div className="med-input-group">
                    <label className="med-label">Duration (days)</label>
                    <input
                      type="number"
                      min="0"
                      className="med-input"
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      placeholder="3"
                    />
                  </div>
                  <div className="med-input-group">
                    <label className="med-label">Body location</label>
                    <input
                      type="text"
                      className="med-input"
                      value={bodyLocation}
                      onChange={(e) => setBodyLocation(e.target.value)}
                      placeholder="e.g. lower back"
                    />
                  </div>
                  <div className="med-input-group">
                    <label className="med-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Languages size={14} /> Language
                    </label>
                    <select className="med-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="en">English</option>
                      <option value="si">Sinhala (සිංහල)</option>
                      <option value="ta">Tamil (தமிழ்)</option>
                      <option value="es">Spanish (Español)</option>
                      <option value="fr">French (Français)</option>
                      <option value="ar">Arabic (العربية)</option>
                      <option value="hi">Hindi (हिन्दी)</option>
                      <option value="zh">Chinese (中文)</option>
                    </select>
                  </div>
                </div>

                <div className="med-input-group">
                  <label className="med-label">Additional context (optional)</label>
                  <input
                    type="text"
                    className="med-input"
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="e.g. recent travel, recent surgery, pregnancy..."
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Button type="submit" disabled={loading} icon={loading ? <Hourglass size={16} /> : <Search size={16} />}>
                    {loading ? 'Analyzing…' : 'Run AI Triage'}
                  </Button>
                  <Button variant="secondary" onClick={clearForm}>Clear</Button>
                </div>

                <p className="disclaimer" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '12px' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Preliminary AI suggestions only — not a medical diagnosis. Consult a qualified clinician.</span>
                </p>
              </form>
            </Card>

            {result && <ResultPanel result={result} />}
          </div>
        )}

        {/* ─── TAB 1: Photo Analysis ─────────────────────────────────────── */}
        {activeTab === 1 && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <Card title="Visual Symptom Analysis" icon={<Camera size={20} />}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
                Upload a clear photo of a skin condition, rash, wound, or visible concern. Our vision AI provides a preliminary observation.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => onImagePick(e.target.files?.[0] || null)}
              />

              {!imagePreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%', minHeight: '220px', border: '2px dashed var(--card-border)',
                    borderRadius: 'var(--radius-lg)', background: 'var(--bg-main)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '12px', cursor: 'pointer', color: 'var(--text-secondary)',
                  }}
                >
                  <ImagePlus size={36} />
                  <strong>Click to choose an image</strong>
                  <span style={{ fontSize: '0.85rem' }}>JPEG / PNG / WEBP · up to 8MB</span>
                </button>
              ) : (
                <div style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="upload preview"
                    style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', borderRadius: 'var(--radius-lg)', background: '#000' }}
                  />
                  <button
                    type="button"
                    onClick={() => onImagePick(null)}
                    style={{
                      position: 'absolute', top: '10px', right: '10px',
                      background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                      borderRadius: '50%', width: '32px', height: '32px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                <div className="med-input-group" style={{ margin: 0 }}>
                  <label className="med-label">What kind of image?</label>
                  <select
                    className="med-input"
                    value={imageKind}
                    onChange={(e) => setImageKind(e.target.value as any)}
                  >
                    <option value="skin">Skin / general photo</option>
                    <option value="rash">Rash</option>
                    <option value="wound">Wound</option>
                    <option value="lab-report">Lab report (paper)</option>
                    <option value="xray">X-ray (preliminary scan only)</option>
                    <option value="ecg">ECG (preliminary scan only)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="med-input-group" style={{ margin: 0 }}>
                  <label className="med-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Languages size={14} /> Language
                  </label>
                  <select className="med-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">English</option>
                    <option value="si">Sinhala</option>
                    <option value="ta">Tamil</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="ar">Arabic</option>
                    <option value="hi">Hindi</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>
              </div>

              {(imageKind === 'xray' || imageKind === 'ecg') && (
                <div style={{
                  marginTop: 12, padding: '10px 12px',
                  background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8,
                  color: '#7f1d1d', fontSize: '0.85rem',
                }}>
                  <strong>⚠ Preliminary visual scan only.</strong> AI vision is NOT a {imageKind.toUpperCase()} interpretation.
                  A qualified specialist must review the actual {imageKind === 'xray' ? 'imaging study' : 'tracing'} before any clinical decision.
                </div>
              )}

              <div className="med-input-group" style={{ marginTop: '16px' }}>
                <label className="med-label">Describe what we&apos;re looking at (optional)</label>
                <input
                  type="text"
                  className="med-input"
                  value={imageDescription}
                  onChange={(e) => setImageDescription(e.target.value)}
                  placeholder="e.g. red itchy rash on inner forearm, started yesterday"
                />
              </div>

              <Button
                onClick={handleImageAnalyze}
                disabled={imageLoading || !imageFile}
                icon={imageLoading ? <Hourglass size={16} /> : <Brain size={16} />}
              >
                {imageLoading ? 'Analyzing photo…' : 'Analyze with AI Vision'}
              </Button>
            </Card>

            {result && <ResultPanel result={result} />}
          </div>
        )}

        {/* ─── TAB 2: Conversation ───────────────────────────────────────── */}
        {activeTab === 2 && (
          <Card title="Guided Triage Conversation" icon={<MessageCircle size={20} />}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
              Chat with the AI to refine your triage. Helpful when symptoms are vague or you need follow-up questions.
            </p>

            {chatMessages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><MessageCircle size={36} /></div>
                <h3>Start a conversation</h3>
                <p>Tell the AI what&apos;s going on — it will ask follow-up questions.</p>
              </div>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '10px',
                maxHeight: '400px', overflowY: 'auto', padding: '12px',
                background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', marginBottom: '12px',
              }}>
                {chatMessages.filter((m) => m.role !== 'system').map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: m.role === 'user' ? 'var(--primary)' : '#fff',
                      color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                      border: m.role === 'user' ? 'none' : '1px solid var(--card-border)',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Assistant is typing…
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="med-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    conversationId ? continueChat() : startChat();
                  }
                }}
                placeholder={conversationId ? 'Reply to the assistant…' : 'Describe what brought you here…'}
                style={{ marginBottom: 0 }}
              />
              <Button
                onClick={() => (conversationId ? continueChat() : startChat())}
                disabled={chatLoading || !chatInput.trim()}
                icon={<Send size={16} />}
              >
                Send
              </Button>
              {conversationId && (
                <Button variant="secondary" onClick={closeChat}>End</Button>
              )}
            </div>
          </Card>
        )}

        {/* ─── TAB 3: History ────────────────────────────────────────────── */}
        {activeTab === 3 && (
          <Card title={`Past Symptom Checks (${historyTotal})`} icon={<FileText size={20} />}>
            {selectedHistory.size > 0 && (
              <div style={{
                marginBottom: 12, padding: '8px 12px',
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '0.9rem', color: '#1e40af' }}>
                  {selectedHistory.size} selected
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSelectedHistory(new Set())} className="med-button secondary sm">Clear</button>
                  <button onClick={bulkDeleteSelected} className="med-button danger sm" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <Trash2 size={14} /> Delete selected
                  </button>
                </div>
              </div>
            )}
            {history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><FileText size={36} /></div>
                <h3>No checks yet</h3>
                <p>Run a triage on the first tab — your past results will appear here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.map((item: any) => (
                  <div key={item._id} className="history-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={selectedHistory.has(item._id)}
                          onChange={() => toggleHistorySelection(item._id)}
                          aria-label="Select check"
                        />
                        <Badge text={(item.overallUrgency || 'low').toUpperCase()} variant={urgencyVariant(item.overallUrgency)} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <small style={{ color: 'var(--text-muted)' }}>
                          {new Date(item.timestamp || item.createdAt).toLocaleString()}
                        </small>
                        <button
                          onClick={async () => {
                            try { await symptomApi.downloadCheckPdf(item._id); }
                            catch (err: unknown) { showToast(err instanceof Error ? err.message : 'PDF failed', 'error'); }
                          }}
                          title="Download PDF report"
                          style={{
                            background: 'transparent', border: '1px solid var(--card-border)',
                            borderRadius: '6px', padding: '4px 6px', cursor: 'pointer',
                            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                          }}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('Delete this symptom check?')) return;
                            try {
                              await symptomApi.deleteCheck(item._id);
                              setHistory(prev => prev.filter(h => h._id !== item._id));
                              setHistoryTotal(prev => Math.max(0, prev - 1));
                              showToast('Symptom check deleted', 'success');
                            } catch (err: unknown) {
                              showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
                            }
                          }}
                          title="Delete this check"
                          style={{
                            background: 'transparent', border: '1px solid #fecaca',
                            borderRadius: '6px', padding: '4px 6px', cursor: 'pointer',
                            color: '#dc2626', display: 'flex', alignItems: 'center',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      {item.symptoms?.length > 90 ? item.symptoms.substring(0, 90) + '…' : item.symptoms}
                    </p>
                    {item.aiSummary && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        AI: {item.aiSummary}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {(item.results || []).map((r: any, idx: number) => (
                        <span key={idx} style={{
                          fontSize: '0.7rem', padding: '2px 8px',
                          background: 'var(--primary-light)', color: 'var(--primary)',
                          borderRadius: '10px',
                        }}>
                          {r.specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Result panel (shared between Triage & Photo tabs) ──────────────────────

function ResultPanel({ result }: { result: AnalyzeResult }) {
  return (
    <Card title="AI Analysis" icon={<Brain size={20} />}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>Overall urgency:</span>
          <Badge text={(result.overallUrgency || 'low').toUpperCase()} variant={urgencyVariant(result.overallUrgency)} />
          {typeof result.overallConfidence === 'number' && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Confidence: {Math.round(result.overallConfidence * 100)}%
            </span>
          )}
          {result.contextUsed && (
            <span className="badge low" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <UserCheck size={12} /> personalized
            </span>
          )}
        </div>

        {result.overallUrgency === 'emergency' && (
          <div style={{
            padding: '14px', borderRadius: 'var(--radius-md)',
            background: 'var(--error-light)', color: 'var(--emergency)',
            display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, marginBottom: '12px',
          }}>
            <AlertTriangle size={20} /> SEEK IMMEDIATE MEDICAL ATTENTION — call 1990 (Sri Lanka) or your local emergency number.
          </div>
        )}

        {result.confidenceFlag === 'LOW' && (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--radius-md)',
            background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
            display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px',
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
              <strong>Low confidence ({Math.round((result.overallConfidence ?? 0) * 100)}%).</strong>{' '}
              The AI isn&apos;t sure about this triage. Urgency has been escalated as a precaution —
              please verify with a clinician before acting on these recommendations.
            </div>
          </div>
        )}

        {result.aiSummary && (
          <div style={{ padding: '14px', background: 'rgba(15, 82, 186, 0.06)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary)' }}>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
              <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }} />
              <strong>AI Insights:</strong> {result.aiSummary}
            </p>
          </div>
        )}
      </div>

      {/* #1 Red flags — top of result panel for max visibility */}
      {result.redFlags && result.redFlags.length > 0 && (
        <div style={{
          padding: '14px', borderRadius: 'var(--radius-md)',
          background: '#fee2e2', color: '#7f1d1d', border: '2px solid #ef4444',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 800 }}>
            <AlertTriangle size={20} /> Red flag{result.redFlags.length > 1 ? 's' : ''} detected
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {result.redFlags.map((r, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong>{r.label}</strong> — {r.advice}
              </li>
            ))}
          </ul>
          {result.urgencyOverrideReason && (
            <p style={{ margin: '8px 0 0', fontSize: '0.82rem', fontStyle: 'italic' }}>
              {result.urgencyOverrideReason}
            </p>
          )}
        </div>
      )}

      {/* #3 Severity mismatch */}
      {result.severityMismatchNote && (
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa',
          marginBottom: '12px', fontSize: '0.88rem',
        }}>
          <strong>Severity check:</strong> {result.severityMismatchNote}
        </div>
      )}

      {/* #5 Possible drug side effects */}
      {result.possibleDrugSideEffects && result.possibleDrugSideEffects.length > 0 && (
        <div style={{
          padding: '12px 14px', borderRadius: 'var(--radius-md)',
          background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 700 }}>
            <Pill size={16} /> Possible medication side effects
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.88rem' }}>
            {result.possibleDrugSideEffects.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong>{s.drug}</strong>: {s.note}{' '}
                <em>({s.advice})</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* #6 Symptom progression */}
      {result.progression && result.progression.trend !== 'unknown' && (
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          background: result.progression.trend === 'worsening' ? '#fef2f2' : '#f0fdf4',
          color: result.progression.trend === 'worsening' ? '#991b1b' : '#166534',
          border: `1px solid ${result.progression.trend === 'worsening' ? '#fecaca' : '#bbf7d0'}`,
          marginBottom: '12px', fontSize: '0.88rem',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          {result.progression.trend === 'worsening' ? <TrendingUp size={18} /> :
            result.progression.trend === 'improving' ? <TrendingDown size={18} /> :
            <Activity size={18} />}
          <div>
            <strong style={{ textTransform: 'capitalize' }}>Trend: {result.progression.trend}</strong>
            {result.progression.explanation && <span> — {result.progression.explanation}</span>}
          </div>
        </div>
      )}

      {/* #11 Image-kind extracted lab values */}
      {result.extractedValues && result.extractedValues.length > 0 && (
        <div style={{
          padding: '12px 14px', borderRadius: 'var(--radius-md)',
          background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe',
          marginBottom: '14px',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileBarChart size={16} /> Extracted lab values (AI-read)
          </div>
          <table style={{ width: '100%', fontSize: '0.85rem' }}>
            <tbody>
              {result.extractedValues.map((v, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #dbeafe' }}>
                  <td style={{ padding: '4px 6px' }}>{v.label}</td>
                  <td style={{ padding: '4px 6px', fontWeight: 600 }}>{v.value}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                    {v.isAbnormal && <Badge text="ABNORMAL" variant="high" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.allergyWarnings && result.allergyWarnings.length > 0 && (
        <div style={{
          padding: '12px 14px', borderRadius: 'var(--radius-md)',
          background: 'var(--warning-light)', color: 'var(--warning)',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontWeight: 700 }}>
            <ShieldAlert size={16} /> Allergy warnings
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem' }}>
            {result.allergyWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {result.drugInteractionWarnings && result.drugInteractionWarnings.length > 0 && (
        <div style={{
          padding: '12px 14px', borderRadius: 'var(--radius-md)',
          background: 'var(--error-light)', color: 'var(--error)',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontWeight: 700 }}>
            <Pill size={16} /> Drug-interaction warnings
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem' }}>
            {result.drugInteractionWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {result.visibleFindings && result.visibleFindings.length > 0 && (
        <div style={{
          padding: '12px 14px', borderRadius: 'var(--radius-md)',
          background: 'var(--accent-light)', color: 'var(--accent)',
          marginBottom: '14px',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>Visible findings (image)</div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem' }}>
            {result.visibleFindings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
        Recommended specialties ({result.results.length})
      </h3>
      {result.results.map((item, idx) => (
        <div key={idx} className={`result-card urgency-${item.urgency}`} style={{ animationDelay: `${idx * 0.1}s` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{item.specialty}</h4>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {typeof item.confidence === 'number' && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {Math.round(item.confidence * 100)}%
                </span>
              )}
              <Badge text={item.urgency.toUpperCase()} variant={urgencyVariant(item.urgency)} />
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{item.suggestions}</p>
          {/* #2 Demographic note */}
          {item.demographicNote && (
            <p style={{ marginTop: 6, fontSize: '0.82rem', color: '#475569', fontStyle: 'italic' }}>
              <UserCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {item.demographicNote}
            </p>
          )}
          {item.matchedKeywords && item.matchedKeywords.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {item.matchedKeywords.map((kw, i) => (
                <span key={i} style={{
                  padding: '3px 8px', fontSize: '0.75rem', borderRadius: '10px',
                  background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)',
                }}>
                  {kw}
                </span>
              ))}
            </div>
          )}
          {/* #13 ICD-10 codes */}
          {item.icd10Codes && item.icd10Codes.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {item.icd10Codes.map((c, i) => (
                <span
                  key={i}
                  title={c.description}
                  style={{
                    padding: '3px 8px', fontSize: '0.7rem', borderRadius: 6,
                    background: '#e0e7ff', color: '#3730a3', fontWeight: 600,
                    fontFamily: 'monospace',
                  }}
                >
                  ICD-10 {c.code}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {result.recommendedDoctors && result.recommendedDoctors.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
            Suggested doctors near you
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.recommendedDoctors.map((d) => {
              // #9 Auto-book deep-link — pre-fill the booking form with the
              // symptom check's reason + back-link via fromCheckId.
              const reason = result.aiSummary || (result.results[0]?.specialty ? `Symptom-checker referral: ${result.results[0].specialty}` : 'Symptom-checker referral');
              const params = new URLSearchParams({ reason });
              if (result.checkId) params.set('fromCheckId', result.checkId);
              return (
                <div key={d.doctorId} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', background: 'var(--bg-main)',
                  borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: '10px',
                }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{d.name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {d.specialty} · {d.consultationFee ? `LKR ${d.consultationFee}` : 'fee on request'}
                      {d.nextSlot ? ` · next: ${d.nextSlot}` : ''}
                    </div>
                  </div>
                  <Link
                    href={`/appointment/book/${d.doctorId}?${params.toString()}`}
                    className="med-button primary sm"
                    style={{ textDecoration: 'none' }}
                  >
                    Book {d.specialty}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* #14 PDF download for this check */}
      {result.checkId && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            onClick={async () => {
              try {
                await symptomApi.downloadCheckPdf(result.checkId!);
              } catch (err: any) {
                showToast(err.message || 'Failed to download PDF', 'error');
              }
            }}
            className="med-button secondary sm"
            style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
          >
            <Download size={14} /> Download PDF report
          </button>
        </div>
      )}

      {(result.disclaimers && result.disclaimers.length > 0) ? (
        <details style={{
          marginTop: '20px', padding: '12px 14px',
          background: '#fffbeb', borderRadius: 'var(--radius-sm)', border: '1px solid #fde68a',
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#92400e', fontSize: '0.9rem' }}>
            Important information ({result.disclaimers.length})
          </summary>
          <ul style={{ margin: '10px 0 0', paddingLeft: '20px' }}>
            {result.disclaimers.map((d, i) => (
              <li key={i} style={{ fontSize: '0.85rem', color: '#78350f', lineHeight: 1.55, marginBottom: '6px' }}>
                {d.text}
              </li>
            ))}
          </ul>
          {result.followUpAt && (
            <p style={{ marginTop: '10px', fontSize: '0.82rem', color: '#78350f' }}>
              We&apos;ll send you a follow-up reminder on{' '}
              <strong>{new Date(result.followUpAt).toLocaleString()}</strong>.
            </p>
          )}
        </details>
      ) : result.disclaimer ? (
        <div style={{ marginTop: '20px', padding: '12px 14px', background: '#fffbeb', borderRadius: 'var(--radius-sm)', border: '1px solid #fde68a' }}>
          <p style={{ fontSize: '0.85rem', color: '#92400e', fontStyle: 'italic', margin: 0 }}>{result.disclaimer}</p>
        </div>
      ) : null}

      {result.checkId && <FeedbackWidget checkId={result.checkId} />}
    </Card>
  );
}

// A4: inline feedback widget — three quick options, no modal.
function FeedbackWidget({ checkId }: { checkId: string }) {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const submit = async (type: 'correct' | 'false-positive' | 'false-negative') => {
    setSubmitting(type);
    try {
      await symptomApi.submitFeedback(checkId, { type });
      setSubmitted(type);
      showToast('Thanks — your feedback helps us improve.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to submit feedback', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  if (submitted) {
    return (
      <div style={{
        marginTop: '14px', padding: '10px 12px',
        background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
        fontSize: '0.85rem', color: '#065f46',
      }}>
        Thanks for your feedback!
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '16px', padding: '12px 14px',
      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
        Was this analysis useful?
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => submit('correct')}
          disabled={submitting !== null}
          className="med-button secondary sm"
          style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
        >
          <ThumbsUp size={14} /> Looks right
        </button>
        <button
          onClick={() => submit('false-positive')}
          disabled={submitting !== null}
          className="med-button secondary sm"
          style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
        >
          <ThumbsDown size={14} /> Over-reacted
        </button>
        <button
          onClick={() => submit('false-negative')}
          disabled={submitting !== null}
          className="med-button secondary sm"
          style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
        >
          <AlertCircle size={14} /> Missed something serious
        </button>
      </div>
    </div>
  );
}
