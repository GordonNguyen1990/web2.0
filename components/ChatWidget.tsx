
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircleIcon, XIcon, SendIcon, MicIcon, RefreshCwIcon, BotIcon, UserIcon, HeadsetIcon, WaveformIcon } from './Icons';
import { getChatSupportResponse } from '../services/geminiService';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

// Type definition for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'vi-VN'; // Set Vietnamese as default
        
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
        };
        recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
      if (!recognitionRef.current) {
          alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.");
          return;
      }
      if (isListening) {
          recognitionRef.current.stop();
      } else {
          recognitionRef.current.start();
      }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
        const history = messages.map(m => ({ role: m.role, text: m.text }));
        const responseText = await getChatSupportResponse(history, userMsg.text);
        
        const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: responseText };
        setMessages(prev => [...prev, botMsg]);
    } catch (error) {
        const errorMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: "Xin lỗi, có lỗi xảy ra. Vui lòng kiểm tra API Key." };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleReset = () => {
      setMessages([]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-3xl shadow-2xl w-[360px] h-[520px] mb-5 flex flex-col overflow-hidden animate-fadeIn ring-1 ring-gray-200">
          {/* Header - Brand Blue */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
             <div className="flex items-center gap-4">
                 <div className="relative">
                     <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center border border-brand-100">
                         <HeadsetIcon className="text-brand-600 w-6 h-6" /> 
                     </div>
                     <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                 </div>
                 <div>
                     <h3 className="font-bold text-gray-900 text-lg leading-tight">Web2 Support</h3>
                     <p className="text-xs text-brand-500 font-medium">Online 24/7</p>
                 </div>
             </div>
             <div className="flex items-center gap-1">
                 <button onClick={handleReset} className="p-2 text-gray-400 hover:text-brand-500 transition-colors rounded-full hover:bg-gray-50" title="Làm mới">
                     <RefreshCwIcon className="w-4 h-4" />
                 </button>
                 <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-50">
                     <XIcon className="w-5 h-5" />
                 </button>
             </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 bg-white p-4 overflow-y-auto">
              {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                      <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center animate-pulse-slow">
                          <MessageCircleIcon className="w-8 h-8 text-brand-400" />
                      </div>
                      <div className="space-y-2">
                          <p className="font-semibold text-gray-800">Xin chào, tôi là AI Advisor</p>
                          <p className="text-sm text-gray-500 max-w-[200px] mx-auto">
                              Sử dụng giọng nói hoặc tin nhắn để hỏi về dự án.
                          </p>
                      </div>
                  </div>
              ) : (
                  <div className="space-y-6">
                      {messages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              {msg.role === 'model' && (
                                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center mr-2 shrink-0 border border-brand-200 text-brand-600 mt-1">
                                      <BotIcon className="w-4 h-4" />
                                  </div>
                              )}
                              <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                  msg.role === 'user' 
                                  ? 'bg-brand-600 text-white rounded-br-sm' 
                                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                              }`}>
                                  {msg.text}
                              </div>
                          </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center mr-2 shrink-0 border border-brand-200 text-brand-600">
                                <BotIcon className="w-4 h-4" />
                            </div>
                            <div className="bg-gray-100 p-4 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                            </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                  </div>
              )}
          </div>

          {/* Input Area - White & Rounded */}
          <div className="p-4 bg-white border-t border-gray-50 shrink-0 relative">
             {isListening && (
                 <div className="absolute -top-10 left-0 w-full flex justify-center items-center gap-2 py-2 bg-gradient-to-t from-white to-transparent">
                     <span className="text-xs font-bold text-red-500 animate-pulse flex items-center gap-1">
                         <WaveformIcon className="w-4 h-4" /> Đang nghe...
                     </span>
                 </div>
             )}
             <div className="bg-gray-50 rounded-[24px] flex items-center p-1.5 border border-gray-200 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100 transition-all shadow-inner">
                 <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none placeholder-gray-400"
                    disabled={isLoading}
                 />
                 <div className="flex items-center gap-1 pr-1">
                     <button 
                        onClick={toggleListening}
                        className={`p-2.5 rounded-full transition-all ${
                            isListening 
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110' 
                            : 'text-gray-400 hover:text-brand-600 hover:bg-white'
                        }`}
                        title="Voice Input"
                     >
                         {isListening ? <WaveformIcon className="w-5 h-5 animate-pulse" /> : <MicIcon className="w-5 h-5" />}
                     </button>
                     
                     <button 
                        onClick={() => handleSendMessage()}
                        disabled={!input.trim() || isLoading}
                        className={`p-2.5 rounded-full transition-all shadow-sm ${
                            !input.trim() || isLoading
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-brand-600 text-white hover:bg-brand-500 shadow-brand-500/30'
                        }`}
                     >
                         <SendIcon className="w-5 h-5 transform rotate-45 translate-x-[-1px] translate-y-[1px]" />
                     </button>
                 </div>
             </div>
             <div className="text-center mt-3">
                 <span className="text-[10px] text-gray-400 font-medium">Hỗ trợ bởi Gemini AI & Web3 Tech</span>
             </div>
          </div>
        </div>
      )}

      {/* Floating Button - Brand Gradient */}
      {!isOpen && (
          <button 
            onClick={() => setIsOpen(true)}
            className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 rounded-full shadow-2xl flex items-center justify-center text-white transition-all transform hover:scale-105 active:scale-95 group relative ring-4 ring-brand-500/20"
          >
              <span className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-75"></span>
              <HeadsetIcon className="w-8 h-8 transition-transform group-hover:rotate-12" />
              {/* Status Dot */}
              <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-brand-600"></span>
          </button>
      )}
    </div>
  );
};

export default ChatWidget;
