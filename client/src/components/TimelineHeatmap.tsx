import React from 'react';
import { HEATMAP_BUCKET_SECONDS } from '@watch-party/shared';

interface TimelineHeatmapProps {
  heatmap: Record<number, number>;
  duration: number;
  onSeekTo: (seconds: number) => void;
}

export const TimelineHeatmap: React.FC<TimelineHeatmapProps> = ({ heatmap, duration, onSeekTo }) => {
  if (duration <= 0) return null;

  const entries = Object.entries(heatmap);
  if (entries.length === 0) return null;

  const maxCount = Math.max(...entries.map(([_, count]) => count), 1);

  return (
    <div className="absolute inset-x-0 bottom-full mb-1 h-3 pointer-events-none flex items-end">
      {entries.map(([bucketStr, count]) => {
        const bucket = parseInt(bucketStr, 10);
        const startTime = bucket * HEATMAP_BUCKET_SECONDS;
        if (startTime > duration) return null;

        const leftPercent = (startTime / duration) * 100;
        const widthPercent = Math.max(1, (HEATMAP_BUCKET_SECONDS / duration) * 100);
        const heightPercent = Math.max(25, (count / maxCount) * 100);

        return (
          <button
            key={bucket}
            onClick={(e) => {
              e.stopPropagation();
              onSeekTo(startTime);
            }}
            title={`Hotspot at ${Math.floor(startTime / 60)}:${Math.floor(startTime % 60).toString().padStart(2, '0')} (${count} reactions)`}
            className="absolute bottom-0 rounded-t bg-gradient-to-t from-rose-500/80 via-amber-400/80 to-yellow-300 pointer-events-auto hover:brightness-125 transition-all shadow-sm"
            style={{
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              height: `${heightPercent}%`,
              minWidth: '4px'
            }}
          />
        );
      })}
    </div>
  );
};
