import React, { useState, useEffect } from 'react';
import { Shield, Clock, ThumbsUp, ThumbsDown, Lock, Unlock, ArrowLeft, BarChart2, Users, Activity, Settings, Bell, Search, Menu, Video, CheckCircle2, X, XCircle, Timer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import JitsiMeeting from './components/JitsiMeeting';
import { TriageRecord, TelemedRequest } from './types';
import { db, auth } from './firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestoreUtils';

interface AdminAppProps {
  triageRecords: TriageRecord[];
  analyticsData: any[];
  isAdminAuthenticated: boolean;
  adminPasswordInput: string;
  setAdminPasswordInput: (val: string) => void;
  adminError: string;
  onLogin: (e: React.FormEvent) => void;
  onLogout: () => void;
  onExit: () => void;
}

export default function AdminApp({
  triageRecords,
  analyticsData,
  isAdminAuthenticated,
  adminPasswordInput,
  setAdminPasswordInput,
  adminError,
  onLogin,
  onLogout,
  onExit
}: AdminAppProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'analytics' | 'telemed'>('overview');
  const [telemedRequests, setTelemedRequests] = useState<TelemedRequest[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<TelemedRequest | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [schedulingRequestId, setSchedulingRequestId] = useState<string | null>(null);

  useEffect(() => {
    const scheduled = telemedRequests.find(r => 
      r.status === 'waiting' && 
      r.scheduledJoinTime && 
      r.scheduledJoinTime <= currentTime
    );

    if (scheduled) {
      handleJoinTelemed(scheduled);
    }
  }, [telemedRequests, currentTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // Update every 10 seconds for the wait timer
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated) return;

    const q = query(
      collection(db, 'telemedRequests'),
      where('status', 'in', ['waiting', 'in-progress']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests: TelemedRequest[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
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
      });
      setTelemedRequests(requests);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'telemedRequests');
    });

    return () => unsubscribe();
  }, [isAdminAuthenticated]);

  const handleJoinTelemed = async (request: TelemedRequest) => {
    if (!auth.currentUser) return;
    
    try {
      await updateDoc(doc(db, 'telemedRequests', request.id), {
        status: 'in-progress',
        doctorId: auth.currentUser.uid
      });
      setActiveMeeting(request);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'telemedRequests');
    }
  };

  const handleCompleteTelemed = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'telemedRequests', requestId), {
        status: 'completed'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'telemedRequests');
    }
  };

  const handleRejectTelemed = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'telemedRequests', requestId), {
        status: 'rejected'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'telemedRequests');
    }
  };

  const handleScheduleJoin = async (requestId: string, minutes: number) => {
    try {
      const scheduledTime = new Date(Date.now() + minutes * 60000);
      await updateDoc(doc(db, 'telemedRequests', requestId), {
        scheduledJoinTime: scheduledTime
      });
      setSchedulingRequestId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'telemedRequests');
    }
  };

  const formatWaitTime = (createdAt: Date) => {
    const diff = Math.floor((currentTime.getTime() - createdAt.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="absolute top-6 left-6">
          <button onClick={onExit} className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Patient Portal
          </button>
        </div>
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center">
          <div className="w-16 h-16 bg-slate-700 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">System Administration</h2>
          <p className="text-slate-400 mb-8 text-sm">Secure access required for Arwal District Health Network.</p>
          
          <form onSubmit={onLogin} className="space-y-4">
            <div>
              <input 
                type="password" 
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Enter Admin Password"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-center tracking-widest placeholder:text-slate-600"
              />
            </div>
            {adminError && <p className="text-red-400 text-sm font-medium">{adminError}</p>}
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5 py-3 font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
              <Unlock className="w-4 h-4" /> Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex font-sans text-slate-300">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1e293b] border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 text-emerald-400 mb-1">
            <Shield className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight text-white">Admin Console</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">Arwal Health Network</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Activity className="w-4 h-4" /> Overview
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'logs' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Users className="w-4 h-4" /> Triage Logs
          </button>
          <button 
            onClick={() => setActiveTab('telemed')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'telemed' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Video className="w-4 h-4" /> Telemed Queue
            {telemedRequests.filter(r => r.status === 'waiting').length > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {telemedRequests.filter(r => r.status === 'waiting').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <BarChart2 className="w-4 h-4" /> Analytics
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <Lock className="w-4 h-4" /> Lock Session
          </button>
          <button onClick={onExit} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-4 h-4" /> Exit to Portal
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#1e293b] border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white capitalize">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Search records..." className="bg-slate-900 border border-slate-700 rounded-full pl-9 pr-4 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 w-64" />
            </div>
            <button className="p-2 text-slate-400 hover:text-white relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              AD
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {activeTab === 'overview' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-sm">
                  <p className="text-4xl font-bold text-white">{triageRecords.length}</p>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-2">Total Triages</p>
                </div>
                <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-sm">
                  <p className="text-4xl font-bold text-red-400">{triageRecords.filter(r => r.triageLevel === 'Emergency').length}</p>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-2">Emergencies</p>
                </div>
                <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-sm">
                  <p className="text-4xl font-bold text-emerald-400">{triageRecords.filter(r => r.feedback === 'helpful').length}</p>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-2">Helpful Ratings</p>
                </div>
                <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-sm">
                  <p className="text-4xl font-bold text-orange-400">{triageRecords.filter(r => r.feedback === 'not_helpful').length}</p>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-2">Needs Improvement</p>
                </div>
              </div>

              <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">Recent Triage Activity</h3>
                  <button onClick={() => setActiveTab('logs')} className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/50 text-slate-400">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Time</th>
                        <th className="px-6 py-4 font-semibold">Reported Symptom</th>
                        <th className="px-6 py-4 font-semibold">AI Triage Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {triageRecords.slice(0, 5).map(record => (
                        <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                            {record.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-200 max-w-xs truncate" title={record.symptom}>
                            {record.symptom}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                              ${record.triageLevel === 'Emergency' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                record.triageLevel === 'Urgent' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 
                                'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}
                            >
                              {record.triageLevel}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {triageRecords.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-slate-500">No recent activity.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="max-w-6xl mx-auto">
              <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/50 text-slate-400">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Time</th>
                        <th className="px-6 py-4 font-semibold">Reported Symptom</th>
                        <th className="px-6 py-4 font-semibold">AI Triage Level</th>
                        <th className="px-6 py-4 font-semibold">Feedback</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {triageRecords.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                            No triage records found.
                          </td>
                        </tr>
                      ) : (
                        triageRecords.map(record => (
                          <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {record.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-200 max-w-md truncate" title={record.symptom}>
                              {record.symptom}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                                ${record.triageLevel === 'Emergency' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                  record.triageLevel === 'Urgent' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 
                                  'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}
                              >
                                {record.triageLevel}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {record.feedback === 'helpful' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded text-xs font-medium border border-emerald-500/20">
                                  <ThumbsUp className="w-3 h-3" /> Helpful
                                </span>
                              ) : record.feedback === 'not_helpful' ? (
                                <span className="inline-flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-1 rounded text-xs font-medium border border-red-500/20">
                                  <ThumbsDown className="w-3 h-3" /> Not Helpful
                                </span>
                              ) : (
                                <span className="text-slate-500 text-xs italic">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'telemed' && (
            <div className="max-w-6xl mx-auto">
              <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-800">
                  <h3 className="text-lg font-semibold text-white">Live Consultation Queue</h3>
                  <p className="text-sm text-slate-400 mt-1">Patients waiting for a doctor to join their video call.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/50 text-slate-400">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Time Requested</th>
                        <th className="px-6 py-4 font-semibold">Wait Time</th>
                        <th className="px-6 py-4 font-semibold">Patient Name</th>
                        <th className="px-6 py-4 font-semibold">Problem</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {telemedRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                            No active consultation requests.
                          </td>
                        </tr>
                      ) : (
                        telemedRequests.map(request => (
                          <tr key={request.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {request.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`font-mono text-xs font-medium ${
                                (currentTime.getTime() - request.createdAt.getTime()) > 300000 ? 'text-red-400' : 'text-emerald-400'
                              }`}>
                                {formatWaitTime(request.createdAt)}
                              </span>
                              {request.scheduledJoinTime && request.status === 'waiting' && (
                                <div className="mt-1 flex items-center gap-1 text-[10px] text-orange-400 font-medium">
                                  <Timer className="w-3 h-3" />
                                  Joining in {Math.max(0, Math.ceil((request.scheduledJoinTime.getTime() - currentTime.getTime()) / 60000))}m
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-200">
                              {request.patientName}
                            </td>
                            <td className="px-6 py-4 text-slate-300 max-w-xs truncate" title={request.problem}>
                              {request.problem}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                                ${request.status === 'waiting' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse' : 
                                  'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}
                              >
                                {request.status === 'waiting' ? 'Waiting' : 'In Progress'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {request.status === 'waiting' ? (
                                  <>
                                    {schedulingRequestId === request.id ? (
                                      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                                        <select 
                                          className="bg-transparent text-xs text-white outline-none px-1"
                                          onChange={(e) => handleScheduleJoin(request.id, parseInt(e.target.value))}
                                          defaultValue=""
                                        >
                                          <option value="" disabled>Set Timer</option>
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(m => (
                                            <option key={m} value={m} className="bg-slate-800">{m} min</option>
                                          ))}
                                        </select>
                                        <button 
                                          onClick={() => setSchedulingRequestId(null)}
                                          className="p-1 text-slate-500 hover:text-white"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setSchedulingRequestId(request.id)}
                                        className="p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                                        title="Schedule Join"
                                      >
                                        <Timer className="w-5 h-5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleRejectTelemed(request.id)}
                                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                      title="Reject Request"
                                    >
                                      <XCircle className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() => handleJoinTelemed(request)}
                                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                                    >
                                      <Video className="w-4 h-4" /> Join Call
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleCompleteTelemed(request.id)}
                                    className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    <CheckCircle2 className="w-4 h-4" /> Mark Completed
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="max-w-6xl mx-auto">
              <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-sm mb-6">
                <h3 className="text-lg font-semibold text-white mb-6">Medical Staff Distribution</h3>
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analyticsData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dx={-10} />
                      <Tooltip 
                        cursor={{ fill: '#0f172a' }}
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', color: '#f8fafc' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="Doctors" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      <Bar dataKey="Staff" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {activeMeeting && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col p-4 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-emerald-400" />
                Telemedicine Session: {activeMeeting.patientName}
              </h2>
              <p className="text-slate-400 text-sm">Secure end-to-end encrypted connection</p>
            </div>
            <button 
              onClick={() => setActiveMeeting(null)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Close Session
            </button>
          </div>
          <div className="flex-1 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <JitsiMeeting 
              roomName={activeMeeting.meetingId} 
              displayName="Dr. Sharma (Admin)"
              onClose={() => setActiveMeeting(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
