export interface LocalUser {
  id: string;
  name: string;
  avatarColor: string;
}

const AVATAR_COLORS = [
  '#6366F1',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#8B5CF6',
  '#14B8A6',
  '#F43F5E'
];

function generateRandomName(): string {
  const adjectives = ['Cosmic', 'Neon', 'Starlit', 'Velvet', 'Cyber', 'Solar', 'Lunar', 'Astral'];
  const nouns = ['Voyager', 'Cinemaniac', 'Spectator', 'Pilot', 'Nomad', 'Rebel', 'Viewer', 'Watcher'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj} ${noun} ${num}`;
}

export function getOrCreateIdentity(): LocalUser {
  const storedId = localStorage.getItem('watch_party_user_id');
  const storedName = localStorage.getItem('watch_party_user_name');
  const storedColor = localStorage.getItem('watch_party_user_color');

  if (storedId && storedName && storedColor) {
    return {
      id: storedId,
      name: storedName,
      avatarColor: storedColor
    };
  }

  const id = storedId || `user_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  const name = storedName || generateRandomName();
  const avatarColor = storedColor || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  localStorage.setItem('watch_party_user_id', id);
  localStorage.setItem('watch_party_user_name', name);
  localStorage.setItem('watch_party_user_color', avatarColor);

  return { id, name, avatarColor };
}

export function updateIdentity(name: string, avatarColor: string): LocalUser {
  const current = getOrCreateIdentity();
  const updated: LocalUser = {
    ...current,
    name: name.trim() || current.name,
    avatarColor
  };

  localStorage.setItem('watch_party_user_name', updated.name);
  localStorage.setItem('watch_party_user_color', updated.avatarColor);

  return updated;
}

export { AVATAR_COLORS };
