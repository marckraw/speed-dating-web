"use client";

import { useEffect, useRef } from "react";

export default function WebcamPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to access webcam:", err);
      }
    };

    startCamera();
  }, []);

  return (
    <div className="flex justify-center items-center h-[400px] bg-black rounded-xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="rounded-lg w-full h-full object-cover"
      />
    </div>
  );
}
