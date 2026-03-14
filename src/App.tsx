import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import Markdown from 'react-markdown';
import { AlertTriangle, Activity, Info, MapPin, MessageSquare, Phone, Send, User, Stethoscope, ShieldAlert, Ambulance, ShieldPlus, HeartPulse, ThumbsUp, ThumbsDown, CheckCircle2, Shield, Clock, Lock, Unlock, X, LogIn, LogOut, Mic, Video, Heart, IndianRupee, Menu, ChevronRight, HelpCircle, ChevronDown, Mail } from 'lucide-react';
import { hospitals, blocks, Block } from './data/hospitals';
import AdminApp from './AdminApp';
import AIChatbot from './AIChatbot';
import AuthModal from './components/AuthModal';
import LiveAudioChat from './components/LiveAudioChat';
import JitsiMeeting from './components/JitsiMeeting';
import DonationReceipt from './components/DonationReceipt';
import { TriageLevel, ChatMessage, TriageRecord, WhatsAppMessage, TelemedRequest } from './types';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, doc, setDoc, updateDoc, Timestamp, getDocFromServer, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestoreUtils';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const QUICK_SYMPTOMS = [
  "High Fever & Chills (à¤¤à¥‡à¤œ à¤¬à¥à¤–à¤¾à¤°)",
  "Snake Bite (à¤¸à¤¾à¤‚à¤ª à¤•à¤¾à¤Ÿà¤¨à¤¾)",
  "Pregnancy Pain (à¤—à¤°à¥à¤­à¤¾à¤µà¤¸à¥à¤¥à¤¾ à¤®à¥‡à¤‚ à¤¦à¤°à¥à¤¦)",
  "Severe Chest Pain (à¤›à¤¾à¤¤à¥€ à¤®à¥‡à¤‚ à¤¦à¤°à¥à¤¦)",
  "Continuous Cough (à¤²à¤—à¤¾à¤¤à¤¾à¤° à¤–à¤¾à¤‚à¤¸à¥€)"
];

const AMBULANCES = [
  { name: "National Ambulance Service (Govt)", number: "102", type: "Free / Govt", available: "24/7" },
  { name: "Sadar Hospital Emergency Van", number: "06337-229382", type: "Govt", available: "24/7" },
  { name: "Jeevan Rakshak Ambulance (Private)", number: "+91-9876543210", type: "Private (Paid)", available: "24/7" },
  { name: "Arwal Block Quick Response", number: "+91-8765432109", type: "Govt", available: "Daytime" }
];

const SCHEMES = [
  { 
    name: "Ayushman Bharat (PM-JAY)", 
    desc: "Free health insurance coverage up to â‚¹5 Lakhs per family per year for secondary and tertiary care hospitalization.",
    eligibility: "BPL families, SECC 2011 listed."
  },
  { 
    name: "Janani Suraksha Yojana (JSY)", 
    desc: "Cash assistance to pregnant women for institutional delivery to reduce maternal and neonatal mortality.",
    eligibility: "Pregnant women delivering in Govt health centers."
  },
  { 
    name: "Mukhyamantri Chikitsa Sahayata Kosh", 
    desc: "Financial assistance for the treatment of severe/life-threatening diseases like Cancer, Heart Disease, etc.",
    eligibility: "Residents of Bihar with income below a specified threshold."
  }
];

export default function App() {
  const [appMode, setAppMode] = useState<'patient' | 'admin'>('patient');
  const [activeTab, setActiveTab] = useState<'triage' | 'locator' | 'analytics' | 'ambulance' | 'schemes' | 'telemed' | 'donation' | 'about' | 'help'>('triage');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<Block>('Arwal');
  
  // Donation State
  const [donationAmount, setDonationAmount] = useState<number>(30);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{ transactionId: string; date: string } | null>(null);
  
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Triage State
  const [symptomInput, setSymptomInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDoctorChat, setShowDoctorChat] = useState(false);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  
  // Admin Records State
  const [triageRecords, setTriageRecords] = useState<TriageRecord[]>([]);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');
  
  // WhatsApp State
  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [whatsappInput, setWhatsappInput] = useState('');
  const whatsappEndRef = useRef<HTMLDivElement>(null);

  // Telemed State
  const [activeTelemedRequest, setActiveTelemedRequest] = useState<TelemedRequest | null>(null);
  const [isRequestingTelemed, setIsRequestingTelemed] = useState(false);
  const [showEmbeddedMeeting, setShowEmbeddedMeeting] = useState(false);
  const [telemedProblem, setTelemedProblem] = useState('');

  // Help & Contact State
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingEmail(true);
    setEmailStatus(null);

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });

      const data = await response.json();
      if (response.ok) {
        setEmailStatus({ type: 'success', message: data.message || 'Message sent successfully!' });
        setContactForm({ name: '', email: '', subject: '', message: '' });
      } else {
        setEmailStatus({ type: 'error', message: data.error || 'Failed to send message.' });
      }
    } catch (error) {
      setEmailStatus({ type: 'error', message: 'An error occurred. Please try again.' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const FAQS = [
    {
      q: "How does the AI Triage work?",
      a: "Our AI Triage uses advanced medical language models to analyze your symptoms. Simply describe how you feel, and it will provide a preliminary assessment (Emergency, Urgent, or General) and guide you on the next steps."
    },
    {
      q: "Is the AI diagnosis final?",
      a: "No. The AI provides a preliminary triage based on common medical patterns. It is NOT a replacement for a professional medical diagnosis. Always consult a qualified doctor for medical advice."
    },
    {
      q: "How do I find the nearest hospital?",
      a: "Use the 'Resource Locator' tab. You can filter by your local block in Arwal to see a list of nearby hospitals, sub-centers, and pharmacies with their contact details."
    },
    {
      q: "Can I talk to a real doctor?",
      a: "Yes. If the AI determines your case is urgent, it may suggest a 'Live Doctor Consult'. You can also go directly to that tab to request a video consultation with an available medical professional."
    },
    {
      q: "How can I support this initiative?",
      a: "You can support us through the 'Support Us' tab by making a small donation via UPI. These funds are used to maintain the platform and improve local health infrastructure."
    }
  ];

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'test/connection');
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Create or update user profile in Firestore
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDocFromServer(userRef);
          if (!userDoc.exists()) {
            const isAdminEmail = currentUser.email === 'kumaripummy04@gmail.com' || currentUser.email === 'magadhwalahai@gmail.com' || currentUser.uid === 'o1w0p5NtoZQYHMjCMGHC319W1z32';
            console.log(`Creating user document. Email: ${currentUser.email}, UID: ${currentUser.uid}, IsAdmin: ${isAdminEmail}`);
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: isAdminEmail ? 'admin' : 'patient',
              createdAt: Timestamp.now()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'users');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) {
      setTriageRecords([]);
      return;
    }

    const q = query(
      collection(db, 'triageRecords'), 
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: TriageRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        records.push({
          id: doc.id,
          userId: data.userId,
          timestamp: data.timestamp.toDate(),
          symptom: data.symptom,
          triageLevel: data.triageLevel,
          explanation: data.explanation,
          feedback: data.feedback
        });
      });
      setTriageRecords(records);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'triageRecords');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setActiveTelemedRequest(null);
      return;
    }

    const q = query(
      collection(db, 'telemedRequests'),
      where('patientId', '==', user.uid),
      where('status', 'in', ['waiting', 'in-progress']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        setActiveTelemedRequest({
          id: doc.id,
          patientId: data.patientId,
          patientName: data.patientName,
          problem: data.problem,
          meetingId: data.meetingId,
          status: data.status,
          createdAt: data.createdAt.toDate(),
          doctorId: data.doctorId,
          scheduledJoinTime: data.scheduledJoinTime?.toDate()
        });
      } else {
        setActiveTelemedRequest(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'telemedRequests');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    whatsappEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [whatsappMessages]);

  const handleOpenWhatsApp = () => {
    setShowWhatsAppChat(true);
    if (whatsappMessages.length === 0) {
      setWhatsappMessages([
        { id: '1', text: 'Hello, this is Dr. Sharma from Sadar Hospital. I see you have an emergency. How can I help you right now?', sender: 'doctor', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
      ]);
    }
  };

  const handleSendWhatsApp = () => {
    if (!whatsappInput.trim()) return;
    const newMsg: WhatsAppMessage = {
      id: Date.now().toString(),
      text: whatsappInput,
      sender: 'user',
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
    setWhatsappMessages(prev => [...prev, newMsg]);
    setWhatsappInput('');

    // Simulate doctor reply
    setTimeout(() => {
      setWhatsappMessages(prev => [...prev, {
        id: Date.now().toString() + 'doc',
        text: 'Please stay calm. An ambulance is being dispatched if needed. Can you provide your exact location?',
        sender: 'doctor',
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }]);
    }, 2000);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = (import.meta as any).env.VITE_ADMIN_PASSWORD || 'admin123';
    if (adminPasswordInput === correctPassword) {
      setIsAdminAuthenticated(true);
      setAdminError('');
    } else {
      setAdminError('Invalid credentials. Access denied.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setAdminPasswordInput('');
  };

  const handleRequestTelemed = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    
    setIsRequestingTelemed(true);
    try {
      const meetingId = `HealthyBihar_Consult_${Math.floor(Math.random() * 1000000)}`;
      await addDoc(collection(db, 'telemedRequests'), {
        patientId: user.uid,
        patientName: user.displayName || 'Anonymous Patient',
        problem: telemedProblem,
        meetingId: meetingId,
        status: 'waiting',
        createdAt: Timestamp.now()
      });
      setTelemedProblem('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'telemedRequests');
    } finally {
      setIsRequestingTelemed(false);
    }
  };

  const handleCancelTelemed = async () => {
    if (!activeTelemedRequest) return;
    try {
      await updateDoc(doc(db, 'telemedRequests', activeTelemedRequest.id), {
        status: 'completed'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'telemedRequests');
    }
  };

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'helpful' | 'not_helpful') => {
    setChatHistory(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback } : msg
    ));
    
    if (user) {
      try {
        const recordRef = doc(db, 'triageRecords', messageId);
        await updateDoc(recordRef, { feedback });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'triageRecords');
      }
    }
  };

  const handleAnalyzeSymptom = async (overrideMsg?: string) => {
    if (!user) {
      alert("Please sign in to use the AI Triage.");
      return;
    }

    const userMsg = overrideMsg || symptomInput;
    if (!userMsg.trim()) return;

    const userMsgId = Date.now().toString() + Math.random().toString(36).substring(7);
    setChatHistory(prev => [...prev, { id: userMsgId, role: 'user', text: userMsg }]);
    if (!overrideMsg) setSymptomInput('');
    setIsAnalyzing(true);

    try {
      const aiMsgId = Date.now().toString() + Math.random().toString(36).substring(7);
      
      // Add an empty AI message to the chat history that we will update
      setChatHistory(prev => [...prev, { 
        id: aiMsgId,
        role: 'ai', 
        text: '',
        isStreaming: true,
        triageLevel: undefined
      }]);

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the following medical symptom reported by a patient in Bihar (could be in Hindi, English, or Magahi). 
        First, determine the triage level as either 'Emergency', 'Urgent', or 'General'. 
        Start your response EXACTLY with this format on the first line: [Triage: LEVEL] (where LEVEL is Emergency, Urgent, or General).
        Then, on the next line, provide a brief, empathetic explanation in the language the user used, advising them on what to do.
        Symptom: "${userMsg}"`,
      });

      let fullContent = '';
      let triageLevel: TriageLevel | undefined = undefined;
      let displayContent = '';

      for await (const chunk of responseStream) {
        const c = chunk as any;
        if (c.text) {
          fullContent += c.text;
          
          // Try to extract the triage level if we haven't yet
          if (!triageLevel) {
            const match = fullContent.match(/\[Triage:\s*(Emergency|Urgent|General)\]/i);
            if (match) {
              triageLevel = match[1] as TriageLevel;
              // Remove the triage tag from the display content
              displayContent = fullContent.replace(/\[Triage:\s*(Emergency|Urgent|General)\]/i, '').trim();
            } else {
              // If we don't have a match yet, just show what we have (might look weird briefly, but usually it's fast)
              displayContent = fullContent;
            }
          } else {
            displayContent = fullContent.replace(/\[Triage:\s*(Emergency|Urgent|General)\]/i, '').trim();
          }

          setChatHistory(prev => prev.map(msg => 
            msg.id === aiMsgId ? { ...msg, text: displayContent, triageLevel } : msg
          ));
        }
      }
      
      setChatHistory(prev => prev.map(msg => 
        msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
      ));
      setIsAnalyzing(false);

      // Save to Firestore after streaming is complete
      try {
        await setDoc(doc(db, 'triageRecords', aiMsgId), {
          userId: user.uid,
          timestamp: Timestamp.now(),
          symptom: userMsg,
          triageLevel: triageLevel || 'General',
          explanation: displayContent,
          feedback: null
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'triageRecords');
      }
      
      if (triageLevel === 'Emergency') {
        setShowDoctorChat(true);
      }

    } catch (error) {
      console.error("Error analyzing symptom:", error);
      const errorMsgId = Date.now().toString() + Math.random().toString(36).substring(7);
      setChatHistory(prev => [...prev, { 
        id: errorMsgId,
        role: 'ai', 
        text: "I'm sorry, I encountered an error analyzing your symptoms. Please try again or seek immediate medical help if you feel unwell.",
        isStreaming: false,
        triageLevel: 'General'
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Analytics Data Prep
  const analyticsData = blocks.map(block => {
    const blockHospitals = hospitals.filter(h => h.block === block);
    const totalDoctors = blockHospitals.reduce((sum, h) => sum + h.doctors, 0);
    const totalStaff = blockHospitals.reduce((sum, h) => sum + h.staff, 0);
    return {
      name: block,
      Doctors: totalDoctors,
      Staff: totalStaff,
      Facilities: blockHospitals.length
    };
  });

  // Locator Data Prep
  const localFacilities = hospitals
    .filter(h => h.block === selectedBlock)
    .sort((a, b) => b.doctors - a.doctors) // Sort by most doctors first
    .slice(0, 3); // Top 3

  if (appMode === 'admin') {
    return (
      <AdminApp 
        triageRecords={triageRecords}
        analyticsData={analyticsData}
        isAdminAuthenticated={isAdminAuthenticated}
        adminPasswordInput={adminPasswordInput}
        setAdminPasswordInput={setAdminPasswordInput}
        adminError={adminError}
        onLogin={handleAdminLogin}
        onLogout={handleAdminLogout}
        onExit={() => setAppMode('patient')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 text-emerald-600">
          <Activity className="w-6 h-6" />
          <span className="font-bold tracking-tight">Healthy Bihar AI</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-50 transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:flex
      `}>
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 text-emerald-600 mb-1">
            <Activity className="w-8 h-8" />
            <h1 className="text-2xl font-bold tracking-tight">Healthy Bihar AI</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium mb-6">Arwal District Health Network</p>
          
          {/* Auth Section */}
          {user ? (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between group">
              <div className="flex items-center gap-3 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="truncate">
                  <p className="text-sm font-bold text-slate-900 truncate">{user.displayName || 'User'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout} 
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl text-sm font-bold transition-all shadow-md shadow-emerald-200 active:scale-95">
              <LogIn className="w-4 h-4" /> Sign In / Register
            </button>
          )}
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-8">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-4 px-2">Navigation</h2>
            <nav className="space-y-1.5">
              {[
                { id: 'triage', label: 'AI Triage', icon: MessageSquare },
                { id: 'locator', label: 'Resource Locator', icon: MapPin },
                { id: 'ambulance', label: 'Ambulance Directory', icon: Ambulance },
                { id: 'telemed', label: 'Live Doctor Consult', icon: Video },
                { id: 'schemes', label: 'Health Schemes', icon: ShieldPlus },
                { id: 'analytics', label: 'District Analytics', icon: BarChart },
                { id: 'donation', label: 'Support Us', icon: Heart },
                { id: 'about', label: 'About Us', icon: Info },
                { id: 'help', label: 'Help & FAQ', icon: HelpCircle },
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100/50' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-emerald-600' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mb-8">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Location Filter</h2>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Block</label>
            <select 
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value as Block)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
            >
              {blocks.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">Filters the Resource Locator tab.</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-amber-800">Disclaimer</h3>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  This is an AI tool and not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider.
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          
          {/* Triage Tab */}
          {activeTab === 'triage' && (
            <div className="max-w-5xl mx-auto h-full flex flex-col">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Multilingual AI Triage</h2>
                  <p className="text-slate-500 mt-1">Describe your symptoms in Hindi, English, or Magahi.</p>
                </div>
                {chatHistory.length > 0 && (
                  <button 
                    onClick={() => {
                      setChatHistory([]);
                      setShowDoctorChat(false);
                    }}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg transition-colors"
                  >
                    New Consultation
                  </button>
                )}
              </div>

              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden mb-4 lg:min-h-[750px]">
                <AIChatbot 
                  inline={true}
                  messages={chatHistory}
                  isLoading={isAnalyzing}
                  onSendMessage={handleAnalyzeSymptom}
                  onClearChat={() => setChatHistory([])}
                  onFeedback={handleFeedback}
                  onVoiceChat={() => setShowVoiceChat(true)}
                  emptyState={
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-6 p-6">
                      <div className="flex flex-col items-center gap-3 mb-4">
                        <div className="bg-emerald-50 p-5 rounded-[2rem] text-emerald-600 shadow-inner border border-emerald-100/50 animate-pulse-slow">
                          <Activity className="w-16 h-16" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Healthy Bihar AI</h2>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Arwal Health Network</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-lg font-bold text-slate-700">How are you feeling today?</p>
                        <p className="text-sm font-medium text-slate-400 italic">(आप कैसा महसूस कर रहे हैं? / रउवा कैसन लगत बा?)</p>
                      </div>
                      
                      <div className="mt-8 w-full max-w-xl bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Select Symptoms</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {QUICK_SYMPTOMS.map((symp, idx) => (
                            <button 
                              key={idx}
                              onClick={() => handleAnalyzeSymptom(symp)}
                              className="bg-white hover:bg-emerald-600 border border-slate-200 hover:border-emerald-600 text-slate-600 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-emerald-200 active:scale-95"
                            >
                              {symp}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  }
                />
              </div>

              {/* Live Doctor Bridge */}
              {showDoctorChat && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-red-100 p-3 rounded-full text-red-600 shrink-0">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-red-800">Emergency Detected</h3>
                      <p className="text-red-700 text-sm mt-1 mb-4">Please contact the Arwal Sadar Hospital immediately.</p>
                      
                      <div className="bg-white border border-red-100 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Sadar Hospital Emergency</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1">06337-229382</p>
                        </div>
                        <a href="tel:06337-229382" className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm">
                          Call Now
                        </a>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-red-200/50">
                        <button onClick={handleOpenWhatsApp} className="text-sm font-medium text-red-700 hover:text-red-800 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Open WhatsApp Consultation
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Locator Tab */}
          {activeTab === 'locator' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Resource Locator</h2>
                <p className="text-slate-500 mt-1">Showing nearest facilities for <span className="font-semibold text-slate-700">{selectedBlock}</span> Block.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {localFacilities.map((facility, idx) => (
                  <div key={facility.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className={`h-2 w-full ${facility.type === 'Sadar Hospital' ? 'bg-blue-500' : facility.type === 'PHC' ? 'bg-emerald-500' : facility.type === 'Private' ? 'bg-purple-500' : 'bg-slate-400'}`}></div>
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-slate-900 text-lg leading-tight">{facility.name}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {facility.type}
                        </span>
                      </div>
                      
                      <div className="mt-auto space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500 flex items-center gap-2"><Stethoscope className="w-4 h-4" /> Doctors</span>
                          <span className="font-semibold text-slate-900">{facility.doctors}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500 flex items-center gap-2"><User className="w-4 h-4" /> Support Staff</span>
                          <span className="font-semibold text-slate-900">{facility.staff}</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.name + ', ' + facility.block + ' Block, Arwal, Bihar')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-2"
                      >
                        <MapPin className="w-4 h-4" /> Get Directions
                      </a>
                    </div>
                  </div>
                ))}
                
                {localFacilities.length === 0 && (
                  <div className="col-span-3 text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                    <Info className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">No facilities found in this block.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ambulance Directory Tab */}
          {activeTab === 'ambulance' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Ambulance Directory</h2>
                <p className="text-slate-500 mt-1">Emergency transport services available in Arwal District.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {AMBULANCES.map((amb, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{amb.name}</h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {amb.type}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Activity className="w-3 h-3" /> {amb.available}
                        </span>
                      </div>
                    </div>
                    <a href={`tel:${amb.number}`} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 p-3 rounded-full transition-colors shrink-0">
                      <Phone className="w-5 h-5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Telemedicine Tab */}
          {activeTab === 'telemed' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Live Doctor Consult</h2>
                <p className="text-slate-500 mt-1">Connect with a real doctor instantly via free video consultation.</p>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center max-w-2xl mx-auto">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Video className="w-10 h-10" />
                </div>
                
                {!activeTelemedRequest ? (
                  <>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">Request a Free Video Consult</h3>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                      Our doctors are available to assist you. Please describe your problem briefly below and click the button to join the waiting room.
                    </p>
                    <div className="mb-6 text-left">
                      <label htmlFor="telemed-problem" className="block text-sm font-semibold text-slate-700 mb-2">
                        What problem are you facing? (à¤†à¤ªà¤•à¥‹ à¤•à¥ à¤¯à¤¾ à¤¸à¤®à¤¸à¥ à¤¯à¤¾ à¤¹à¥ˆ?)
                      </label>
                      <textarea
                        id="telemed-problem"
                        value={telemedProblem}
                        onChange={(e) => setTelemedProblem(e.target.value)}
                        placeholder="Describe your symptoms or health concern..."
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none h-24"
                      />
                    </div>
                    <div className="space-y-4">
                      <button 
                        onClick={handleRequestTelemed}
                        disabled={isRequestingTelemed || !telemedProblem.trim()}
                        className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors w-full sm:w-auto shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                      >
                        {isRequestingTelemed ? 'Requesting...' : (
                          <>
                            <Video className="w-6 h-6" />
                            Request Doctor Consult
                          </>
                        )}
                      </button>
                      <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
                        <Shield className="w-4 h-4" /> Secure & Private Connection
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">
                      {activeTelemedRequest.status === 'waiting' 
                        ? (activeTelemedRequest.scheduledJoinTime ? 'Doctor Joining Soon' : 'Waiting for Doctor...') 
                        : activeTelemedRequest.status === 'rejected' ? 'Request Declined' : 'Doctor is Ready!'}
                    </h3>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                      {activeTelemedRequest.status === 'waiting' 
                        ? (activeTelemedRequest.scheduledJoinTime 
                            ? 'A doctor has scheduled to join your call shortly. Please stay on this page.'
                            : 'Your request has been sent. Please wait here until a doctor accepts your request.')
                        : activeTelemedRequest.status === 'rejected'
                        ? 'Sorry, your request could not be accepted at this time. Please try again later or visit a clinic.'
                        : 'A doctor has accepted your request. Click below to join the video call.'}
                    </p>
                    <div className="space-y-4 flex flex-col items-center">
                      {activeTelemedRequest.status === 'rejected' ? (
                        <button 
                          onClick={handleCancelTelemed}
                          className="inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-8 py-4 rounded-xl font-semibold text-lg transition-colors w-full sm:w-auto"
                        >
                          Dismiss
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              if (activeTelemedRequest.status !== 'waiting') {
                                setShowEmbeddedMeeting(true);
                              }
                            }}
                            className={`inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition-colors w-full sm:w-auto shadow-lg ${
                              activeTelemedRequest.status === 'waiting' 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 animate-pulse'
                            }`}
                          >
                            <Video className="w-6 h-6" />
                            Join Video Call
                          </button>
                          <button 
                            onClick={handleCancelTelemed}
                            className="text-sm text-red-500 hover:text-red-600 font-medium"
                          >
                            Cancel Request
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <Clock className="w-6 h-6 text-emerald-600 mb-3" />
                  <h4 className="font-semibold text-slate-900 mb-1">24/7 Availability</h4>
                  <p className="text-sm text-slate-600">Doctors are available round the clock for emergencies.</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <User className="w-6 h-6 text-emerald-600 mb-3" />
                  <h4 className="font-semibold text-slate-900 mb-1">Verified Doctors</h4>
                  <p className="text-sm text-slate-600">Consult with certified medical professionals from Bihar.</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <Phone className="w-6 h-6 text-emerald-600 mb-3" />
                  <h4 className="font-semibold text-slate-900 mb-1">Free Service</h4>
                  <p className="text-sm text-slate-600">This teleconsultation service is completely free of charge.</p>
                </div>
              </div>
            </div>
          )}

          {/* Health Schemes Tab */}
          {activeTab === 'schemes' && (
            <div className="max-w-4xl mx-auto pb-12">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Government Health Schemes</h2>
                <p className="text-slate-500 mt-1">Financial assistance and healthcare programs available for citizens.</p>
              </div>

              <div className="space-y-4">
                {SCHEMES.map((scheme, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-50 p-3 rounded-full text-blue-600 shrink-0">
                        <HeartPulse className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg">{scheme.name}</h3>
                        <p className="text-slate-600 text-sm mt-2 leading-relaxed">{scheme.desc}</p>
                        <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Eligibility</p>
                          <p className="text-sm text-slate-800">{scheme.eligibility}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="max-w-4xl mx-auto pb-12">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">District Analytics</h2>
                <p className="text-slate-500 mt-1">Staffing levels across Arwal district blocks.</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Medical Staff Distribution</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analyticsData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="Doctors" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      <Bar dataKey="Staff" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                  <p className="text-3xl font-bold text-slate-900">{hospitals.length}</p>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Total Centers</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                  <p className="text-3xl font-bold text-emerald-600">{hospitals.reduce((sum, h) => sum + h.doctors, 0)}</p>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Total Doctors</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                  <p className="text-3xl font-bold text-blue-600">{hospitals.reduce((sum, h) => sum + h.staff, 0)}</p>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Total Staff</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                  <p className="text-3xl font-bold text-purple-600">63</p>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Target Centers</p>
                </div>
              </div>
            </div>
          )}

          {/* Donation Tab */}
          {activeTab === 'donation' && (
            <div className="max-w-4xl mx-auto pb-12">
              <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 text-rose-600 rounded-full mb-4">
                  <Heart className="w-8 h-8 fill-current" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900">Support Arwal Health Network</h2>
                <p className="text-slate-500 mt-2 max-w-lg mx-auto">Your contributions help us maintain and improve healthcare accessibility for the people of Arwal District.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-emerald-600" />
                    Select Donation Amount
                  </h3>

                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[10, 30, 40, 50, 150, 500].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => {
                          setDonationAmount(amount);
                          setShowCustomInput(false);
                        }}
                        className={`py-3 rounded-xl border-2 font-bold transition-all ${
                          !showCustomInput && donationAmount === amount
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50'
                        }`}
                      >
                        ₹{amount}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowCustomInput(true)}
                      className={`py-3 rounded-xl border-2 font-bold transition-all ${
                        showCustomInput
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200'
                          : 'bg-white border-slate-100 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {showCustomInput && (
                    <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Enter Amount (Min ₹10)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          min="10"
                          value={customAmount}
                          onChange={(e) => {
                            setCustomAmount(e.target.value);
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) setDonationAmount(val);
                          }}
                          placeholder="0.00"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-emerald-700 font-medium">Total Contribution</span>
                      <span className="text-xl font-black text-emerald-800">₹{donationAmount < 10 ? '0' : donationAmount}</span>
                    </div>
                    <p className="text-[10px] text-emerald-600 italic">Minimum donation amount is ₹10 as per UPI standards.</p>
                  </div>

                  <div className="mt-8 space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-600">Secure payment via UPI (GPay, PhonePe, Paytm)</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-600">Directly supports local health infrastructure</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-8 rounded-2xl text-center text-white shadow-xl flex flex-col items-center justify-center min-h-[400px]">
                  {donationAmount >= 10 ? (
                    <>
                      <div className="bg-white p-4 rounded-2xl mb-6 shadow-2xl">
                        <QRCodeSVG 
                          value={`upi://pay?pa=imdiwakarsharma@fam&pn=Arwal%20Health%20Network&am=${donationAmount}&cu=INR`}
                          size={200}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                      <h4 className="text-xl font-bold mb-2">Scan to Pay</h4>
                      <p className="text-slate-400 text-sm mb-6">Scan this QR code using any UPI app to complete your donation of ₹{donationAmount}.</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800 px-3 py-2 rounded-full">
                        <Lock className="w-3 h-3" />
                        UPI ID: imdiwakarsharma@fam
                      </div>
                      
                      <button 
                        onClick={() => {
                          const tid = Math.random().toString(36).substring(2, 10).toUpperCase();
                          const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
                          setReceiptData({ transactionId: tid, date });
                          setShowReceipt(true);
                        }}
                        className="mt-6 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
                      >
                        <CheckCircle2 className="w-4 h-4" /> I've Paid, Generate Receipt
                      </button>
                    </>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-600">
                        <IndianRupee className="w-8 h-8" />
                      </div>
                      <p className="text-slate-400">Please select an amount of at least â‚¹10 to generate the payment QR code.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* About Us Tab */}
          {activeTab === 'about' && (
            <div className="max-w-4xl mx-auto flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-12">
              <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-3xl font-black tracking-tight mb-2">Our Mission</h2>
                  <p className="text-emerald-50 max-w-xl leading-relaxed">
                    Bridging the gap between technology and healthcare in Bihar. We aim to provide every citizen with instant health guidance and easy access to medical resources.
                  </p>
                </div>
                <Activity className="absolute -right-8 -bottom-8 w-64 h-64 text-emerald-500/20 rotate-12" />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                    <Heart className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Why We Exist</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Bihar faces a significant challenge with doctor-to-patient ratios. Healthy Bihar AI uses cutting-edge LLMs to provide preliminary triage, helping patients understand their symptoms before they even reach a hospital.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Local Impact</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Starting with Arwal district, we are mapping every health sub-center, pharmacy, and ambulance service to ensure that in an emergency, you are never more than a click away from help.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-3xl p-8 text-center text-white">
                <h3 className="text-xl font-bold mb-4">Student Innovation</h3>
                <p className="text-slate-400 text-sm max-w-2xl mx-auto leading-relaxed mb-6">
                  This project is a Class 11 Innovation initiative, combining social responsibility with artificial intelligence. We believe that youth-led technology can transform rural healthcare delivery.
                </p>
                <div className="flex justify-center gap-4">
                  <div className="px-4 py-2 bg-slate-800 rounded-full text-xs font-bold text-slate-300">#DigitalBihar</div>
                  <div className="px-4 py-2 bg-slate-800 rounded-full text-xs font-bold text-slate-300">#AIForGood</div>
                  <div className="px-4 py-2 bg-slate-800 rounded-full text-xs font-bold text-slate-300">#ArwalHealth</div>
                </div>
              </div>
            </div>
          )}

          {/* Help & FAQ Tab */}
          {activeTab === 'help' && (
            <div className="max-w-4xl mx-auto h-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-12">
              <div className="mb-2">
                <h2 className="text-2xl font-black text-slate-900">Help & FAQ</h2>
                <p className="text-slate-500">Everything you need to know about using Healthy Bihar AI.</p>
              </div>

              <div className="grid lg:grid-cols-3 gap-8 items-start">
                {/* FAQ Section */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <HelpCircle className="w-5 h-5 text-emerald-600" />
                    Frequently Asked Questions
                  </h3>
                  
                  {FAQS.map((faq, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all shadow-sm hover:shadow-md"
                    >
                      <button 
                        onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                      >
                        <span className="font-bold text-slate-700">{faq.q}</span>
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedFaq === idx ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedFaq === idx && (
                        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 animate-in slide-in-from-top-2">
                          <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Contact Form Section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Contact Us</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Direct Support</p>
                    </div>
                  </div>

                  <form onSubmit={handleSendEmail} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Your Name</label>
                      <input 
                        type="text" 
                        required
                        value={contactForm.name}
                        onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                        placeholder="John Doe"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={contactForm.email}
                        onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                        placeholder="john@example.com"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Subject</label>
                      <input 
                        type="text" 
                        value={contactForm.subject}
                        onChange={(e) => setContactForm({...contactForm, subject: e.target.value})}
                        placeholder="How can we help?"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Message</label>
                      <textarea 
                        required
                        rows={4}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                        placeholder="Describe your issue or feedback..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                      />
                    </div>

                    {emailStatus && (
                      <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${emailStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {emailStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {emailStatus.message}
                      </div>
                    )}

                    <button 
                      type="submit"
                      disabled={isSendingEmail}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                    >
                      {isSendingEmail ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Message
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Admin Panel Tab removed, now handled by AdminApp component */}
        </div>

        {/* Educational Footer */}
        <footer className="bg-slate-900 text-slate-400 py-4 px-6 text-center text-sm flex flex-col items-center justify-center gap-2">
          <div>
            <p className="font-medium text-slate-300">Class 11 Innovation Project</p>
            <p className="mt-1 text-xs">A student-led initiative to solve Bihar's doctor-to-patient ratio gap through AI triage and resource mapping.</p>
          </div>
          <button onClick={() => setAppMode('admin')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 mt-2">
            <Lock className="w-3 h-3" /> Admin Access
          </button>
        </footer>
      </main>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />

      {/* Live Audio Chat Modal */}
      {showVoiceChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md">
            <LiveAudioChat onClose={() => setShowVoiceChat(false)} />
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showWhatsAppChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#ece5dd] w-full max-w-md h-[600px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
            {/* Header */}
            <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[15px]">Dr. Sharma (Emergency)</h3>
                <p className="text-xs text-white/80">online</p>
              </div>
              <button onClick={() => setShowWhatsAppChat(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-cover bg-center">
              {whatsappMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`relative max-w-[85%] px-3 py-2 text-[14px] shadow-sm ${msg.sender === 'user' ? 'bg-[#dcf8c6] rounded-lg rounded-tr-none' : 'bg-white rounded-lg rounded-tl-none'}`}>
                    <p className="text-[#303030] leading-snug pr-12">{msg.text}</p>
                    <div className="absolute bottom-1 right-2 flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">{msg.time}</span>
                      {msg.sender === 'user' && <CheckCircle2 className="w-3 h-3 text-[#53bdeb]" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={whatsappEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-[#f0f0f0] px-3 py-3 flex items-center gap-2 shrink-0">
              <input 
                type="text" 
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendWhatsApp()}
                placeholder="Type a message"
                className="flex-1 rounded-full px-4 py-2.5 text-[15px] outline-none border-none focus:ring-0"
              />
              <button 
                onClick={handleSendWhatsApp}
                disabled={!whatsappInput.trim()}
                className="w-10 h-10 bg-[#128c7e] text-white rounded-full flex items-center justify-center shrink-0 disabled:opacity-50 transition-opacity"
              >
                <Send className="w-5 h-5 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chatbot Widget */}
      <AIChatbot />

      {/* Donation Receipt Modal */}
      {showReceipt && receiptData && (
        <DonationReceipt 
          donorName={user?.displayName || 'Valued Supporter'}
          amount={donationAmount}
          transactionId={receiptData.transactionId}
          date={receiptData.date}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {showEmbeddedMeeting && activeTelemedRequest && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col p-4 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-emerald-400" />
                Telemedicine Consultation
              </h2>
              <p className="text-slate-400 text-sm">Secure end-to-end encrypted connection</p>
            </div>
            <button 
              onClick={() => setShowEmbeddedMeeting(false)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Close Meeting
            </button>
          </div>
          <div className="flex-1 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <JitsiMeeting 
              roomName={activeTelemedRequest.meetingId} 
              displayName={user?.displayName || 'Patient'}
              onClose={() => setShowEmbeddedMeeting(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

