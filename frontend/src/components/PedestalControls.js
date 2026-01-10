"use client";
import { Settings, Type, MoveVertical, Maximize } from 'lucide-react';

export default function PedestalControls({ settings, setSettings, onPrepare }) {
  return (
    <div className="absolute top-24 right-6 w-72 glass-card rounded-3xl p-6 shadow-2xl animate-in slide-in-from-right-4 duration-500 z-30">
      <div className="flex items-center gap-2 mb-6 border-b pb-2">
        <Settings size={18} className="text-blue-500" />
        <h3 className="font-bold text-slate-700">Pedestal Settings</h3>
      </div>

      <div className="space-y-6">
        {/* Shape Toggle */}
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Shape</label>
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button 
              onClick={() => setSettings({...settings, shape: 'cylinder'})}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${settings.shape === 'cylinder' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
            >
              Cylinder
            </button>
            <button 
              onClick={() => setSettings({...settings, shape: 'box'})}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${settings.shape === 'box' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
            >
              Square
            </button>
          </div>
        </div>

        {/* Dimensions */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-bold text-slate-500">Height (mm)</label>
              <span className="text-xs font-mono text-blue-600">{settings.height}</span>
            </div>
            <input type="range" min="2" max="20" value={settings.height} 
              onChange={(e) => setSettings({...settings, height: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-bold text-slate-500">Radius (mm)</label>
              <span className="text-xs font-mono text-blue-600">{settings.radius}</span>
            </div>
            <input type="range" min="10" max="50" value={settings.radius} 
              onChange={(e) => setSettings({...settings, radius: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
            />
          </div>
        </div>

        {/* Text Input */}
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Engraving</label>
          <div className="relative">
            <Type className="absolute left-3 top-3 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="e.g. For Dad"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={settings.text}
              onChange={(e) => setSettings({...settings, text: e.target.value})}
            />
          </div>
        </div>

        <button 
          onClick={onPrepare}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={18} /> GENERATE FINAL STL
        </button>
      </div>
    </div>
  );
}

// Add this import to the top of the file
import { CheckCircle2 } from 'lucide-react';