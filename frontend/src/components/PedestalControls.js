"use client";
import { Settings, Type, MoveVertical, Maximize, CheckCircle2 } from 'lucide-react';

export default function PedestalControls({ settings, setSettings, onPrepare }) {
  return (
    <div className="absolute top-12 right-8 w-80 glass-card rounded-[32px] p-8 shadow-2xl z-50 border border-white/50 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center gap-3 mb-8 border-b border-slate-200 pb-4">
        <div className="bg-blue-100 p-2 rounded-xl">
          <Settings size={20} className="text-blue-600" />
        </div>
        <h3 className="font-extrabold text-slate-800 text-lg">Base Customization</h3>
      </div>

      <div className="space-y-8">
        {/* Shape Toggle */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3">Pedestal Shape</label>
          <div className="flex gap-2 p-1.5 bg-slate-100/50 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setSettings({...settings, shape: 'cylinder'})}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${settings.shape === 'cylinder' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Cylinder
            </button>
            <button 
              onClick={() => setSettings({...settings, shape: 'box'})}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${settings.shape === 'box' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Rounded Square
            </button>
          </div>
        </div>

        {/* Dimensions */}
        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Model Position</label>
              <span className="text-sm font-mono font-bold text-blue-600">{settings.offset}</span>
            </div>
            <input type="range" min="-50" max="50" step="1" value={settings.offset} 
              onChange={(e) => setSettings({...settings, offset: parseInt(e.target.value)})}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500" 
            />
          </div>

          {/* NEW: Scale Slider */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Model Scale</label>
              <span className="text-sm font-mono font-bold text-blue-600">{settings.scale}x</span>
            </div>
            <input type="range" min="0.1" max="3.0" step="0.1" value={settings.scale} 
              onChange={(e) => setSettings({...settings, scale: parseFloat(e.target.value)})}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-500" 
            />
          </div>
        </div>

        {/* Text Input */}
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Engraved Text</label>
          <div className="relative group">
            <Type className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              type="text" 
              maxLength={20}
              placeholder="Type engraving..."
              className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
              value={settings.text}
              onChange={(e) => setSettings({...settings, text: e.target.value})}
            />
          </div>
        </div>

        <button 
          onClick={onPrepare}
          className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 mt-4"
        >
          <CheckCircle2 size={20} /> GENERATE FINAL STL
        </button>
      </div>
    </div>
  );
}