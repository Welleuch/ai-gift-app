"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Send, Loader2, Box, Sparkles, Cpu, Layers, Download, CheckCircle2 } from 'lucide-react';

// 1. Import Pedestal Controls
import PedestalControls from '../components/PedestalControls';

// 2. Setup the 3D Viewer with SSR disabled
const ModelViewer = dynamic(() => import('../components/ModelViewer'), { 
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40}/> 
      <p className="text-slate-400 animate-pulse font-bold uppercase tracking-widest text-xs">Initializing 3D Engine...</p>
    </div>
  )
});

const [orderSummary, setOrderSummary] = useState(null);
const [isOrdered, setIsOrdered] = useState(false);

export default function Home() {
  // --- STATE ---
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to the AI 3D Gift Studio. Tell me about the recipient's hobbies or favorite objects to begin." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [modelUrl, setModelUrl] = useState(null);
  const [status, setStatus] = useState('');
  const scrollRef = useRef(null);

  // --- PEDESTAL & EXPORT STATE ---
  const exporterRef = useRef(null); // <--- THIS WAS THE MISSING LINE
  const [showPedestalUI, setShowPedestalUI] = useState(false);
  const [pedestalSettings, setPedestalSettings] = useState({
    shape: 'box',
    height: 10,
    radius: 30,
    text: '',
    offset: 0,
    scale: 1.0
  });

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
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection lost. Is the backend running?" }]);
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
    setShowPedestalUI(false); 
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
          // Look for the GLB file
          const glbFile = res.data.images.find(url => url.toLowerCase().endsWith('.glb'));
          if (glbFile) {
            console.log("3D Model URL:", glbFile);
            clearInterval(interval);
            setModelUrl(glbFile); // This updates the viewer
            setLoading(false);
            setStatus('Ready to Customize!');
          }
        }
      } catch (e) { console.error(e); }
    }, 3000);
  };

  // --- NEW: SLICING HANDLER ---
  const handlePrepareGCode = async () => {
    if (!exporterRef.current) return;
    
    // 1. UI Feedback
    setStatus('Analyzing G-Code & Calculating Price...');
    setLoading(true);

    try {
      // 2. Export and Upload
      const stlData = exporterRef.current.exportSTL();
      const blob = new Blob([stlData], { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', blob, 'gift.stl');

      // 3. Talk to Backend
      const res = await axios.post('http://localhost:8000/api/slice', formData);
      
      if (res.data.status === 'success') {
        // --- THE FIX: Instead of window.location.href, we save the data to state ---
        console.log("Slicing complete. Received metadata:", res.data);
        setOrderSummary(res.data); // This triggers the Modal
        setStatus('Ready for Checkout');
      } else {
        alert("Slicing failed: " + res.data.message);
      }
    } catch (e) {
      console.error(e);
      setStatus('Connection Error');
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      
      {/* SIDEBAR */}
      <div className="w-[400px] bg-slate-900 flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg text-white"><Sparkles size={20} /></div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">GiftAI Studio</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black opacity-50">3D Generation Engine</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${
                m.role === 'user' ? 'bg-blue-600 text-white shadow-blue-900/20' : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}>{m.content}</div>
            </div>
          ))}
          {loading && <div className="text-blue-400 text-[10px] font-bold uppercase tracking-widest animate-pulse flex items-center gap-2"><Loader2 className="animate-spin" size={12}/> {status}</div>}
        </div>
        
        <div className="p-6 bg-slate-900 border-t border-slate-800">
          <div className="relative group">
            <input 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 pl-4 pr-12 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-500 font-medium"
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Describe interests..."
            />
            <button onClick={sendMessage} className="absolute right-2 top-2 p-2 text-slate-400 hover:text-blue-400 transition-colors"><Send size={18} /></button>
          </div>
        </div>
      </div>

      {/* MAIN WORKBENCH */}
      <div className="flex-1 relative flex flex-col overflow-hidden bg-[#f8fafc]">
        <div className="absolute top-6 left-6 flex gap-3 z-10">
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-black text-slate-600 shadow-sm border border-slate-100"><Cpu size={14} className="text-blue-500" /> GPU: ACTIVE</div>
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-black text-slate-600 shadow-sm border border-slate-100"><Layers size={14} className="text-green-500" /> DfAM: ENFORCED</div>
        </div>

        {showPedestalUI && (
          <PedestalControls 
            settings={pedestalSettings} 
            setSettings={setPedestalSettings} 
            onPrepare={() => setShowPedestalUI(false)}
          />
        )}

        <main className="flex-1 p-12 flex items-center justify-center">
          {!modelUrl && generatedImages.length === 0 && !loading && (
            <div className="text-center">
              <Box size={80} className="mx-auto mb-6 text-slate-200" />
              <h2 className="text-slate-400 font-black uppercase tracking-[0.3em] text-sm">Design Workbench</h2>
            </div>
          )}

          {loading && generatedImages.length === 0 && !modelUrl && (
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h2 className="text-xl font-extrabold text-slate-800">{status}</h2>
            </div>
          )}

          {!modelUrl && generatedImages.length > 0 && (
            <div className="grid grid-cols-2 gap-10 w-full max-w-5xl animate-in fade-in zoom-in duration-700">
              {generatedImages.map((img, i) => (
                <div key={i} className="group relative cursor-pointer rounded-[40px] overflow-hidden shadow-2xl border-8 border-white transition-all hover:scale-[1.03] bg-white" onClick={() => handleSelectImage(img)}>
                  <img src={img} alt="AI Design" className="w-full h-96 object-cover" />
                  <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                    <div className="bg-white text-blue-600 px-8 py-3 rounded-2xl font-black shadow-2xl tracking-tighter">GENERATE 3D MESH</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* --- 3D VIEWER --- */}
          {modelUrl && (
            <div className="w-full h-full flex flex-col gap-6 animate-in fade-in duration-1000">
              <div className="flex-1 bg-white rounded-[50px] shadow-2xl overflow-hidden relative border-[12px] border-white ring-1 ring-slate-200">
                 <ModelViewer 
                   url={modelUrl} 
                   pedestalSettings={pedestalSettings} 
                   exporterRef={exporterRef} // <--- PASSING THE REF CORRECTLY
                 />
                 
                 <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
                   <button 
                     onClick={() => setShowPedestalUI(!showPedestalUI)}
                     className={`px-8 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 transition-all ${showPedestalUI ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-900 text-white'}`}
                   >
                     <Layers size={20}/> {showPedestalUI ? 'HIDE SETTINGS' : 'CUSTOMIZE BASE'}
                   </button>
                   <button 
                     onClick={handlePrepareGCode} // <--- LINKED TO THE NEW HANDLER
                     className="bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-2xl hover:bg-blue-700 font-bold flex items-center gap-3 transition-transform hover:scale-105 active:scale-95"
                   >
                     <Download size={20}/> PREPARE G-CODE
                   </button>
                 </div>
              </div>
            </div>
          )}
      {/* CHECKOUT MODAL OVERLAY */}
      {orderSummary && !isOrdered && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl border border-white/20">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Order Summary</h2>
              <div className="h-1 w-12 bg-blue-500 mx-auto mt-2 rounded-full"></div>
            </div>
            
            <div className="space-y-4 mb-10">
              <div className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-500 font-bold text-sm uppercase tracking-wider">Print Time</span>
                <span className="text-slate-900 font-black">{orderSummary.print_time}</span>
              </div>
              <div className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-500 font-bold text-sm uppercase tracking-wider">Material (PLA)</span>
                <span className="text-slate-900 font-black">{orderSummary.weight}g</span>
              </div>
              
              <div className="pt-6 border-t border-dashed border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400 font-medium">Processing & Packaging</span>
                  <span className="text-slate-600 font-bold">12.00€</span>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-slate-900 font-black text-lg underline decoration-blue-500 underline-offset-4">Total Price</span>
                  <span className="text-3xl font-black text-blue-600">{orderSummary.price}€</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setOrderSummary(null)}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all uppercase text-xs tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsOrdered(true)}
                className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all transform hover:-translate-y-1 active:translate-y-0"
              >
                PAY & SHIP 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS SCREEN */}
      {isOrdered && (
        <div className="absolute inset-0 bg-white z-[110] flex items-center justify-center text-center p-12 animate-in slide-in-from-bottom-10 duration-700">
          <div className="max-w-md">
            <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-green-100">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Order Confirmed!</h2>
            <p className="text-slate-500 leading-relaxed font-medium text-lg mb-10">
              The G-Code has been sent to our manufacturing partner. Your gift is being brought to life!
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors shadow-lg"
            >
              Design Another Gift
            </button>
          </div>
        </div>
      )}        
        </main>
      </div>
    </div>
  );
}