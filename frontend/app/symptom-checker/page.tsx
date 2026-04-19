'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { symptomApi } from '../services/api';
import { Card, Button, Badge, showToast, Tabs } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import {
  Stethoscope, Hourglass, Search, Brain, AlertTriangle, FileText, Camera,
  MessageCircle, Send, ImagePlus, Pill, ShieldAlert, UserCheck, X,
} from 'lucide-react';

const commonSymptoms = [
  'Headache', 'Fever', 'Cough', 'Sore throat', 'Chest pain',
  'Shortness of breath', 'Nausea', 'Stomach pain', 'Rash',
  'Joint pain', 'Back pain', 'Dizziness', 'Fatigue',
  'Blurred vision', 'Anxiety', 'Insomnia', 'Wheezing',
  'Frequent urination', 'Ear pain', 'Numbness',
];

interface AnalyzeResult {
  results: Array<{
    specialty: string;
    suggestions: string;
    urgency: string;
    matchedKeywords?: string[];
    confidence?: number;
  }>;
  overallUrgency: string;
  overallConfidence?: number;
  aiSummary?: string;
  drugInteractionWarnings?: string[];
  allergyWarnings?: string[];
  recommendedDoctors?: Array<{
    doctorId: string;
    name: string;
    specialty: string;
    consultationFee?: number;
    nextSlot?: string | null;
  }>;
  contextUsed?: boolean;
  visibleFindings?: string[];
  disclaimer?: string;
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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  // ── Image analysis state ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDescription, setImageDescription] = useState('');
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
                  <label className="med-label">Describe your symptoms</label>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <Badge text={(item.overallUrgency || 'low').toUpperCase()} variant={urgencyVariant(item.overallUrgency)} />
                      <small style={{ color: 'var(--text-muted)' }}>
                        {new Date(item.timestamp || item.createdAt).toLocaleString()}
                      </small>
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

        {result.aiSummary && (
          <div style={{ padding: '14px', background: 'rgba(15, 82, 186, 0.06)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary)' }}>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
              <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }} />
              <strong>AI Insights:</strong> {result.aiSummary}
            </p>
          </div>
        )}
      </div>

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
        </div>
      ))}

      {result.recommendedDoctors && result.recommendedDoctors.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
            Suggested doctors near you
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.recommendedDoctors.map((d) => (
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
                  href={`/appointment/book/${d.doctorId}`}
                  className="med-button primary sm"
                  style={{ textDecoration: 'none' }}
                >
                  Book
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.disclaimer && (
        <div style={{ marginTop: '20px', padding: '12px 14px', background: '#fffbeb', borderRadius: 'var(--radius-sm)', border: '1px solid #fde68a' }}>
          <p style={{ fontSize: '0.85rem', color: '#92400e', fontStyle: 'italic', margin: 0 }}>{result.disclaimer}</p>
        </div>
      )}
    </Card>
  );
}
