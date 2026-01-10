"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Send, Loader2, Box, Sparkles, Cpu, Layers, Download, CheckCircle2 } from 'lucide-react';

// 1. Import the components
import PedestalControls from '../components/PedestalControls';

const handlePrepareGCode = async () => {
  if (!exporterRef.current) return;
  
  setStatus('Slicing Model for 3D Printing...');
  setLoading(true);

  try {
    // 1. Convert the 3D scene (Horse + Pedestal) to STL data
    const stlData = exporterRef.current.exportSTL();
    const blob = new Blob([stlData], { type: 'application/octet-stream' });
    
    // 2. Upload the STL to your Python backend
    const formData = new FormData();
    formData.append('file', blob, 'gift.stl');

    const res = await axios.post('http://localhost:8000/api/slice', formData);
    
    if (res.data.gcode_url) {
      // 3. Success! Open the G-Code link to download it
      window.location.href = res.data.gcode_url;
      setStatus('G-Code Downloaded!');
    }
  } catch (e) {
    console.error(e);
    setStatus('Slicing failed. Check Backend.');
  }
  setLoading(false);
};

const handleExportAndSlice = async () => {
  setStatus('Preparing Manufacturing Files...');
  setLoading(true);

  try {
    // 1. Get the STL from the viewer
    const stlData = exporterRef.current.exportSTL();
    const blob = new Blob([stlData], { type: 'application/octet-stream' });
    
    // 2. Send to Backend for Slicing
    const formData = new FormData();
    formData.append('file', blob, 'gift.stl');

    const res = await axios.post('http://localhost:8000/api/slice', formData);
    
    if (res.data.gcode_url) {
      // 3. Download the G-Code automatically
      window.location.href = res.data.gcode_url;
      setStatus('G-Code Ready!');
    }
  } catch (e) {
    console.error(e);
    setStatus('Error in Slicing');
  }
  setLoading(false);
};


// 2. Setup the 3D Viewer with SSR disabled
const ModelViewer = dynamic(() => import('../components/ModelViewer'), { 
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40}/> 
      <p className="text-slate-400 animate-pulse">Initializing 3D Engine...</p>
    </div>
  )
});

export default function Home() {
  // --- ALL STATE VARIABLES DEFINED HERE ---
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to the AI 3D Gift Studio. Tell me about the recipient's hobbies or favorite objects to begin." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [modelUrl, setModelUrl] = useState(null);
  const [status, setStatus] = useState('');
  const scrollRef = useRef(null);

  // PEDESTAL STATE (The part that caused the error)
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
          const glbFile = res.data.images.find(url => url.toLowerCase().endsWith('.glb'));
          if (glbFile) {
            clearInterval(interval);
            setModelUrl(glbFile); 
            setLoading(false);
            setStatus('Generation Successful');
          }
        }
      } catch (e) { clearInterval(interval); }
    }, 3000);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900 tracking-tight">
      
      {/* LEFT SIDEBAR: CHAT */}
      <div className="w-[400px] bg-slate-900 flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">GiftAI Studio</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black opacity-50">3D Generation Engine</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${
                m.role === 'user' 
                ? 'bg-blue-600 text-white shadow-blue-900/20' 
                : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-blue-400 text-[10px] font-bold uppercase tracking-widest animate-pulse flex items-center gap-2">
              <Loader2 className="animate-spin" size={12}/> {status}
            </div>
          )}
        </div>
        
        <div className="p-6 bg-slate-900 border-t border-slate-800">
          <div className="relative group">
            <input 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 pl-4 pr-12 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-500"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Describe interests..."
            />
            <button onClick={sendMessage} className="absolute right-2 top-2 p-2 text-slate-400 hover:text-blue-400 transition-colors"><Send size={18} /></button>
          </div>
        </div>
      </div>

      {/* MAIN WORKBENCH */}
      <div className="flex-1 relative flex flex-col overflow-hidden bg-[#f8fafc]">
        
        {/* INDICATORS */}
        <div className="absolute top-6 left-6 flex gap-3 z-10">
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-black text-slate-600 shadow-sm border border-slate-100">
            <Cpu size={14} className="text-blue-500" /> GPU: ACTIVE
          </div>
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-black text-slate-600 shadow-sm border border-slate-100">
            <Layers size={14} className="text-green-500" /> DfAM: ENFORCED
          </div>
        </div>

        {/* --- PEDESTAL CONTROLS (CONDITIONAL RENDERING) --- */}
        {showPedestalUI && (
          <PedestalControls 
            settings={pedestalSettings} 
            setSettings={setPedestalSettings} 
            onPrepare={() => alert("Ready to Export STL!")}
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
                <div key={i} className="group relative cursor-pointer rounded-[40px] overflow-hidden shadow-2xl border-8 border-white transition-all hover:scale-[1.03] hover:rotate-1" onClick={() => handleSelectImage(img)}>
                  <img src={img} alt="AI Design" className="w-full h-96 object-cover bg-slate-100" />
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
                 <ModelViewer url={modelUrl} pedestalSettings={pedestalSettings} exporterRef={exporterRef} />
                 
                 <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
                   <button 
                     onClick={() => setShowPedestalUI(!showPedestalUI)}
                     className={`px-8 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 transition-all ${showPedestalUI ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-900 text-white'}`}
                   >
                     <Layers size={20}/> {showPedestalUI ? 'HIDE SETTINGS' : 'CUSTOMIZE BASE'}
                   </button>
                   <button onClick={handleExportAndSlice} className="bg-blue-600 ..." >
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