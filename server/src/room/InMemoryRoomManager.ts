import { Movie } from '@watch-party/shared';
import { IRoomManager } from './IRoomManager.js';
import { Room } from './Room.js';

export class InMemoryRoomManager implements IRoomManager {
  private rooms: Map<string, Room> = new Map();

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    for (let i = 0; i < 2; i++) {
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${part1}-${part2}`;
  }

  public async getRoom(code: string): Promise<Room | undefined> {
    return this.rooms.get(code.toUpperCase());
  }

  public async createRoom(hostId?: string, initialMovie?: Movie): Promise<Room> {
    let code = this.generateCode();
    while (this.rooms.has(code)) {
      code = this.generateCode();
    }

    const room = new Room(code, hostId, initialMovie, (emptyCode) => {
      this.deleteRoom(emptyCode);
    });

    this.rooms.set(code, room);
    return room;
  }

  public async deleteRoom(code: string): Promise<void> {
    const upper = code.toUpperCase();
    const room = this.rooms.get(upper);
    if (room) {
      room.destroy();
      this.rooms.delete(upper);
    }
  }

  public async hasRoom(code: string): Promise<boolean> {
    return this.rooms.has(code.toUpperCase());
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }

  public async cleanupStaleRooms(): Promise<number> {
    let cleaned = 0;
    for (const [code, room] of this.rooms.entries()) {
      if (room.getConnectedCount() === 0 && room.getParticipantCount() === 0) {
        room.destroy();
        this.rooms.delete(code);
        cleaned++;
      }
    }
    return cleaned;
  }
}
