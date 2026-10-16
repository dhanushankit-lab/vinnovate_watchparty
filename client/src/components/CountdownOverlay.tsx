import React, { useEffect, useState } from 'react';

interface CountdownOverlayProps {
  startsAtServerTime: number;
  getServerTime: () => number;
  onFinish: () => void;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  startsAtServerTime,
  getServerTime,
  onFinish
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = getServerTime();
      const diffMs = startsAtServerTime - now;
      if (diffMs <= -800) {
        clearInterval(interval);
        onFinish();
      } else if (diffMs <= 0) {
        setSecondsRemaining(0);
      } else {
        setSecondsRemaining(Math.ceil(diffMs / 1000));
      }
    }, 50);

    return () => clearInterval(interval);
  }, [startsAtServerTime, getServerTime, onFinish]);

  if (secondsRemaining === null) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md pointer-events-none transition-all">
      <div className="text-center animate-bounce">
        <div className="text-slate-400 font-medium uppercase tracking-widest text-sm mb-2">
          Watch Together In
        </div>
        <div className="text-8xl md:text-9xl font-black bg-gradient-to-tr from-brand-400 via-pink-400 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(99,102,241,0.6)]">
          {secondsRemaining === 0 ? 'START!' : secondsRemaining}
        </div>
      </div>
    </div>
  );
};
