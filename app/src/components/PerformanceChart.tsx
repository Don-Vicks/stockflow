export function PerformanceChart() {
  return (
    <div className="w-full h-48 border border-line bg-panel rounded-xl flex items-end p-4 relative overflow-hidden group">
      {/* Grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between opacity-10 py-4 px-4 pointer-events-none">
        <div className="w-full h-px bg-white"></div>
        <div className="w-full h-px bg-white"></div>
        <div className="w-full h-px bg-white"></div>
        <div className="w-full h-px bg-white"></div>
      </div>
      {/* Fake SVG Line */}
      <svg className="w-full h-full relative z-10" viewBox="0 0 100 40" preserveAspectRatio="none">
        <path 
          d="M0,35 Q10,32 20,25 T40,20 T60,15 T80,5 T100,2" 
          fill="none" 
          stroke="#4FD1A5" 
          strokeWidth="1.5" 
          className="drop-shadow-[0_4px_6px_rgba(79,209,165,0.2)]"
        />
        <path 
          d="M0,40 L0,35 Q10,32 20,25 T40,20 T60,15 T80,5 T100,2 L100,40 Z" 
          fill="url(#grad)" 
          opacity="0.2"
        />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4FD1A5" stopOpacity="1" />
            <stop offset="100%" stopColor="#4FD1A5" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
