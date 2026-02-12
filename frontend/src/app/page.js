"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Send, Loader2, Box, Sparkles, Download, Settings } from 'lucide-react';
import PedestalControls from '../components/PedestalControls';

const API_BASE = "https://3d-gift-manager.walid-elleuch.workers.dev";
const RUNPOD_API_KEY = process.env.NEXT_PUBLIC_RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = "nefvw8vdxu2yd3";

const ModelViewer = dynamic(() => import('../components/ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-slate-100">
      <div className="text-slate-400 animate-pulse font-bold text-xs uppercase tracking-widest">
        Initializing 3D Engine...
      </div>
    </div>
  )
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to the AI 3D Gift Studio. Tell me about the recipient's hobbies to begin." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [modelUrl, setModelUrl] = useState(null);
  const [showPedestalUI, setShowPedestalUI] = useState(false);
  const [orderSummary, setOrderSummary] = useState(null);
  
  const [pedestalSettings, setPedestalSettings] = useState({
    shape: 'box', height: 10, width: 60, depth: 60, text: '', offset: 10, scale: 1.0, modelZOffset: 0
  });

  const chatEndRef = useRef(null);
  const exporterRef = useRef();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setStatus('Analyzing ideas...');

    try {
      const chatRes = await axios.post(`${API_BASE}/chat`, {
        messages: [...messages, { role: 'user', content: userMsg }]
      });

      if (chatRes.data.status === "success") {
        if (chatRes.data.images) {
           setMessages(prev => [...prev, { 
             role: 'assistant', 
             content: "Here are the designs I generated:",
             images: chatRes.data.images 
           }]);
        } else if (chatRes.data.ideas) {
          const ideasText = chatRes.data.ideas.map(i => i.name).join(", ");
          setMessages(prev => [...prev, { role: 'assistant', content: "Ideas: " + ideasText }]);
        }
      }
    } catch (err) {
      console.error("Chat Error:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to AI." }]);
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const generate3DModel = async (prompt) => {
    setStatus('Generating 3D assets...');
    try {
      const response = await axios.post(
        `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`,
        { input: { prompt, mode: "preview" } },
        { headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` } }
      );
      pollStatus(response.data.id);
    } catch (err) {
      console.error("RunPod Error:", err);
      setStatus("3D Generation failed.");
    }
  };

  const pollStatus = async (jobId) => {
    const check = async () => {
      try {
        const res = await axios.get(
          `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`,
          { headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` } }
        );
        if (res.data.status === 'COMPLETED') {
          setModelUrl(res.data.output.model_url || res.data.output);
          setStatus("Model ready!");
          setShowPedestalUI(true);
        } else if (res.data.status === 'FAILED') {
          setStatus("Generation failed.");
        } else {
          setTimeout(check, 3000);
        }
      } catch (e) { console.error(e); }
    };
    check();
  };

  const handleDownloadSTL = async () => {
    if (!exporterRef.current) return;
    setStatus("Preparing mesh...");
    try {
      const stlData = exporterRef.current.exportSTL();
      const blob = new Blob([stlData], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `3d-gift-${Date.now()}.stl`;
      link.click();
      setOrderSummary({ print_time: "4h 12m", weight: "42g", price: "$18.50" });
      setStatus("Design ready!");
    } catch (err) { setStatus("Export failed."); }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* CHAT SIDEBAR */}
      <div className="w-[400px] flex flex-col bg-white border-r border-slate-200 shadow-xl z-20">
        <div className="p-6 border-b border-slate-100 bg-slate-900 text-white flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-xl"><Sparkles size={20} /></div>
          <h1 className="font-black tracking-tighter text-xl">GIFT STUDIO</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium shadow-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
              }`}>
                {m.content}
                {m.images && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {m.images.map((imgUrl, idx) => (
                      <img 
                        key={idx} 
                        src={imgUrl} 
                        alt="AI proposal"
                        className="rounded-lg cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all border border-white/20 shadow-sm" 
                        onClick={() => generate3DModel(m.content)} 
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="bg-slate-100 p-4 rounded-2xl flex items-center gap-3 animate-pulse w-fit">
              <Loader2 className="animate-spin text-blue-600" size={16} />
              <span className="text-xs font-bold text-slate-500 uppercase">{status}</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200">
          <div className="relative flex items-center">
            <input 
              type="text" value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Describe your gift idea..." 
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-6 pr-14 text-sm focus:ring-4 focus:ring-blue-500/10 outline-none" 
            />
            <button onClick={handleSend} disabled={loading} className="absolute right-2 p-3 bg-slate-900 text-white rounded-xl hover:bg-black disabled:opacity-50">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 3D VIEWPORT */}
      <div className="flex-1 relative bg-slate-100 z-0">
        <div className="absolute inset-0 z-10 pointer-events-auto">
          {modelUrl ? (
            <ModelViewer url={modelUrl} pedestalSettings={pedestalSettings} setSettings={setPedestalSettings} exporterRef={exporterRef} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl animate-bounce"><Box size={40} className="text-blue-500" /></div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">3D Workspace Empty</h2>
            </div>
          )}
        </div>

        <div className="absolute top-8 left-8 right-8 flex justify-between items-center pointer-events-none z-30">
          <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-white shadow-sm flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">AI Engine Active</span>
          </div>
          {modelUrl && (
            <button onClick={() => setShowPedestalUI(!showPedestalUI)} className="pointer-events-auto bg-white p-3 rounded-2xl shadow-xl border border-slate-100 text-slate-700">
              <Settings size={20} />
            </button>
          )}
        </div>

        {showPedestalUI && (
          <div className="z-50 relative">
             <PedestalControls settings={pedestalSettings} setSettings={setPedestalSettings} onPrepare={() => setShowPedestalUI(false)} />
          </div>
        )}

        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none z-30">
          <div className="pointer-events-auto">
            {orderSummary && (
              <div className="bg-white/90 backdrop-blur-md p-6 rounded-[32px] shadow-2xl border border-white flex flex-col gap-1">
                <div className="text-sm font-bold text-slate-800">
                  Time: <span className="text-slate-500">{orderSummary.print_time}</span> • Price: <span className="text-green-600">{orderSummary.price}</span>
                </div>
              </div>
            )}
          </div>
          {modelUrl && (
            <button onClick={handleDownloadSTL} className="pointer-events-auto bg-slate-900 text-white px-8 py-4 rounded-2xl text-sm font-black hover:bg-black shadow-2xl flex items-center gap-3">
              <Download size={20} /> DOWNLOAD STL
            </button>
          )}
        </div>
      </div>
    </div>
  );
}