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
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<
    string | undefined
  >();

  // Create a ref to hold the latest state to avoid stale closures in event handlers
  const stateRef = useRef({
    connectionState,
    partnerId,
    isInitiator,
    selectedVideoDeviceId,
  });
  useEffect(() => {
    stateRef.current = {
      connectionState,
      partnerId,
      isInitiator,
      selectedVideoDeviceId,
    };
  }, [connectionState, partnerId, isInitiator, selectedVideoDeviceId]);

  // WebSocket and WebRTC refs
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Video element refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Queue for ICE candidates received before remote description is set
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);

  // WebRTC configuration with TURN fallback for same-network connections
  const pcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      // Free TURN servers for testing (consider getting your own for production)
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  };

  const sendMessage = useCallback(
    (message: SignalingMessage) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log("📤 Sending message:", message.type, {
          to: "to" in message ? message.to : "N/A",
          from: "from" in message ? message.from : userId,
          timestamp: new Date().toISOString(),
        });
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.error("❌ Cannot send message - WebSocket not open:", {
          messageType: message.type,
          wsState: wsRef.current?.readyState,
          timestamp: new Date().toISOString(),
        });
      }
    },
    [userId]
  );

  const createPeerConnection = useCallback(
    (targetPartnerId: string) => {
      const pc = new RTCPeerConnection(pcConfig);

      pc.onicecandidate = (event) => {
        if (event.candidate && targetPartnerId) {
          console.log("🧊 Generated ICE candidate:", {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address || "hidden",
            port: event.candidate.port,
            foundation: event.candidate.foundation,
          });
          sendMessage({
            type: "ice-candidate",
            candidate: event.candidate,
            to: targetPartnerId,
            from: userId,
          });
        } else if (!event.candidate) {
          console.log("✅ ICE gathering completed");
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
        console.log("🔄 Peer connection state changed to:", pc.connectionState);
        if (pc.connectionState === "connected") {
          console.log("🎉 Peer connection established successfully!");
          setConnectionState("calling");
        } else if (pc.connectionState === "disconnected") {
          console.log("⚠️ Peer connection disconnected");
          // Don't immediately end call on disconnection - give it time to reconnect
          setTimeout(() => {
            if (
              pc.connectionState === "disconnected" ||
              pc.connectionState === "failed"
            ) {
              console.log("🔚 Peer connection failed permanently, ending call");
              endCall();
            }
          }, 5000); // Wait 5 seconds before giving up
        } else if (pc.connectionState === "failed") {
          console.log("❌ Peer connection failed!");
          // Don't immediately end call - log more info first
          console.log("🔍 ICE connection state:", pc.iceConnectionState);
          console.log("🔍 ICE gathering state:", pc.iceGatheringState);
          console.log("🔍 Signaling state:", pc.signalingState);

          // Give it a moment before ending call
          setTimeout(() => {
            if (pc.connectionState === "failed") {
              console.log(
                "🔚 Peer connection still failed after delay, ending call"
              );
              endCall();
            }
          }, 3000); // Wait 3 seconds before giving up
        } else {
          console.log(`ℹ️ Peer connection state: ${pc.connectionState}`);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(
          "🧊 ICE connection state changed to:",
          pc.iceConnectionState
        );
        if (pc.iceConnectionState === "failed") {
          console.error(
            "❌ ICE connection failed. This may be a firewall or network issue."
          );
          // You might want to try restarting ICE here
          // pc.restartIce();
        }
      };

      return pc;
    },
    [sendMessage, userId]
  );

  const startLocalVideo = useCallback(async () => {
    try {
      console.log(
        `📹 Trying to get local stream with deviceId: ${
          selectedVideoDeviceId || "default"
        }`
      );
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: selectedVideoDeviceId
          ? { deviceId: { exact: selectedVideoDeviceId } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

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
  }, [selectedVideoDeviceId]);

  const getMediaDevices = useCallback(async () => {
    try {
      // Note: Full device labels are only available after granting camera permission.
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");
      console.log("📷 Found cameras:", cameras);
      setVideoDevices(cameras);
      // If there's no camera selected yet, and we found some, select the first one.
      if (cameras.length > 0 && !selectedVideoDeviceId) {
        setSelectedVideoDeviceId(cameras[0].deviceId);
      }
    } catch (err) {
      console.error("❌ Error enumerating media devices:", err);
      setError("Could not list cameras.");
    }
  }, [selectedVideoDeviceId]);

  const createOfferWithPartner = useCallback(
    async (targetPartnerId: string) => {
      console.log(
        "🔊 createOfferWithPartner called with partner:",
        targetPartnerId
      );
      if (!peerConnectionRef.current || !localStreamRef.current) {
        console.log("❌ createOfferWithPartner: Missing requirements", {
          hasPeerConnection: !!peerConnectionRef.current,
          hasLocalStream: !!localStreamRef.current,
        });
        return;
      }

      try {
        console.log("📤 Adding local tracks to peer connection...");
        // Add local stream to peer connection
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
          console.log("➕ Added track:", track.kind);
        });

        console.log("🎯 Creating offer...");
        const offer = await peerConnectionRef.current.createOffer();
        console.log("✅ Offer created, setting local description...");
        await peerConnectionRef.current.setLocalDescription(offer);
        console.log("📨 Sending offer to partner:", targetPartnerId);

        sendMessage({
          type: "offer",
          offer,
          to: targetPartnerId,
          from: userId,
        });
        console.log("✅ Offer sent successfully");
      } catch (err) {
        console.error("❌ Failed to create offer:", err);
        setError("Failed to create call offer");
      }
    },
    [sendMessage, userId]
  );

  const createOffer = useCallback(async () => {
    console.log("🔊 createOffer called");
    if (!peerConnectionRef.current || !localStreamRef.current || !partnerId) {
      console.log("❌ createOffer: Missing requirements", {
        hasPeerConnection: !!peerConnectionRef.current,
        hasLocalStream: !!localStreamRef.current,
        partnerId,
      });
      return;
    }

    await createOfferWithPartner(partnerId);
  }, [partnerId, createOfferWithPartner]);

  const createAnswer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      if (!peerConnectionRef.current || !localStreamRef.current || !partnerId)
        return;

      try {
        console.log("📞 Creating answer...");

        // Add local stream to peer connection
        console.log("📤 Adding local tracks to peer connection...");
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
          console.log("➕ Added track:", track.kind);
        });

        console.log("🔧 Setting remote description (offer)...");
        await peerConnectionRef.current.setRemoteDescription(offer);
        console.log("✅ Remote description set successfully");

        // Process any queued ICE candidates now that remote description is set
        if (iceCandidateQueueRef.current.length > 0) {
          console.log(
            `🧊 Processing ${iceCandidateQueueRef.current.length} queued ICE candidates...`
          );
          for (const candidate of iceCandidateQueueRef.current) {
            try {
              await peerConnectionRef.current.addIceCandidate(candidate);
              console.log("✅ Queued ICE candidate added successfully");
            } catch (err) {
              console.error("❌ Failed to add queued ICE candidate:", err);
            }
          }
          // Clear the queue
          iceCandidateQueueRef.current = [];
        }

        console.log("🎯 Creating answer...");
        const answer = await peerConnectionRef.current.createAnswer();
        console.log("✅ Answer created, setting local description...");
        await peerConnectionRef.current.setLocalDescription(answer);
        console.log("📨 Sending answer to partner:", partnerId);

        sendMessage({
          type: "answer",
          answer,
          to: partnerId,
          from: userId,
        });
        console.log("✅ Answer sent successfully");
      } catch (err) {
        console.error("❌ Failed to create answer:", err);
        setError("Failed to answer call");
      }
    },
    [partnerId, sendMessage, userId]
  );

  const handleAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit) => {
      if (!peerConnectionRef.current) {
        console.error("❌ Cannot handle answer, no peer connection");
        return;
      }
      try {
        console.log("✅ Received answer, setting remote description...");
        await peerConnectionRef.current.setRemoteDescription(answer);
        console.log(
          "🎉 Remote description (answer) set successfully! Connection should establish now."
        );
      } catch (err) {
        console.error("❌ Failed to set remote description from answer:", err);
        setError("Failed to process call answer");
      }
    },
    []
  );

  const processQueuedIceCandidates = useCallback(async () => {
    if (!peerConnectionRef.current || iceCandidateQueueRef.current.length === 0)
      return;

    console.log(
      `🧊 Processing ${iceCandidateQueueRef.current.length} queued ICE candidates...`
    );

    for (const candidate of iceCandidateQueueRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(candidate);
        console.log("✅ Queued ICE candidate added successfully");
      } catch (err) {
        console.error("❌ Failed to add queued ICE candidate:", err);
      }
    }

    // Clear the queue
    iceCandidateQueueRef.current = [];
  }, []);

  const handleIceCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      if (!peerConnectionRef.current) {
        console.log("❌ No peer connection for ICE candidate");
        return;
      }

      // Check if remote description is set
      if (!peerConnectionRef.current.remoteDescription) {
        console.log("⏳ Remote description not set yet, queuing ICE candidate");
        iceCandidateQueueRef.current.push(candidate);
        return;
      }

      try {
        console.log("🧊 Adding ICE candidate immediately");
        await peerConnectionRef.current.addIceCandidate(candidate);
        console.log("✅ ICE candidate added successfully");
      } catch (err) {
        console.error("❌ Failed to add ICE candidate:", err);
      }
    },
    []
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionState("connecting");
    setError(null);

    // Use secure WebSocket (wss://) for HTTPS pages, insecure (ws://) for HTTP pages
    const protocol =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "wss:"
        : "ws:";
    const ws = new WebSocket(
      `${protocol}//${process.env.NEXT_PUBLIC_BASE_URL}/ws?userId=${userId}`
    );

    ws.onopen = () => {
      console.log("✅ WebSocket connected successfully");
      setConnectionState("connected");
    };

    ws.onmessage = async (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        console.log("📨 Received message:", message.type, message);
        console.log("🔍 Current state when message received:", {
          ...stateRef.current,
          hasPeerConnection: !!peerConnectionRef.current,
          hasLocalStream: !!localStreamRef.current,
          wsReadyState: wsRef.current?.readyState,
        });

        switch (message.type) {
          case "joined-queue":
            setConnectionState("in-queue");
            break;

          case "left-queue":
            setConnectionState("connected");
            break;

          case "match-found":
            console.log(
              "🎯 Match found! Partner:",
              message.partnerId,
              "Is initiator:",
              message.isInitiator
            );
            setPartnerId(message.partnerId);
            setIsInitiator(message.isInitiator);
            setConnectionState("matched");

            try {
              // Start local video and create peer connection
              console.log("📹 Starting local video...");
              await startLocalVideo();
              console.log("✅ Local video started successfully");

              console.log("🔗 Creating peer connection...");
              peerConnectionRef.current = createPeerConnection(
                message.partnerId
              );
              console.log("✅ Peer connection created successfully");

              // If initiator, create and send offer
              if (message.isInitiator) {
                console.log(
                  "🚀 I'm the initiator, will create offer in 1 second..."
                );
                // Capture partnerId in closure to avoid state reset issues
                const currentPartnerId = message.partnerId;
                setTimeout(() => {
                  console.log(
                    "⏰ Timeout fired, creating offer for partner:",
                    currentPartnerId
                  );
                  if (
                    peerConnectionRef.current &&
                    localStreamRef.current &&
                    currentPartnerId
                  ) {
                    // Create offer directly with captured partnerId
                    createOfferWithPartner(currentPartnerId);
                  } else {
                    console.error(
                      "❌ Missing requirements for offer after timeout:",
                      {
                        hasPeerConnection: !!peerConnectionRef.current,
                        hasLocalStream: !!localStreamRef.current,
                        partnerId: currentPartnerId,
                      }
                    );
                  }
                }, 1000);
              } else {
                console.log("⏳ I'm the receiver, waiting for offer...");
              }
            } catch (error) {
              console.error("❌ Error in match-found handling:", error);
              setError(
                `Failed to setup connection: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
              );
            }
            break;

          case "offer":
            console.log("📥 Received offer from:", message.from);
            if (!peerConnectionRef.current) {
              console.log("🔧 No peer connection yet, creating one...");
              // Create peer connection if we don't have one yet
              await startLocalVideo();
              peerConnectionRef.current = createPeerConnection(partnerId!);
            }
            console.log("📞 Creating answer...");
            await createAnswer(message.offer);
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
        console.error("❌ Failed to parse WebSocket message:", err);
        console.log("📄 Raw message data:", event.data);
        setError(
          `Message parsing error: ${
            err instanceof Error ? err.message : "Unknown"
          }`
        );
      }
    };

    ws.onclose = (event) => {
      console.warn(
        "🔌 Signaling channel (WebSocket) disconnected. The connection may recover.",
        {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        }
      );
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      // Set a non-fatal error message. The pc.onconnectionstatechange handler
      // will determine if the call has truly failed.
      setError("A network error occurred. Trying to recover...");

      // Reconnect logic can stay to re-establish the signaling channel
      setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          console.log("🔄 Attempting to reconnect signaling channel...");
          connect();
        }
      }, 3000);
    };

    wsRef.current = ws;

    // Health check - log connection state every 2 seconds
    const healthCheck = setInterval(() => {
      if (wsRef.current) {
        console.log("💓 WebSocket health check:", {
          readyState: wsRef.current.readyState,
          url: wsRef.current.url,
          ...stateRef.current,
          hasLocalStream: !!localStreamRef.current,
          hasPeerConnection: !!peerConnectionRef.current,
        });
      }
    }, 2000);

    // Clean up health check when WebSocket closes
    const originalOnClose = ws.onclose;
    ws.onclose = (event) => {
      clearInterval(healthCheck);
      console.warn(
        "🔌 Signaling channel (WebSocket) disconnected. The connection may recover.",
        {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        }
      );
    };
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
    getMediaDevices,

    // Devices
    videoDevices,
    selectedVideoDeviceId,
    setSelectedVideoDeviceId,
  };
}
