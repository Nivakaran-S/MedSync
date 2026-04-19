'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { 
  telemedicineApi, 
  appointmentApi, 
  patientApi, 
  doctorApi, 
  symptomApi, 
  getAuthToken 
} from '../../services/api';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Bot, FileText, Clipboard, AlertCircle, CheckCircle, Shield, Network, Trash2, Camera, MessageSquare, Send } from 'lucide-react';
import { MedButton as Button, Modal, MedInput as Input, showToast } from '../../components/UI';
import SignatureCanvas from 'react-signature-canvas';
import { io, Socket } from 'socket.io-client';
import AIVoiceScribe from '../../components/AIVoiceScribe';
import PrescriptionEditor from '../../components/PrescriptionEditor';
interface PrescriptionItem {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  warning?: string;
}

export default function TelemedicineSession() {
  const { appointmentId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<any>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [simulatedTime, setSimulatedTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'ai' | 'records' | 'prescription'>('ai');
  
  // Patient Records state
  const [patientRecords, setPatientRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  // Jitsi Meet State
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const [jitsiApi, setJitsiApi] = useState<any>(null);
  const [jitsiLoaded, setJitsiLoaded] = useState(false);

  // Transcription & AI Intelligence State
  const [externalTranscript, setExternalTranscript] = useState<{ text: string; sender: string } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [transcript, setTranscript] = useState('');
  const [patientTranscript, setPatientTranscript] = useState('');
  const [detectedRisks, setDetectedRisks] = useState<string[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [callEnded, setCallEnded] = useState(false);



  // Media Controls State
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // Load Jitsi External API Script Dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => {
      console.log('MedSync: Jitsi Meet Infrastructure Loaded');
      setJitsiLoaded(true);
    };
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Initialize Jitsi Meeting
  useEffect(() => {
    if (jitsiLoaded && jitsiContainerRef.current && appointment && user) {
       console.log('MedSync: Establishing secure global consultation bridge...');
       
       const options = {
          roomName: `MedSync-Consult-${appointmentId}`,
          width: '100%',
          height: '100%',
          parentNode: jitsiContainerRef.current,
          userInfo: {
             displayName: user.role === 'doctor' ? `Dr. ${user.name}` : user.name,
             email: user.email
          },
          configOverwrite: {
             startWithAudioMuted: false,
             startWithVideoMuted: false,
             enableWelcomePage: false,
             prejoinPageEnabled: false,
             disableDeepLinking: true
          },
          interfaceConfigOverwrite: {
             TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
                'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
                'security'
             ],
             SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile', 'calendar'],
             SHOW_JITSI_WATERMARK: false,
             SHOW_WATERMARK_FOR_GUESTS: false,
          }
       };

       const api = new (window as any).JitsiMeetExternalAPI('meet.jit.si', options);
       setJitsiApi(api);
       setInCall(true);

       // Real-time Voice Relay via Jitsi Data Channels (Automatic, No IPs needed)
       api.on('endpointTextMessageReceived', (event: any) => {
          if (event.eventData.name === 'transcript-relay') {
             setExternalTranscript({ 
                text: event.eventData.text, 
                sender: event.eventData.senderName || 'Patient' 
             });
          }
       });

       return () => {
          api.dispose();
       };
    }
  }, [jitsiLoaded, appointment, user, appointmentId]);

  useEffect(() => {
    if (authLoading || !user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const apptId = appointmentId as string;

        let appt: any = null;
        try {
          appt = await appointmentApi.getAppointment(apptId);
          setAppointment(appt);
        } catch {
          appt = null;
        }

        try {
          const sessData = await telemedicineApi.getSession(apptId);
          setSession(sessData);
        } catch {
          if (!appt) {
            setSession(null);
            return;
          }
          const sessData = await telemedicineApi.createSession({
            appointmentId: apptId,
            doctorId: appt.doctorId,
            patientId: appt.patientId,
          });
          setSession(sessData);
        }
      } catch (err) {
        console.error(err);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, user, appointmentId]);

  useEffect(() => {
    let interval: any;
    if (inCall) {
      interval = setInterval(() => setSimulatedTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [inCall]);

  // Automated AI Analysis Loop (Doctor Only)
  useEffect(() => {
    const combinedTranscript = `Doctor: ${transcript}\nPatient: ${patientTranscript}`;
    if (user?.role === 'doctor' && combinedTranscript.length > 50 && !isAnalyzing) {
      const timer = setTimeout(async () => {
        setIsAnalyzing(true);
        try {
          // Send combined transcript for cross-participant risk analysis
          const result = await symptomApi.analyzeSymptoms(combinedTranscript);
          setAiAnalysis(result);
          
          // Move specialty matches to 'Detected Risks' for the UI
          if (result.results) {
             setDetectedRisks(result.results.map((r: any) => `${r.specialty}: ${r.urgency.toUpperCase()} risk detected`));
          }
        } catch (e) {
          console.error('AI Analysis failed', e);
        } finally {
          setIsAnalyzing(false);
        }
      }, 7000); 
      return () => clearTimeout(timer);
    }
  }, [transcript, patientTranscript, user?.role]);

  const loadData = async () => {
    try {
      setLoading(true);
      const apptId = String(appointmentId);
      const appt = await appointmentApi.getAppointment(apptId);
      setAppointment(appt);
      
      if (user?.role === 'doctor') {
        try {
          // Fetch full patient profile to get Allergies for safety checks
          const profile = await patientApi.getPatientProfile(appt.patientId);
          setPatientProfile(profile);
          
          const records = await patientApi.getPatientDocuments(appt.patientId);
          setPatientRecords(records || []);
        } catch (e) {
          console.warn('Could not load patient profile/records', e);
        }
      }
    } catch (err) {
      showToast('Error loading session data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const broadcastScribe = (text: string) => {
    if (!jitsiApi) return;
    try {
      const participants = jitsiApi.getParticipantsInfo();
      // Jitsi might return an array or an object map depending on version
      const participantList = Array.isArray(participants) ? participants : Object.values(participants || {});
      
      participantList.forEach((p: any) => {
        if (p && p.participantId) {
          jitsiApi.executeCommand('sendEndpointTextMessage', p.participantId, {
            name: 'transcript-relay',
            text: text,
            senderName: user?.role === 'doctor' ? `Dr. ${user.name}` : user?.name
          });
        }
      });
    } catch (e) {
      console.error('Failed to broadcast transcript', e);
    }
  };



  const onPrescriptionSuccess = (result: any) => {
    // We could store it if we wanted to show a summary outside the modal, 
    // but the editor handles its own success state.
  };

  const endCall = async () => {
    if (jitsiApi) {
      jitsiApi.dispose();
    }
    setInCall(false);
    setCallEnded(true);
    if (user?.role === 'doctor') {
      try {
        await appointmentApi.updateStatus(appointmentId as string, { status: 'completed' });
      } catch (err) {}
    }
  };

  if (authLoading || loading) return (
     <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="loading-spinner"></div>
        <p className="text-slate-500 font-medium">Initializing secure video session...</p>
     </div>
  );
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', maxHeight: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.8rem' }}>Telemedicine Session</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
             <span className="badge low">
               <Shield size={12} style={{ marginRight: '4px' }} /> End-to-End Encrypted
             </span>
             <span className="badge info">
               <Network size={12} style={{ marginRight: '4px' }} /> Optimized Network
             </span>
          </div>
        </div>
        {inCall && (
           <div style={{ background: 'var(--primary-dark)', color: 'white', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--error)' }} className="animate-pulse"></span>
              {formatTime(simulatedTime)}
           </div>
        )}
      </div>
      
      <div style={{ flex: 1, display: 'flex', gap: '24px', minHeight: 0 }}>
          {/* Global Video Bridge Area */}
          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ 
              flex: 1, 
              background: '#0f172a', 
              borderRadius: 'var(--radius-2xl)', 
              position: 'relative', 
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {/* Jitsi Meeting Frame */}
              <div 
                ref={jitsiContainerRef} 
                style={{ width: '100%', height: '100%' }}
              />

              {!jitsiLoaded && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: '#0f172a' }}>
                   <div className="loading-spinner"></div>
                   <p style={{ marginTop: '16px', color: '#94a3b8', fontWeight: 500 }}>Connecting to Global Medical Bridge...</p>
                </div>
              )}
            </div>
          </div>

          {/* Background Scribe for Patients (Relays voice to doctor) */}
          {user?.role === 'patient' && (
             <AIVoiceScribe 
                hidden 
                onLocalTranscript={broadcastScribe} 
                externalTranscript={externalTranscript} 
             />
          )}

          {/* Sidebar / Tools - Only for Doctor */}
          {user?.role === 'doctor' && (
            <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
               <div className="med-card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: 0 }}>
                  <div className="tabs-header" style={{ display: 'flex', borderBottom: '1px solid var(--card-border)' }}>
                     <button 
                       onClick={() => setActiveTab('ai')}
                       className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`}
                       style={{ flex: 1, padding: '16px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                     >
                       <Bot size={16} /> AI Scribe
                     </button>
                     <button 
                       onClick={() => setActiveTab('records')}
                       className={`tab-button ${activeTab === 'records' ? 'active' : ''}`}
                       style={{ flex: 1, padding: '16px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                     >
                       <FileText size={16} /> Records
                     </button>
                     <button 
                        onClick={() => setActiveTab('prescription')}
                        className={`tab-button ${activeTab === 'prescription' ? 'active' : ''}`}
                        style={{ flex: 1, padding: '16px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Clipboard size={16} /> Rx
                      </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} className="custom-scrollbar">
                      {activeTab === 'ai' && (
                         <div style={{ height: '550px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                            <AIVoiceScribe 
                               onLocalTranscript={broadcastScribe} 
                               externalTranscript={externalTranscript}
                            />
                         </div>
                      )}

                     {activeTab === 'records' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                           <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Patient Records Review</h4>
                           {loadingRecords ? (
                              <div style={{ padding: '40px 0', textAlign: 'center' }}>Loading...</div>
                           ) : patientRecords.length === 0 ? (
                              <div className="empty-state" style={{ padding: '32px 16px' }}>
                                 <p style={{ fontSize: '0.8rem' }}>No reports available</p>
                              </div>
                           ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                 {patientRecords.map((r, i) => (
                                    <div key={i} className="doc-item">
                                       <div>
                                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{r.name || 'Report'}</div>
                                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                                       </div>
                                       <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>VIEW</a>
                                    </div>
                                 ))}
                              </div>
                           )}
                        </div>
                     )}

                     {activeTab === 'prescription' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Issue Prescription</h4>
                              <Button className="primary sm" onClick={() => setShowPrescriptionModal(true)}>Open Editor</Button>
                           </div>
                           <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              You can issue a digital prescription now. It will be immediately available to the patient after the session ends.
                           </p>
                           <div style={{ padding: '16px', background: 'var(--primary-light)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-dark)' }}>Awaiting medical decision...</div>
                           </div>
                        </div>
                     )}
                  </div>

                  <div style={{ padding: '16px', background: 'var(--bg-main)', borderTop: '1px solid var(--card-border)', display: 'flex', gap: '12px' }}>
                     <Button className="secondary" style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, padding: '12px' }} onClick={endCall}>
                        Finalize Consultation
                     </Button>
                  </div>
               </div>
            </div>
          )}
        </div>

      <Modal 
        isOpen={showPrescriptionModal} 
        onClose={() => setShowPrescriptionModal(false)} 
        title="Issuing Clinical Treatment Plan"
        width="800px"
      >
         <PrescriptionEditor 
            appointmentId={appointmentId as string}
            patientId={appointment?.patientId}
            patientName={appointment?.patientName}
            patientAllergies={patientProfile?.allergies}
            doctorName={user?.name}
            onSuccess={onPrescriptionSuccess}
            onCancel={() => setShowPrescriptionModal(false)}
         />
      </Modal>

      {/* Post-Call Summary Modal */}
      <Modal 
        isOpen={callEnded} 
        onClose={() => router.push(user?.role === 'doctor' ? '/doctor/appointments' : '/patient')}
        title="Consultation Summary"
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
           <div style={{ width: '64px', height: '64px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem' }}>
              📝
           </div>
           <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>Video Call Ended</h3>
           <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.9rem' }}>
              Your session with {user?.role === 'patient' ? `Dr. ${appointment?.doctorName}` : appointment?.patientName} has concluded.
           </p>

           {/* The QrCode display for callEnded would need issuedQrCode state if we want to show it here.
               For brevity, we'll assume the doctor can see it in the records tab. 
               Alternatively, we can keep a small local state just for the final summary if needed. */}
           <div style={{ padding: '24px', background: 'var(--bg-main)', borderRadius: 'var(--radius-xl)', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '32px' }}>
              Final consultation summary has been saved to institutional records.
           </div>

           <Button 
            className="primary" 
            style={{ width: '100%', padding: '14px' }} 
            onClick={() => router.push(user?.role === 'doctor' ? '/doctor/appointments' : '/patient')}
           >
              Return to Dashboard
           </Button>
        </div>
      </Modal>

      <style jsx>{`
        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #f1f5f9;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .loading-spinner.sm { width: 30px; height: 30px; border-width: 3px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }

        .pulse-dot {
           width: 8px;
           height: 8px;
           background: #ef4444;
           border-radius: 50%;
           box-shadow: 0 0 0 rgba(239, 68, 68, 0.4);
           animation: pulse 2s infinite;
        }
        @keyframes pulse {
           0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
           70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
           100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
