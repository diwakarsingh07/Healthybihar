import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, Activity, Info, MapPin, MessageSquare, Phone, Send, User, Stethoscope, ShieldAlert, Ambulance, ShieldPlus, HeartPulse, ThumbsUp, ThumbsDown, CheckCircle2, Shield, Clock, Lock, Unlock, X, LogIn, LogOut, Mic, Video, Heart, IndianRupee } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'triage' | 'locator' | 'analytics' | 'ambulance' | 'schemes' | 'telemed' | 'donation'>('triage');
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

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
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
    setChatHistory(prev => [...prev, { id: userMsgId, role: 'user', content: userMsg }]);
    if (!overrideMsg) setSymptomInput('');
    setIsAnalyzing(true);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the following medical symptom reported by a patient in Bihar (could be in Hindi, English, or Magahi). Determine the triage level as either 'Emergency', 'Urgent', or 'General'. Respond strictly in JSON format with two fields: 'level' (Emergency, Urgent, or General) and 'explanation' (a brief, empathetic explanation in the language the user used, advising them on what to do). Symptom: "${userMsg}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              level: {
                type: Type.STRING,
                enum: ['Emergency', 'Urgent', 'General'],
                description: "The triage level"
              },
              explanation: {
                type: Type.STRING,
                description: "Explanation and advice in the user's language"
              }
            },
            required: ['level', 'explanation']
          }
        }
      });

      const resultText = response.text || '{}';
      const result = JSON.parse(resultText);
      
      const aiMsgId = Date.now().toString() + Math.random().toString(36).substring(7);
      setChatHistory(prev => [...prev, { 
        id: aiMsgId,
        role: 'ai', 
        content: result.explanation,
        triageLevel: result.level as TriageLevel
      }]);
      
      try {
        await setDoc(doc(db, 'triageRecords', aiMsgId), {
          userId: user.uid,
          timestamp: Timestamp.now(),
          symptom: userMsg,
          triageLevel: result.level as TriageLevel,
          explanation: result.explanation,
          feedback: null
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'triageRecords');
      }
      
      if (result.level === 'Emergency') {
        setShowDoctorChat(true);
      }

    } catch (error) {
      console.error("Error analyzing symptom:", error);
      const errorMsgId = Date.now().toString() + Math.random().toString(36).substring(7);
      setChatHistory(prev => [...prev, { 
        id: errorMsgId,
        role: 'ai', 
        content: "I'm sorry, I encountered an error analyzing your symptoms. Please try again or seek immediate medical help if you feel unwell.",
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
      
      {/* Sidebar (Streamlit style) */}
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <Activity className="w-8 h-8" />
            <h1 className="text-2xl font-bold tracking-tight">Healthy Bihar AI</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium mb-4">Arwal District Health Network</p>
          
          {/* Auth Section */}
          {user ? (
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-900 truncate">{user.displayName || 'User'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sign Out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              <LogIn className="w-4 h-4" /> Sign In / Register
            </button>
          )}
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-8">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Navigation</h2>
            <nav className="space-y-1">
              <button 
                onClick={() => setActiveTab('triage')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'triage' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <MessageSquare className="w-4 h-4" />
                AI Triage
              </button>
              <button 
                onClick={() => setActiveTab('locator')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'locator' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <MapPin className="w-4 h-4" />
                Resource Locator
              </button>
              <button 
                onClick={() => setActiveTab('ambulance')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'ambulance' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <Ambulance className="w-4 h-4" />
                Ambulance Directory
              </button>
              <button 
                onClick={() => setActiveTab('telemed')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'telemed' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <Video className="w-4 h-4" />
                Live Doctor Consult
              </button>
              <button 
                onClick={() => setActiveTab('schemes')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'schemes' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <ShieldPlus className="w-4 h-4" />
                Health Schemes
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <BarChart className="w-4 h-4" />
                District Analytics
              </button>
              <button 
                onClick={() => setActiveTab('donation')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'donation' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <Heart className="w-4 h-4" />
                Support Us
              </button>
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
            <div className="max-w-3xl mx-auto h-full flex flex-col">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Multilingual AI Triage</h2>
                <p className="text-slate-500 mt-1">Describe your symptoms in Hindi, English, or Magahi.</p>
              </div>

              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden mb-4">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {chatHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-4">
                      <Stethoscope className="w-12 h-12 text-slate-300" />
                      <p>How are you feeling today?<br/>(à¤†à¤ª à¤•à¥ˆà¤¸à¤¾ à¤®à¤¹à¤¸à¥‚à¤¸ à¤•à¤° à¤°à¤¹à¥‡ à¤¹à¥ˆà¤‚? / à¤°à¤‰à¤µà¤¾ à¤•à¥ˆà¤¸à¤¨ à¤²à¤—à¤¤ à¤¬à¤¾?)</p>
                      
                      <div className="mt-8 w-full max-w-md">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Select Symptoms</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {QUICK_SYMPTOMS.map((symp, idx) => (
                            <button 
                              key={idx}
                              onClick={() => handleAnalyzeSymptom(symp)}
                              className="bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-600 hover:text-emerald-700 px-3 py-1.5 rounded-full text-sm transition-colors"
                            >
                              {symp}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {msg.role === 'user' ? <User className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          
                          {msg.triageLevel && (
                            <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                              ${msg.triageLevel === 'Emergency' ? 'bg-red-100 text-red-700 border border-red-200' : 
                                msg.triageLevel === 'Urgent' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 
                                'bg-blue-100 text-blue-700 border border-blue-200'}`}
                            >
                              {msg.triageLevel === 'Emergency' && <ShieldAlert className="w-3 h-3" />}
                              Triage Level: {msg.triageLevel}
                            </div>
                          )}

                          {msg.role === 'ai' && (
                            <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                              {msg.feedback ? (
                                <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Thanks for your feedback!
                                </span>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 font-medium">Was this helpful?</span>
                                  <div className="flex gap-1">
                                    <button onClick={() => handleFeedback(msg.id, 'helpful')} className="p-1.5 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 rounded-md transition-colors" title="Helpful">
                                      <ThumbsUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleFeedback(msg.id, 'not_helpful')} className="p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-md transition-colors" title="Not Helpful">
                                      <ThumbsDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {isAnalyzing && (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowVoiceChat(true)}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl px-4 py-3 flex items-center justify-center transition-colors shadow-sm"
                      title="Talk to AI Doctor"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                    <input 
                      type="text" 
                      value={symptomInput}
                      onChange={(e) => setSymptomInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeSymptom()}
                      placeholder="Type symptoms here..."
                      className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                    <button 
                      onClick={() => handleAnalyzeSymptom()}
                      disabled={isAnalyzing || !symptomInput.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl px-5 py-3 flex items-center justify-center transition-colors"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
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
            <div className="max-w-4xl mx-auto">
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
            <div className="max-w-4xl mx-auto">
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
            <div className="max-w-4xl mx-auto">
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

