import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Trash2, ShieldAlert, CheckCircle2, ThumbsUp, ThumbsDown, Activity, Mic } from 'lucide-react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import Markdown from 'react-markdown';
import { TriageLevel, ChatMessage } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const INITIAL_MESSAGE: ChatMessage = { 
  id: '1', 
  role: 'model', 
  text: 'Hello! I am your AI Health Assistant for the Arwal District Health Network. How can I help you today?' 
};

interface AIChatbotProps {
  inline?: boolean;
  messages?: ChatMessage[];
  onSendMessage?: (message: string) => void;
  onClearChat?: () => void;
  isLoading?: boolean;
  onFeedback?: (messageId: string, feedback: 'helpful' | 'not_helpful') => void;
  emptyState?: React.ReactNode;
  onVoiceChat?: () => void;
}

export default function AIChatbot({ 
  inline = false, 
  messages: externalMessages, 
  onSendMessage, 
  onClearChat, 
  isLoading: externalIsLoading,
  onFeedback,
  emptyState,
  onVoiceChat
}: AIChatbotProps = {}) {
  const [isOpen, setIsOpen] = useState(inline);
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [internalIsLoading, setInternalIsLoading] = useState(false);
  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isControlled = externalMessages !== undefined;
  const messages = isControlled ? externalMessages : internalMessages;
  const isLoading = isControlled ? (externalIsLoading || false) : internalIsLoading;

  useEffect(() => {
    if (!isControlled && !chatRef.current) {
      initChat();
    }
  }, [isControlled]);

  const initChat = () => {
    chatRef.current = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction: 'You are a helpful medical and health assistant for the Arwal District Health Network in Bihar. Provide general health information, answer questions about health schemes, and guide users. Do not provide definitive medical diagnoses. Keep your answers concise, empathetic, and easy to understand. You can communicate in English, Hindi, or Magahi based on the user\'s language.',
      }
    });
  };

  const handleClearChat = () => {
    if (onClearChat) {
      onClearChat();
    } else {
      setInternalMessages([INITIAL_MESSAGE]);
      initChat();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');

    if (onSendMessage) {
      onSendMessage(userText);
      return;
    }

    const userMsgId = Date.now().toString();
    setInternalMessages(prev => [...prev, { id: userMsgId, role: 'user', text: userText }]);
    setInternalIsLoading(true);

    const modelMsgId = (Date.now() + 1).toString();
    setInternalMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', isStreaming: true }]);

    try {
      const responseStream = await chatRef.current.sendMessageStream({ message: userText });
      
      let fullText = '';
      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullText += c.text;
          setInternalMessages(prev => prev.map(msg => 
            msg.id === modelMsgId ? { ...msg, text: fullText } : msg
          ));
        }
      }
      
      setInternalMessages(prev => prev.map(msg => 
        msg.id === modelMsgId ? { ...msg, isStreaming: false } : msg
      ));
    } catch (error) {
      console.error('Chat error:', error);
      setInternalMessages(prev => prev.map(msg => 
        msg.id === modelMsgId ? { ...msg, text: 'Sorry, I encountered an error. Please try again later.', isStreaming: false } : msg
      ));
    } finally {
      setInternalIsLoading(false);
    }
  };

  const chatContent = (
    <div className={`flex flex-col h-full ${inline ? 'w-full' : 'w-80 sm:w-96 lg:w-[450px] h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-5'}`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10 ${inline ? 'bg-white border-b border-slate-100' : 'bg-emerald-600 text-white'}`}>
        <div className="flex items-center gap-2">
          <div className={`${inline ? 'bg-emerald-50 text-emerald-600' : 'bg-white/20 text-white'} p-1.5 rounded-lg`}>
            {inline ? <Activity className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
          </div>
          <div>
            <h3 className={`font-bold text-sm ${inline ? 'text-slate-900' : 'text-white'}`}>
              {inline ? 'Healthy Bihar AI' : 'AI Health Assistant'}
            </h3>
            <p className={`text-[10px] ${inline ? 'text-slate-500' : 'text-emerald-100 opacity-90'}`}>
              Arwal Health Network
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleClearChat}
            className={`p-1.5 rounded-md transition-colors ${inline ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-emerald-700 text-emerald-100 hover:text-white'}`}
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {!inline && (
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-emerald-700 rounded-md transition-colors text-emerald-100 hover:text-white"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-5 ${inline ? 'bg-transparent' : 'bg-slate-50/50'}`}>
        {messages.length === 0 && emptyState ? (
          emptyState
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-emerald-600'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  ) : (
                    <div className="prose prose-sm prose-emerald max-w-none">
                      {msg.text ? (
                        <Markdown>{msg.text}</Markdown>
                      ) : (
                        <div className="flex items-center gap-1 h-5">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      )}
                    </div>
                  )}

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

                  {(msg.role === 'model' || msg.role === 'ai') && onFeedback && !msg.isStreaming && msg.text && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      {msg.feedback ? (
                        <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Thanks for your feedback!
                        </span>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 font-medium">Was this helpful?</span>
                          <div className="flex gap-1">
                            <button onClick={() => onFeedback(msg.id, 'helpful')} className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-md transition-colors" title="Helpful">
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => onFeedback(msg.id, 'not_helpful')} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-md transition-colors" title="Not Helpful">
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && !isControlled && (
          <div className="flex justify-start">
            <div className="flex gap-2 max-w-[85%] flex-row">
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-2 shadow-sm">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
          {onVoiceChat && (
            <button 
              onClick={onVoiceChat}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl p-2 flex items-center justify-center transition-colors shrink-0 mb-0.5"
              title="Talk to AI Doctor"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a health question..."
            className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 resize-none max-h-32 min-h-[24px] py-1"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl p-2 transition-colors shrink-0 mb-0.5"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <div className="mt-2 text-center">
          <p className="text-[10px] text-slate-400">
            AI can make mistakes. Consult a doctor for medical advice.
          </p>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return chatContent;
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 z-40"
          aria-label="Open AI Chatbot"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          {chatContent}
        </div>
      )}
    </>
  );
}
