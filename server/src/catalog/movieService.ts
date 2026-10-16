import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Movie } from '@watch-party/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.resolve(__dirname, 'movies.json');
const rawData = fs.readFileSync(jsonPath, 'utf-8');
const movies: Movie[] = JSON.parse(rawData);

export function getAllMovies(): Movie[] {
  return movies;
}

export function getMovieById(id: string): Movie | undefined {
  return movies.find(m => m.id === id);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

function computeFuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  if (!q) return 1;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80 + (q.length / t.length) * 10;
  if (t.includes(q)) return 60 + (q.length / t.length) * 10;

  const words = t.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(q)) return 70;
    const dist = levenshteinDistance(q, word);
    if (dist <= 2) return 50 - dist * 10;
  }

  const fullDist = levenshteinDistance(q, t);
  const maxLen = Math.max(q.length, t.length);
  const similarity = 1 - fullDist / maxLen;
  if (similarity > 0.5) return similarity * 40;

  return 0;
}

export interface MovieFilterOptions {
  genres?: string[];
  minYear?: number;
  maxYear?: number;
  minRating?: number;
  maxRuntime?: number;
  language?: string;
  search?: string;
}

export function searchAndFilterMovies(options: MovieFilterOptions): Movie[] {
  let result = [...movies];

  if (options.genres && options.genres.length > 0) {
    result = result.filter(m =>
      options.genres!.every(g => m.genres.includes(g))
    );
  }

  if (options.minYear !== undefined) {
    result = result.filter(m => m.year >= options.minYear!);
  }

  if (options.maxYear !== undefined) {
    result = result.filter(m => m.year <= options.maxYear!);
  }

  if (options.minRating !== undefined) {
    result = result.filter(m => m.rating >= options.minRating!);
  }

  if (options.maxRuntime !== undefined) {
    result = result.filter(m => m.runtime <= options.maxRuntime!);
  }

  if (options.language) {
    result = result.filter(m => m.language.toLowerCase() === options.language!.toLowerCase());
  }

  if (options.search && options.search.trim()) {
    const query = options.search.trim();
    const scored = result.map(m => {
      const titleScore = computeFuzzyScore(query, m.title) * 2;
      const descScore = computeFuzzyScore(query, m.description);
      const genreScore = m.genres.some(g => computeFuzzyScore(query, g) > 50) ? 30 : 0;
      return { movie: m, score: Math.max(titleScore, descScore + genreScore) };
    });

    result = scored
      .filter(item => item.score > 20)
      .sort((a, b) => b.score - a.score)
      .map(item => item.movie);
  }

  return result;
}

export function getRecommendations(seedMovieId: string, limit: number = 6): Movie[] {
  const seed = getMovieById(seedMovieId);
  if (!seed) return movies.slice(0, limit);

  return movies
    .filter(m => m.id !== seed.id)
    .map(m => {
      let score = 0;
      for (const g of m.genres) {
        if (seed.genres.includes(g)) score += 3;
      }
      if (m.language === seed.language) score += 1;
      const ratingDiff = Math.abs(m.rating - seed.rating);
      score += Math.max(0, 2 - ratingDiff);
      return { movie: m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.movie);
}

export function getCategories(): Record<string, Movie[]> {
  const categories: Record<string, Movie[]> = {
    'Trending': [],
    'Action': [],
    'Sci-Fi': [],
    'Animation': [],
    'Drama': [],
    'Comedy': [],
    'Short Films': []
  };

  for (const m of movies) {
    for (const cat of Object.keys(categories)) {
      if (m.genres.includes(cat) || (cat === 'Trending' && m.rating >= 8.0)) {
        categories[cat].push(m);
      }
    }
  }

  return categories;
}
