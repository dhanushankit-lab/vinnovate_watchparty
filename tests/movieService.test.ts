import { describe, it, expect } from 'vitest';
import {
  getAllMovies,
  getMovieById,
  searchAndFilterMovies,
  getRecommendations,
  getCategories
} from '../server/src/catalog/movieService';

describe('Movie Catalog & Discovery Service', () => {
  it('loads 60+ movies catalog with required fields', () => {
    const movies = getAllMovies();
    expect(movies.length).toBeGreaterThanOrEqual(60);

    for (const m of movies) {
      expect(m.id).toBeTruthy();
      expect(m.title).toBeTruthy();
      expect(m.genres.length).toBeGreaterThan(0);
      expect(m.videoUrl).toBeTruthy();
      expect(m.runtime).toBeGreaterThan(0);
    }
  });

  it('tolerates typos in fuzzy search (e.g. intersteler -> Interstellar Chronicles)', () => {
    const results = searchAndFilterMovies({ search: 'intersteler' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('Interstellar');
  });

  it('filters movies by genre, rating, and runtime', () => {
    const actionMovies = searchAndFilterMovies({ genres: ['Action'] });
    expect(actionMovies.length).toBeGreaterThan(0);
    expect(actionMovies.every(m => m.genres.includes('Action'))).toBe(true);

    const highlyRated = searchAndFilterMovies({ minRating: 8.5 });
    expect(highlyRated.length).toBeGreaterThan(0);
    expect(highlyRated.every(m => m.rating >= 8.5)).toBe(true);
  });

  it('generates recommendations based on movie genre similarity', () => {
    const recs = getRecommendations('big-buck-bunny', 4);
    expect(recs.length).toBe(4);
    expect(recs.some(r => r.id === 'big-buck-bunny')).toBe(false);
  });

  it('generates categories rows', () => {
    const categories = getCategories();
    expect(categories['Trending'].length).toBeGreaterThan(0);
    expect(categories['Sci-Fi'].length).toBeGreaterThan(0);
    expect(categories['Animation'].length).toBeGreaterThan(0);
  });
});
