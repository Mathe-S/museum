import type * as Party from "partykit/server";

// Partykit server for real-time multiplayer presence
// Will be fully implemented in task 22

export default class MuseumServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Handle visitor connection
    console.log(
      `Visitor ${conn.id} connected to museum ${this.room.id}`
    );
  }

  onMessage(message: string, sender: Party.Connection) {
    // Handle incoming messages (position updates, comments)
    console.log(`Message from ${sender.id}:`, message);
  }

  onClose(conn: Party.Connection) {
    // Handle visitor disconnection
    console.log(`Visitor ${conn.id} disconnected from museum ${this.room.id}`);
  }
}

MuseumServer satisfies Party.Worker;
