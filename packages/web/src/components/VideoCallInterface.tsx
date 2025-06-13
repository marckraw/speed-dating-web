"use client";

import { useEffect, useRef, useState } from "react";
import { useSpeedDating } from "@/hooks/useSpeedDating";

export default function VideoCallInterface() {
  const {
    userId,
    connectionState,
    partnerId,
    error,
    localVideoRef,
    remoteVideoRef,
    remoteStream,
    connect,
    disconnect,
    joinQueue,
    leaveQueue,
    endCall,
    startLocalVideo,
    videoDevices,
    selectedVideoDeviceId,
    setSelectedVideoDeviceId,
    getMediaDevices,
    debugInfo,
  } = useSpeedDating();

  const [isDebugOpen, setIsDebugOpen] = useState(false);

  // Set up video refs
  const localVideoElement = useRef<HTMLVideoElement>(null);
  const remoteVideoElement = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoElement.current) {
      localVideoRef.current = localVideoElement.current;
    }
    if (remoteVideoElement.current) {
      remoteVideoRef.current = remoteVideoElement.current;
    }
  }, [localVideoRef, remoteVideoRef]);

  // This new effect robustly handles displaying the remote stream.
  useEffect(() => {
    if (remoteVideoElement.current && remoteStream) {
      remoteVideoElement.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Get media devices on mount
  useEffect(() => {
    getMediaDevices();
  }, [getMediaDevices]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    // Disconnect when the component is unmounted
    return () => disconnect();
  }, []); // <-- Empty dependency array

  const getStatusText = () => {
    switch (connectionState) {
      case "disconnected":
        return "Disconnected";
      case "connecting":
        return "Connecting...";
      case "connected":
        return "Connected";
      case "in-queue":
        return "Looking for someone to chat with...";
      case "matched":
        return "Match found! Setting up video call...";
      case "calling":
        return `Video calling with ${partnerId}`;
      default:
        return "Unknown state";
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case "disconnected":
        return "text-red-500";
      case "connecting":
        return "text-yellow-500";
      case "connected":
        return "text-green-500";
      case "in-queue":
        return "text-blue-500";
      case "matched":
        return "text-purple-500";
      case "calling":
        return "text-green-600";
      default:
        return "text-gray-500";
    }
  };

  const handleJoinQueue = async () => {
    try {
      await startLocalVideo();
      joinQueue();
    } catch (err) {
      console.error("Failed to start camera for queue:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status and User Info */}
      <div className="bg-card p-4 rounded-lg border">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">User ID: {userId}</p>
            <p className={`text-lg font-semibold ${getStatusColor()}`}>
              {getStatusText()}
            </p>
          </div>
          {partnerId && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Matched with:</p>
              <p className="font-semibold">{partnerId}</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700">
            Error: {error}
          </div>
        )}
      </div>

      {/* Video Interface */}
      <div className="grid gap-6">
        {/* Local Video (Your Camera) */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Your Camera</h3>
          <div className="relative bg-black rounded-xl overflow-hidden h-[300px]">
            <video
              ref={localVideoElement}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
              You
            </div>
          </div>
        </div>

        {/* Remote Video (Partner's Camera) */}
        {(connectionState === "matched" || connectionState === "calling") && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {partnerId ? `${partnerId}'s Camera` : "Partner Camera"}
            </h3>
            <div className="relative bg-gray-900 rounded-xl overflow-hidden h-[300px]">
              <video
                ref={remoteVideoElement}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                {partnerId || "Partner"}
              </div>
              {/* {connectionState === "matched" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p>Connecting...</p>
                  </div>
                </div>
              )} */}
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex flex-col items-center justify-center gap-4">
        {connectionState === "connected" && (
          <div className="w-full max-w-sm space-y-4">
            {/* Camera Selection - Always show when connected */}
            {videoDevices.length > 0 && (
              <div className="bg-card p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-3">Camera Settings</h3>
                <div>
                  <label
                    htmlFor="camera-select"
                    className="block text-sm font-medium text-muted-foreground mb-2"
                  >
                    Select Camera
                  </label>
                  <select
                    id="camera-select"
                    value={selectedVideoDeviceId || ""}
                    onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
                    className="block w-full p-2 border-border rounded-md bg-background text-foreground"
                  >
                    {videoDevices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Join Queue Button - Separate section */}
            <div className="bg-card p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-3">Ready to start?</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Make sure your camera is working and you're happy with your
                setup, then join the queue to meet someone new!
              </p>
              <button
                onClick={handleJoinQueue}
                className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Join queue 💕
              </button>
            </div>
          </div>
        )}

        {connectionState === "in-queue" && (
          <button
            onClick={leaveQueue}
            className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Leave Queue 🚪
          </button>
        )}

        {(connectionState === "matched" || connectionState === "calling") && (
          <button
            onClick={endCall}
            className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            End Call 📞
          </button>
        )}

        {connectionState === "disconnected" && (
          <button
            onClick={connect}
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Connect 🔗
          </button>
        )}
      </div>

      {/* Queue Info */}
      {connectionState === "in-queue" && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg">
            <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"></div>
            Waiting for someone to join...
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            This might take a moment. We'll match you with the next available
            person!
          </p>
        </div>
      )}

      {/* Debug Info Panel */}
      <div className="bg-card p-4 rounded-lg border mt-6">
        <button
          onClick={() => setIsDebugOpen(!isDebugOpen)}
          className="font-semibold w-full text-left"
        >
          {isDebugOpen ? "▼" : "►"} Debug Info
        </button>
        {isDebugOpen && (
          <div className="mt-4 space-y-2 text-sm text-muted-foreground bg-background p-3 rounded">
            <p>
              <strong>Hook State:</strong> {connectionState}
            </p>
            <p>
              <strong>Signaling State:</strong>{" "}
              {debugInfo.signalingState || "N/A"}
            </p>
            <p>
              <strong>Peer Connection State:</strong>{" "}
              {debugInfo.connectionState || "N/A"}
            </p>
            <p>
              <strong>ICE Connection State:</strong>{" "}
              {debugInfo.iceConnectionState || "N/A"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
