import type { WebSocket } from "ws";

// WebRTC types for Node.js environment
type RTCSessionDescriptionInit = {
  type: "offer" | "answer";
  sdp: string;
};

type RTCIceCandidateInit = {
  candidate: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
};

// Types for our signaling messages
export type SignalingMessage =
  | { type: "join-queue"; userId: string }
  | { type: "leave-queue"; userId: string }
  | {
      type: "offer";
      offer: RTCSessionDescriptionInit;
      to: string;
      from: string;
    }
  | {
      type: "answer";
      answer: RTCSessionDescriptionInit;
      to: string;
      from: string;
    }
  | {
      type: "ice-candidate";
      candidate: RTCIceCandidateInit;
      to: string;
      from: string;
    }
  | { type: "match-found"; partnerId: string; isInitiator: boolean }
  | { type: "partner-disconnected" }
  | { type: "call-ended" };

export type ServerMessage =
  | { type: "joined-queue"; userId: string }
  | { type: "left-queue"; userId: string }
  | { type: "match-found"; partnerId: string; isInitiator: boolean }
  | { type: "offer"; offer: RTCSessionDescriptionInit; from: string }
  | { type: "answer"; answer: RTCSessionDescriptionInit; from: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; from: string }
  | { type: "partner-disconnected" }
  | { type: "error"; message: string };

// User connection tracking
interface UserConnection {
  userId: string;
  ws: WebSocket;
  partnerId?: string;
  isInQueue: boolean;
  connectedAt: Date;
}

class SpeedDatingSignaling {
  private connections = new Map<string, UserConnection>();
  private queue: string[] = [];

  addConnection(userId: string, ws: WebSocket) {
    console.log(`User ${userId} connected`);

    this.connections.set(userId, {
      userId,
      ws,
      isInQueue: false,
      connectedAt: new Date(),
    });
  }

  removeConnection(userId: string) {
    const connection = this.connections.get(userId);
    if (!connection) return;

    console.log(`User ${userId} disconnected`);

    // Remove from queue if in queue
    if (connection.isInQueue) {
      this.leaveQueue(userId);
    }

    // Notify partner if in a match
    if (connection.partnerId) {
      this.notifyPartnerDisconnected(connection.partnerId);
    }

    this.connections.delete(userId);
  }

  joinQueue(userId: string) {
    const connection = this.connections.get(userId);
    if (!connection || connection.isInQueue) return;

    console.log(`User ${userId} joined queue`);

    connection.isInQueue = true;
    this.queue.push(userId);

    // Send confirmation
    this.sendMessage(userId, { type: "joined-queue", userId });

    // Try to find a match
    this.tryMatchmaking();
  }

  leaveQueue(userId: string) {
    const connection = this.connections.get(userId);
    if (!connection || !connection.isInQueue) return;

    console.log(`User ${userId} left queue`);

    connection.isInQueue = false;
    this.queue = this.queue.filter((id) => id !== userId);

    // Send confirmation
    this.sendMessage(userId, { type: "left-queue", userId });
  }

  private tryMatchmaking() {
    if (this.queue.length < 2) return;

    // Match the first two users in queue
    const user1Id = this.queue.shift()!;
    const user2Id = this.queue.shift()!;

    const user1 = this.connections.get(user1Id);
    const user2 = this.connections.get(user2Id);

    if (!user1 || !user2) {
      // Put back in queue if connections are invalid
      if (user1) this.queue.unshift(user1Id);
      if (user2) this.queue.unshift(user2Id);
      return;
    }

    console.log(
      `🎯 Matched users: ${user1Id} (initiator) and ${user2Id} (receiver)`
    );

    // Update connection states
    user1.isInQueue = false;
    user1.partnerId = user2Id;
    user2.isInQueue = false;
    user2.partnerId = user1Id;

    // Notify both users of the match
    // User1 will be the initiator (sends offer first)
    console.log(`📢 Notifying ${user1Id} they are the initiator`);
    const user1Success = this.sendMessage(user1Id, {
      type: "match-found",
      partnerId: user2Id,
      isInitiator: true,
    });

    console.log(`📢 Notifying ${user2Id} they are the receiver`);
    const user2Success = this.sendMessage(user2Id, {
      type: "match-found",
      partnerId: user1Id,
      isInitiator: false,
    });

    if (!user1Success || !user2Success) {
      console.error(
        `❌ Failed to notify one or both users of match. User1: ${user1Success}, User2: ${user2Success}`
      );
    }
  }

  handleSignalingMessage(userId: string, message: SignalingMessage) {
    const connection = this.connections.get(userId);
    if (!connection) return;

    switch (message.type) {
      case "join-queue":
        this.joinQueue(userId);
        break;

      case "leave-queue":
        this.leaveQueue(userId);
        break;

      case "offer": {
        console.log(`📤 Forwarding offer from ${userId} to ${message.to}`);

        // Try to send offer, with retry if user is temporarily disconnected
        const success = this.forwardSignalingMessage(message.to, {
          type: "offer",
          offer: message.offer,
          from: userId,
        });

        if (!success) {
          console.log(`⏳ Offer failed to send, retrying in 2 seconds...`);
          setTimeout(() => {
            console.log(`🔄 Retrying offer send to ${message.to}`);
            this.forwardSignalingMessage(message.to, {
              type: "offer",
              offer: message.offer,
              from: userId,
            });
          }, 2000);
        }
        break;
      }

      case "answer":
        this.forwardSignalingMessage(message.to, {
          type: "answer",
          answer: message.answer,
          from: userId,
        });
        break;

      case "ice-candidate":
        this.forwardSignalingMessage(message.to, {
          type: "ice-candidate",
          candidate: message.candidate,
          from: userId,
        });
        break;

      case "call-ended":
        this.handleCallEnded(userId);
        break;

      default:
        console.log("Unknown message type:", message);
    }
  }

  private forwardSignalingMessage(
    toUserId: string,
    message: ServerMessage
  ): boolean {
    console.log(`🔀 Forwarding ${message.type} message to user: ${toUserId}`);
    const success = this.sendMessage(toUserId, message);
    if (!success) {
      console.error(
        `❌ Failed to forward ${message.type} to ${toUserId} - user not found or connection closed`
      );
    }
    return success;
  }

  private handleCallEnded(userId: string) {
    const connection = this.connections.get(userId);
    if (!connection || !connection.partnerId) return;

    const partnerId = connection.partnerId;

    // Clear the match
    connection.partnerId = undefined;
    const partnerConnection = this.connections.get(partnerId);
    if (partnerConnection) {
      partnerConnection.partnerId = undefined;
    }

    console.log(`Call ended between ${userId} and ${partnerId}`);
  }

  private notifyPartnerDisconnected(partnerId: string) {
    const partnerConnection = this.connections.get(partnerId);
    if (partnerConnection) {
      partnerConnection.partnerId = undefined;
      this.sendMessage(partnerId, { type: "partner-disconnected" });
    }
  }

  private sendMessage(userId: string, message: ServerMessage): boolean {
    const connection = this.connections.get(userId);
    if (!connection) {
      console.error(`❌ User ${userId} not found in connections`);
      return false;
    }

    // Check WebSocket state before sending
    if (connection.ws.readyState !== 1) {
      // 1 = OPEN
      console.error(
        `❌ WebSocket for ${userId} is not open (state: ${connection.ws.readyState})`
      );
      return false;
    }

    try {
      console.log(
        `📨 Sending ${message.type} to ${userId} (WebSocket state: ${connection.ws.readyState})`
      );
      connection.ws.send(JSON.stringify(message));
      console.log(`✅ Successfully sent ${message.type} to ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send ${message.type} to ${userId}:`, error);
      return false;
    }
  }

  // Admin/debug methods
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      totalConnections: this.connections.size,
      activeMatches:
        Array.from(this.connections.values()).filter((c) => c.partnerId)
          .length / 2,
    };
  }
}

// Singleton instance
export const speedDatingSignaling = new SpeedDatingSignaling();
