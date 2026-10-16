import React, { useState, useMemo } from 'react';
import { Movie } from '@watch-party/shared';
import { SearchIcon, XIcon, PlayIcon, SparklesIcon, SlidersIcon, ClockIcon } from '../icons';

interface MovieDiscoveryModalProps {
  movies: Movie[];
  currentMovie: Movie;
  canControl: boolean;
  onPlayMovie: (movie: Movie) => void;
  onAddToQueue: (movie: Movie) => void;
  onClose: () => void;
}

const GENRES = ['Action', 'Sci-Fi', 'Animation', 'Drama', 'Comedy', 'Fantasy', 'Adventure', 'Short Films', 'Trending'];
const LANGUAGES = ['All', 'English', 'Japanese', 'French', 'German', 'Spanish'];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase().trim();
  if (!q) return 1;
  if (t === q) return 100;
  if (t.includes(q)) return 80;
  const words = t.split(/\s+/);
  for (const w of words) {
    if (w.startsWith(q)) return 70;
    if (levenshtein(q, w) <= 2) return 50;
  }
  const fullDist = levenshtein(q, t);
  const similarity = 1 - fullDist / Math.max(q.length, t.length);
  return similarity > 0.4 ? similarity * 40 : 0;
}

export const MovieDiscoveryModal: React.FC<MovieDiscoveryModalProps> = ({
  movies,
  currentMovie,
  canControl,
  onPlayMovie,
  onAddToQueue,
  onClose
}) => {
  const [search, setSearch] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('All');

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const recommendations = useMemo(() => {
    return movies
      .filter(m => m.id !== currentMovie.id)
      .map(m => {
        let score = 0;
        for (const g of m.genres) {
          if (currentMovie.genres.includes(g)) score += 3;
        }
        if (m.language === currentMovie.language) score += 1;
        score += Math.max(0, 2 - Math.abs(m.rating - currentMovie.rating));
        return { movie: m, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(item => item.movie);
  }, [movies, currentMovie]);

  const filteredMovies = useMemo(() => {
    let result = [...movies];

    if (activeTab !== 'All') {
      result = result.filter(m => m.genres.includes(activeTab) || (activeTab === 'Trending' && m.rating >= 8.2));
    }

    if (selectedGenres.length > 0) {
      result = result.filter(m => selectedGenres.every(g => m.genres.includes(g)));
    }

    if (minRating > 0) {
      result = result.filter(m => m.rating >= minRating);
    }

    if (selectedLanguage !== 'All') {
      result = result.filter(m => m.language.toLowerCase() === selectedLanguage.toLowerCase());
    }

    if (search.trim()) {
      const q = search.trim();
      result = result
        .map(m => ({
          movie: m,
          score: Math.max(fuzzyScore(q, m.title) * 2, fuzzyScore(q, m.description))
        }))
        .filter(item => item.score > 20)
        .sort((a, b) => b.score - a.score)
        .map(item => item.movie);
    }

    return result;
  }, [movies, activeTab, selectedGenres, minRating, selectedLanguage, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <SparklesIcon size={20} className="text-amber-400" />
            <h2 className="font-bold text-base text-slate-100">Movie Catalog & Discovery</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {filteredMovies.length} movies
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <XIcon size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-900/90 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search movies with typo tolerance (e.g. 'intersteler', 'sintel')..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-brand-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                showFilters || selectedGenres.length > 0 || minRating > 0 || selectedLanguage !== 'All'
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <SlidersIcon size={14} />
              <span>Filters</span>
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {['All', ...GENRES].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  activeTab === tab
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {showFilters && (
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Multi-Select Genres:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map(g => (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        selectedGenres.includes(g)
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Min Rating: {minRating > 0 ? `${minRating}+` : 'Any'}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="9"
                    step="0.5"
                    value={minRating}
                    onChange={e => setMinRating(parseFloat(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Language:
                  </span>
                  <select
                    value={selectedLanguage}
                    onChange={e => setSelectedLanguage(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {!search && selectedGenres.length === 0 && activeTab === 'All' && recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon size={16} className="text-amber-400" />
                <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                  Because the group liked "{currentMovie.title}"
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {recommendations.map(m => (
                  <div
                    key={m.id}
                    className="group relative bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden hover:border-brand-500/60 transition shadow flex flex-col"
                  >
                    <img src={m.poster} alt={m.title} className="w-full h-32 object-cover" />
                    <div className="p-2 flex-1 flex flex-col justify-between">
                      <h4 className="font-bold text-xs text-slate-100 truncate">{m.title}</h4>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>⭐ {m.rating}</span>
                        <span>{Math.floor(m.runtime / 60)}m</span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {canControl && (
                          <button
                            onClick={() => onPlayMovie(m)}
                            className="flex-1 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded text-[10px] font-semibold"
                          >
                            Play
                          </button>
                        )}
                        <button
                          onClick={() => onAddToQueue(m)}
                          className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[10px] font-semibold"
                        >
                          Queue
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-xs text-slate-300 uppercase tracking-wider mb-3">
              Catalog Titles ({filteredMovies.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredMovies.map(movie => (
                <div
                  key={movie.id}
                  className="group bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 hover:border-brand-500/50 rounded-xl overflow-hidden transition-all shadow-md flex flex-col"
                >
                  <div className="relative aspect-2/3 overflow-hidden bg-slate-950">
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-mono text-amber-300 font-bold border border-amber-400/20">
                      ⭐ {movie.rating}
                    </div>
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-mono text-slate-300 border border-slate-700">
                      {movie.year}
                    </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-100 truncate group-hover:text-brand-300 transition">
                        {movie.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                        {movie.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-700/40 flex items-center gap-1.5">
                      {canControl && (
                        <button
                          onClick={() => onPlayMovie(movie)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold shadow transition"
                        >
                          <PlayIcon size={12} />
                          <span>Play</span>
                        </button>
                      )}
                      <button
                        onClick={() => onAddToQueue(movie)}
                        className="flex-1 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
                      >
                        + Queue
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
