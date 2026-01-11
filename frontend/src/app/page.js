"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Send, Loader2, Box, Sparkles, Cpu, Layers, Download, CheckCircle2 } from 'lucide-react';
import PedestalControls from '../components/PedestalControls';

// --- THE URL CONFIGURATION ---
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ModelViewer = dynamic(() => import('../components/ModelViewer'), { 
  ssr: false,
  loading: () => <div className="text-slate-400 animate-pulse font-bold text-xs">Loading 3D Engine...</div>
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to the AI 3D Gift Studio. Tell me about the recipient's hobbies to begin." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [modelUrl, setModelUrl] = useState(null);
  
  const exporterRef = useRef(null);
  const [showPedestalUI, setShowPedestalUI] = useState(false);
  const [orderSummary, setOrderSummary] = useState(null);
  const [isOrdered, setIsOrdered] = useState(false);

  const [pedestalSettings, setPedestalSettings] = useState({
    shape: 'box', height: 10, width: 60, depth: 60, text: '', offset: 0, scale: 1.0
  });

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input || loading) return;
    const newHistory = [...messages, { role: 'user', content: input }];
    setMessages(newHistory);
    setInput('');
    setLoading(true);
    setStatus('AI is thinking...');

    try {
      // FIX 1: Use API_BASE
      const res = await axios.post(`${API_BASE}/api/chat`, { history: newHistory });
      if (res.data.visual_prompt) {
        setStatus('Optimizing for 3D Printing...');
        // FIX 2: Use API_BASE
        const genRes = await axios.post(`${API_BASE}/api/generate-images`, { visual_prompt: res.data.visual_prompt });
        pollForImages(genRes.data.job_id);
      } else {
        setMessages([...newHistory, { role: 'assistant', content: res.data.response }]);
        setLoading(false);
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setLoading(false);
    }
  };

  const pollForImages = (jobId) => {
    const interval = setInterval(async () => {
      try {
        // FIX 3: Use API_BASE
        const res = await axios.get(`${API_BASE}/api/check-status/${jobId}`);
        if (res.data.status === 'completed') {
          clearInterval(interval);
          setGeneratedImages(res.data.images);
          setLoading(false);
        }
      } catch (e) { console.error("Polling error:", e); }
    }, 3000);
  };

  const handleSelectImage = async (imgUrl) => {
    setModelUrl(null);
    setShowPedestalUI(false);
    setLoading(true);
    setStatus('Reconstructing 3D Mesh...');
    setGeneratedImages([]);
    try {
      // FIX 4: Use API_BASE
      const res = await axios.post(`${API_BASE}/api/generate-3d`, { image_url: imgUrl });
      pollFor3D(res.data.job_id);
    } catch (e) { setLoading(false); }
  };

  const pollFor3D = (jobId) => {
    const interval = setInterval(async () => {
      try {
        // FIX 5: Use API_BASE
        const res = await axios.get(`${API_BASE}/api/check-status/${jobId}`);
        if (res.data.status === 'completed') {
          const glbFile = res.data.images.find(url => url.toLowerCase().endsWith('.glb'));
          if (glbFile) {
            clearInterval(interval);
            setModelUrl(glbFile);
            setLoading(false);
          }
        }
      } catch (e) { console.error(e); }
    }, 3000);
  };

  const handlePrepareGCode = async () => {
    if (!exporterRef.current) return;
    setStatus('Calculating Material Costs...');
    setLoading(true);
    try {
      const stlData = exporterRef.current.exportSTL();
      const blob = new Blob([stlData], { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', blob, 'gift.stl');
      
      // FIX 6: Use API_BASE
      const res = await axios.post(`${API_BASE}/api/slice`, formData);
      if (res.data.status === 'success') {
        setOrderSummary(res.data);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <div className="w-[400px] bg-slate-900 flex flex-col z-20 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg text-white"><Sparkles size={20} /></div>
          <h1 className="text-white font-bold text-lg">GiftAI Studio</h1>
        </div>
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>{m.content}</div>
            </div>
          ))}
          {loading && <div className="text-blue-400 text-xs animate-pulse flex items-center gap-2"><Loader2 className="animate-spin" size={12}/> {status}</div>}
        </div>
        <div className="p-6 bg-slate-900 border-t border-slate-800">
          <input className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Describe interests..."/>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col bg-[#f8fafc]">
        <div className="absolute top-6 left-6 flex gap-3 z-10">
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-black text-slate-600 shadow-sm border border-slate-100"><Cpu size={14} className="text-blue-500" /> GPU: ACTIVE</div>
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-black text-slate-600 shadow-sm border border-slate-100"><Layers size={14} className="text-green-500" /> DfAM: ENFORCED</div>
        </div>

        {showPedestalUI && <PedestalControls settings={pedestalSettings} setSettings={setPedestalSettings} onPrepare={() => setShowPedestalUI(false)} />}
        
        <main className="flex-1 p-12 flex items-center justify-center">
          {!modelUrl && generatedImages.length === 0 && !loading && <Box size={80} className="text-slate-200 opacity-20" />}
          
          {!modelUrl && generatedImages.length > 0 && (
            <div className="grid grid-cols-2 gap-10 w-full max-w-5xl">
              {generatedImages.map((img, i) => (
                <div key={i} onClick={() => handleSelectImage(img)} className="cursor-pointer rounded-[40px] overflow-hidden shadow-2xl border-8 border-white hover:scale-105 transition-all">
                  <img src={img} alt="Design" className="w-full h-96 object-cover bg-white" />
                </div>
              ))}
            </div>
          )}

          {modelUrl && (
            <div className="w-full h-full flex flex-col relative animate-in fade-in">
              <div className="flex-1 bg-white rounded-[50px] shadow-2xl overflow-hidden border-[12px] border-white ring-1 ring-slate-200">
                <ModelViewer url={modelUrl} pedestalSettings={pedestalSettings} exporterRef={exporterRef} />
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
                  <button onClick={() => setShowPedestalUI(!showPedestalUI)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold shadow-xl">CUSTOMIZE BASE</button>
                  <button onClick={handlePrepareGCode} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:bg-blue-700 transition-all">PREPARE G-CODE</button>
                </div>
              </div>
            </div>
          )}
        </main>

        {orderSummary && !isOrdered && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl">
              <h2 className="text-3xl font-black text-center mb-8">Order Summary</h2>
              <div className="space-y-4 mb-10 text-sm">
                <div className="flex justify-between p-4 bg-slate-50 rounded-xl"><span>Print Time</span><span className="font-bold">{orderSummary.print_time}</span></div>
                <div className="flex justify-between p-4 bg-slate-50 rounded-xl"><span>Weight</span><span className="font-bold">{orderSummary.weight}g</span></div>
                <div className="flex justify-between text-2xl font-black pt-6 border-t border-dashed"><span>Total Price</span><span className="text-blue-600">{orderSummary.price}€</span></div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setOrderSummary(null)} className="flex-1 font-bold text-slate-400">Cancel</button>
                <button onClick={() => setIsOrdered(true)} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg">PAY & SHIP 🚀</button>
              </div>
            </div>
          </div>
        )}

        {isOrdered && (
          <div className="absolute inset-0 bg-white z-[110] flex items-center justify-center text-center">
            <div className="max-w-md p-12">
              <CheckCircle2 size={80} className="text-green-500 mx-auto mb-8" />
              <h2 className="text-4xl font-black mb-4">Order Sent!</h2>
              <p className="text-slate-500 mb-8 font-medium">The G-Code has been sent to production. Your gift is being brought to life!</p>
              <button onClick={() => window.location.reload()} className="text-blue-600 font-bold border-b-2 border-blue-600">New Design</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}