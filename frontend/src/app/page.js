"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Send, Loader2, Box, Sparkles, Cpu, Layers, Download, CheckCircle2 } from 'lucide-react';

const ModelViewer = dynamic(() => import('../components/ModelViewer'), { 
  ssr: false,
  loading: () => <div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin text-blue-500" size={40}/> <p className="text-slate-400 animate-pulse">Initializing 3D Engine...</p></div>
});

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to the AI 3D Gift Studio. Tell me about the recipient's hobbies or favorite objects to begin." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [modelUrl, setModelUrl] = useState(null);
  const [status, setStatus] = useState('');
  const scrollRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input || loading) return;
    const newHistory = [...messages, { role: 'user', content: input }];
    setMessages(newHistory);
    setInput('');
    setLoading(true);
    setStatus('AI is thinking...');

    try {
      const res = await axios.post('http://localhost:8000/api/chat', { history: newHistory });
      
      if (res.data.visual_prompt) {
        setMessages([...newHistory, { role: 'assistant', content: "I've designed something special! Generating the preview now..." }]);
        setStatus('Optimizing for 3D Printing...');
        const genRes = await axios.post('http://localhost:8000/api/generate-images', { visual_prompt: res.data.visual_prompt });
        pollForImages(genRes.data.job_id);
      } else {
        setMessages([...newHistory, { role: 'assistant', content: res.data.response }]);
        setLoading(false);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection lost. Please check if the backend is running." }]);
      setLoading(false);
    }
  };

  const pollForImages = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:8000/api/check-status/${jobId}`);
        if (res.data.status === 'completed') {
          clearInterval(interval);
          setGeneratedImages(res.data.images);
          setLoading(false);
          setStatus('');
        }
      } catch (e) { clearInterval(interval); }
    }, 2000);
  };

  const handleSelectImage = async (imgUrl) => {
    setModelUrl(null);
    setStatus('Reconstructing 3D Mesh...');
    setLoading(true);
    setGeneratedImages([]); 
    
    try {
      const res = await axios.post('http://localhost:8000/api/generate-3d', { image_url: imgUrl });
      pollFor3D(res.data.job_id);
    } catch (e) {
      setStatus('Error');
      setLoading(false);
    }
  };

  const pollFor3D = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:8000/api/check-status/${jobId}`);
        if (res.data.status === 'completed') {
          clearInterval(interval);
          if (res.data.images?.length > 0) {
             setModelUrl(res.data.images[0]); 
             setLoading(false);
             setStatus('Generation Successful');
          }
        }
      } catch (e) { clearInterval(interval); }
    }, 2000);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      
      {/* --- LEFT SIDEBAR: CHAT --- */}
      <div className="w-[400px] bg-slate-900 flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg">
            <Sparkles className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-tight">GiftAI Studio</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">3D Generation Engine</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${
                m.role === 'user' 
                ? 'bg-blue-600 text-white chat-bubble-user' 
                : 'bg-slate-800 text-slate-200 chat-bubble-ai border border-slate-700'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-3 text-blue-400 text-xs font-medium animate-pulse">
              <Loader2 className="animate-spin" size={14}/> {status}
            </div>
          )}
        </div>
        
        <div className="p-6 bg-slate-900 border-t border-slate-800">
          <div className="relative group">
            <input 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-500"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Describe hobby, city, or pet..."
            />
            <button 
              onClick={sendMessage} 
              disabled={loading}
              className="absolute right-2 top-1.5 p-2 text-slate-400 hover:text-blue-400 disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* --- MAIN AREA: WORKBENCH --- */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        
        {/* Header Indicators */}
        <div className="absolute top-6 left-6 flex gap-4 z-10">
          <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold text-slate-600 shadow-sm border">
            <Cpu size={14} className="text-blue-500" /> GPU: ACTIVE
          </div>
          <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold text-slate-600 shadow-sm border">
            <Layers size={14} className="text-green-500" /> DfAM: ENFORCED
          </div>
        </div>

        <main className="flex-1 p-12 flex items-center justify-center">
          
          {/* Initial State */}
          {!modelUrl && generatedImages.length === 0 && !loading && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-slate-200 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-inner">
                <Box size={40} className="text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-400">Waiting for Design Concept</h2>
              <p className="text-slate-400 max-w-md">Start a conversation to generate 3D printable previews.</p>
            </div>
          )}

          {/* Loading State for Large Actions */}
          {loading && generatedImages.length === 0 && !modelUrl && (
            <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-8">
                   <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                   <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <h2 className="text-xl font-bold text-slate-700">{status}</h2>
            </div>
          )}

          {/* Image Selection Grid */}
          {!modelUrl && generatedImages.length > 0 && (
            <div className="w-full max-w-5xl grid grid-cols-2 gap-8 animate-in fade-in zoom-in duration-500">
              {generatedImages.map((img, i) => (
                <div 
                  key={i} 
                  className="group relative cursor-pointer rounded-3xl overflow-hidden shadow-2xl border-4 border-white transition-all hover:scale-[1.02]" 
                  onClick={() => handleSelectImage(img)}
                >
                  <img src={img} alt="AI Design" className="w-full h-80 object-cover bg-slate-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-8">
                    <button className="bg-white text-blue-900 px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg">
                      <CheckCircle2 size={20}/> SELECT THIS DESIGN
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3D Viewport */}
          {modelUrl && (
            <div className="w-full h-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex-1 glass-card rounded-[40px] shadow-2xl overflow-hidden relative border-8 border-white">
                 <ModelViewer url={modelUrl} />
                 
                 <div className="absolute top-6 right-6">
                    <span className="bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">WATERTIGHT MESH</span>
                 </div>

                 <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                   <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-xl hover:bg-slate-800 font-bold flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
                     <Layers size={20}/> CUSTOMIZE PEDESTAL
                   </button>
                   <button className="bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-xl hover:bg-blue-700 font-bold flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
                     <Download size={20}/> PREPARE G-CODE
                   </button>
                 </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}