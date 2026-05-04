import React from 'react';

const SkeletonPreview = () => (
  <div className="space-y-12 animate-pulse-slow">
    <div className="card-premium overflow-hidden ring-1 ring-white/5">
      <div className="bg-slate-800/40 h-24 border-b border-slate-700/30"></div>
      <div className="p-10 space-y-8">
        <div className="h-40 w-full bg-slate-800/20 rounded-[2rem] border border-slate-800/30"></div>
      </div>
    </div>
    
    <div className="space-y-8">
      <div className="h-64 w-full bg-slate-800/20 rounded-[2.5rem] border border-slate-800/30"></div>
      <div className="grid grid-cols-2 gap-8">
          <div className="h-48 w-full bg-slate-800/20 rounded-[2.5rem] border border-slate-800/30"></div>
          <div className="h-48 w-full bg-slate-800/20 rounded-[2.5rem] border border-slate-800/30"></div>
      </div>
    </div>
  </div>
);


export default SkeletonPreview;
