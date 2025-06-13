"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Types matching backend
type SignalingMessage =
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
  | { type: "call-ended" };

type ServerMessage =
  | { type: "joined-queue"; userId: string }
  | { type: "left-queue"; userId: string }
  | { type: "match-found"; partnerId: string; isInitiator: boolean }
  | { type: "offer"; offer: RTCSessionDescriptionInit; from: string }
  | { type: "answer"; answer: RTCSessionDescriptionInit; from: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; from: string }
  | { type: "partner-disconnected" }
  | { type: "error"; message: string };

type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "in-queue"
  | "matched"
  | "calling";

export function useSpeedDating() {
  const [userId] = useState(
    () => `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket and WebRTC refs
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Video element refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // WebRTC configuration
  const pcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const sendMessage = useCallback((message: SignalingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(pcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate && partnerId) {
        sendMessage({
          type: "ice-candidate",
          candidate: event.candidate,
          to: partnerId,
          from: userId,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote stream");
      remoteStreamRef.current = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Peer connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setConnectionState("calling");
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        endCall();
      }
    };

    return pc;
  }, [partnerId, sendMessage, userId]);

  const startLocalVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (err) {
      console.error("Failed to get local stream:", err);
      setError("Failed to access camera/microphone");
      throw err;
    }
  }, []);

  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current || !localStreamRef.current || !partnerId)
      return;

    try {
      // Add local stream to peer connection
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
      });

      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      sendMessage({
        type: "offer",
        offer,
        to: partnerId,
        from: userId,
      });
    } catch (err) {
      console.error("Failed to create offer:", err);
      setError("Failed to create call offer");
    }
  }, [partnerId, sendMessage, userId]);

  const createAnswer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      if (!peerConnectionRef.current || !localStreamRef.current || !partnerId)
        return;

      try {
        // Add local stream to peer connection
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
        });

        await peerConnectionRef.current.setRemoteDescription(offer);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        sendMessage({
          type: "answer",
          answer,
          to: partnerId,
          from: userId,
        });
      } catch (err) {
        console.error("Failed to create answer:", err);
        setError("Failed to answer call");
      }
    },
    [partnerId, sendMessage, userId]
  );

  const handleAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit) => {
      if (!peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(answer);
      } catch (err) {
        console.error("Failed to handle answer:", err);
        setError("Failed to process call answer");
      }
    },
    []
  );

  const handleIceCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      if (!peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch (err) {
        console.error("Failed to add ICE candidate:", err);
      }
    },
    []
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionState("connecting");
    setError(null);

    const ws = new WebSocket(
      `ws://${process.env.NEXT_PUBLIC_BASE_URL}/ws?userId=${userId}`
    );

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnectionState("connected");
    };

    ws.onmessage = async (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        console.log("Received message:", message.type);

        switch (message.type) {
          case "joined-queue":
            setConnectionState("in-queue");
            break;

          case "left-queue":
            setConnectionState("connected");
            break;

          case "match-found":
            setPartnerId(message.partnerId);
            setIsInitiator(message.isInitiator);
            setConnectionState("matched");

            // Start local video and create peer connection
            await startLocalVideo();
            peerConnectionRef.current = createPeerConnection();

            // If initiator, create and send offer
            if (message.isInitiator) {
              setTimeout(() => createOffer(), 1000); // Small delay to ensure setup
            }
            break;

          case "offer":
            if (peerConnectionRef.current) {
              await createAnswer(message.offer);
            }
            break;

          case "answer":
            await handleAnswer(message.answer);
            break;

          case "ice-candidate":
            await handleIceCandidate(message.candidate);
            break;

          case "partner-disconnected":
            endCall();
            break;

          case "error":
            setError(message.message);
            break;
        }
      } catch (err) {
        console.error("Failed to parse message:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setConnectionState("disconnected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("Connection error");
      setConnectionState("disconnected");
    };

    wsRef.current = ws;
  }, [
    userId,
    startLocalVideo,
    createPeerConnection,
    createOffer,
    createAnswer,
    handleAnswer,
    handleIceCandidate,
  ]);

  const joinQueue = useCallback(() => {
    sendMessage({ type: "join-queue", userId });
  }, [sendMessage, userId]);

  const leaveQueue = useCallback(() => {
    sendMessage({ type: "leave-queue", userId });
  }, [sendMessage, userId]);

  const endCall = useCallback(() => {
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Clear remote stream
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Reset state
    setPartnerId(null);
    setIsInitiator(false);
    setConnectionState("connected");

    // Notify server
    sendMessage({ type: "call-ended" });
  }, [sendMessage]);

  const disconnect = useCallback(() => {
    endCall();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionState("disconnected");
  }, [endCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    userId,
    connectionState,
    partnerId,
    isInitiator,
    error,

    // Video refs
    localVideoRef,
    remoteVideoRef,

    // Actions
    connect,
    disconnect,
    joinQueue,
    leaveQueue,
    endCall,

    // Utils
    startLocalVideo,
  };
}
