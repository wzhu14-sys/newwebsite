"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { playCountdownBeep, playShutterSound } from "./utils/sound";
import { createPhotoStrip } from "./utils/photoStrip";

type PermissionStatus = "pending" | "granted" | "denied";
type AppState = "camera" | "capturing" | "results";

export default function PhotoBooth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [permission, setPermission] = useState<PermissionStatus>("pending");
  const [appState, setAppState] = useState<AppState>("camera");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // Capture sequence state
  const [currentShotIndex, setCurrentShotIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);

  // Result state
  const [photoStripUrl, setPhotoStripUrl] = useState<string | null>(null);
  const [stripBlob, setStripBlob] = useState<Blob | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Initialize and start camera
  const startCamera = useCallback(async (facing: "user" | "environment" = facingMode) => {
    // Stop any existing streams first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermission("denied");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPermission("granted");
    } catch (err) {
      console.error("Camera access error:", err);
      setPermission("denied");
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, startCamera]);

  // Flip front/back camera
  const toggleFacingMode = () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
  };

  // Capture a single frame from video
  const captureFrame = useCallback((): string => {
    const video = videoRef.current;
    if (!video) return "";

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 960;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Mirror image if front camera is used to feel natural
    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.95);
  }, [facingMode]);

  // Execute full 4-photo sequence
  const startPhotoBoothSession = async () => {
    if (appState !== "camera" || permission !== "granted") return;

    setAppState("capturing");
    setCapturedPhotos([]);
    const photos: string[] = [];

    // Take 4 photos sequentially
    for (let shot = 1; shot <= 4; shot++) {
      setCurrentShotIndex(shot);

      // Countdown 3, 2, 1
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        playCountdownBeep(c === 1 ? 987 : 784);
        if ("vibrate" in navigator) {
          navigator.vibrate(30);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      setCountdown(0);

      // Flash & shutter sound
      setIsFlashing(true);
      playShutterSound();
      if ("vibrate" in navigator) {
        navigator.vibrate([60, 40, 60]);
      }

      // Capture frame
      const photo = captureFrame();
      photos.push(photo);
      setCapturedPhotos([...photos]);

      // Flash duration
      await new Promise((r) => setTimeout(r, 200));
      setIsFlashing(false);
      setCountdown(null);

      // Brief breather between shots for repositioning (unless it's the last one)
      if (shot < 4) {
        await new Promise((r) => setTimeout(r, 700));
      }
    }

    // Sequence finished -> Generate Photo Strip
    try {
      const { dataUrl, blob } = await createPhotoStrip(photos);
      setPhotoStripUrl(dataUrl);
      setStripBlob(blob);
      setAppState("results");
    } catch (e) {
      console.error("Failed to generate photo strip:", e);
      setAppState("results");
    }
  };

  // Reset and retake
  const handleRetake = () => {
    setAppState("camera");
    setCapturedPhotos([]);
    setPhotoStripUrl(null);
    setStripBlob(null);
    setSaveStatus(null);
    startCamera(facingMode);
  };

  // Save / Share button handler
  const handleSave = async () => {
    if (!photoStripUrl || !stripBlob) return;

    const fileName = `photobooth-${Date.now()}.png`;
    const file = new File([stripBlob], fileName, { type: "image/png" });

    // Check if Web Share API with files is supported (iOS Safari / mobile)
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: "My Photo Booth Strip",
          text: "Created with Photo Booth!",
        });
        setSaveStatus("Shared!");
        setTimeout(() => setSaveStatus(null), 3000);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // User closed share sheet, not an error
          return;
        }
        console.warn("Share failed, falling back to download:", err);
      }
    }

    // Laptop/desktop fallback: trigger download
    try {
      const a = document.createElement("a");
      a.href = photoStripUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSaveStatus("Downloaded!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Download failed:", err);
      setSaveStatus("Error saving image");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <main className="relative w-full h-[100dvh] bg-black text-white overflow-hidden select-none touch-none">
      {/* 1. Camera Denied Screen */}
      {permission === "denied" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-6 text-center bg-black/95 safe-top safe-bottom">
          <div className="w-20 h-20 mb-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
            <svg
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
              <line
                x1="3"
                y1="3"
                x2="21"
                y2="21"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold mb-3 tracking-tight">
            Camera Access Needed
          </h1>
          <p className="text-gray-300 text-sm max-w-sm mb-6 leading-relaxed">
            Photo Booth needs your front camera to take pictures.
          </p>

          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 max-w-xs text-left mb-8 space-y-3">
            <div className="flex items-start gap-3 text-xs text-neutral-300">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center font-semibold">
                1
              </span>
              <span>
                Tap the <strong className="text-white">aA</strong> icon in the
                Safari search bar.
              </span>
            </div>
            <div className="flex items-start gap-3 text-xs text-neutral-300">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center font-semibold">
                2
              </span>
              <span>
                Tap <strong className="text-white">Website Settings</strong> and
                set <strong className="text-white">Camera</strong> to{" "}
                <strong className="text-white">Allow</strong>.
              </span>
            </div>
            <div className="flex items-start gap-3 text-xs text-neutral-300">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center font-semibold">
                3
              </span>
              <span>Tap the button below to re-enable camera.</span>
            </div>
          </div>

          <button
            onClick={() => startCamera(facingMode)}
            className="w-full max-w-xs py-3.5 bg-white text-black font-semibold text-base rounded-full shadow-lg active:scale-95 transition-transform"
          >
            Try Again
          </button>
        </div>
      )}

      {/* 2. Full-Screen Live Video Feed */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-neutral-950 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${
            facingMode === "user" ? "scale-x-[-1]" : ""
          }`}
        />
      </div>

      {/* 3. White Flash Overlay */}
      {isFlashing && (
        <div className="absolute inset-0 z-40 bg-white animate-flash pointer-events-none" />
      )}

      {/* 4. Top Safe-Area Header Bar (Live Camera & Capturing mode) */}
      {appState !== "results" && (
        <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 safe-top pointer-events-none">
          {/* Logo / Title Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-sm pointer-events-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-neutral-200">
              Photo Booth
            </span>
          </div>

          {/* Shot Tracker during capture */}
          {appState === "capturing" && (
            <div className="px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-xs font-bold tracking-widest text-white shadow-lg pointer-events-auto">
              SHOT {currentShotIndex} / 4
            </div>
          )}

          {/* Camera Flip Button */}
          {appState === "camera" && (
            <button
              onClick={toggleFacingMode}
              aria-label="Flip camera"
              className="p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white active:scale-90 transition-transform pointer-events-auto"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </header>
      )}

      {/* 5. Countdown Overlay */}
      {appState === "capturing" && countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">
          <div
            key={countdown}
            className="text-8xl sm:text-9xl font-black text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] animate-pop"
          >
            {countdown}
          </div>
          <div className="mt-4 px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-sm font-medium tracking-wider uppercase text-white/90">
            Pose for shot {currentShotIndex}!
          </div>
        </div>
      )}

      {/* 6. Live Shot Previews in Capturing Mode (Pill on left/right) */}
      {appState === "capturing" && (
        <div className="absolute top-24 right-4 z-30 flex flex-col gap-2 pointer-events-none">
          {[0, 1, 2, 3].map((index) => {
            const photo = capturedPhotos[index];
            const isCurrent = currentShotIndex === index + 1;
            return (
              <div
                key={index}
                className={`w-12 h-10 rounded-lg border-2 overflow-hidden transition-all duration-300 ${
                  photo
                    ? "border-white shadow-md scale-100 opacity-100"
                    : isCurrent
                    ? "border-amber-400 bg-amber-400/20 scale-105"
                    : "border-white/30 bg-black/40 opacity-40"
                }`}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={`Shot ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/70">
                    {index + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 7. Bottom Shutter Button Controls (Camera Mode) */}
      {appState === "camera" && (
        <footer className="absolute bottom-0 inset-x-0 z-30 flex items-center justify-center safe-bottom safe-left safe-right pb-8 pt-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <button
            onClick={startPhotoBoothSession}
            disabled={permission !== "granted"}
            aria-label="Take 4 photos"
            className="group relative flex items-center justify-center w-20 h-20 rounded-full border-4 border-white active:scale-90 transition-transform duration-150 focus:outline-none"
          >
            {/* Inner Shutter Circle */}
            <div className="w-16 h-16 rounded-full bg-white group-active:bg-neutral-200 transition-colors shadow-lg" />
          </button>
        </footer>
      )}

      {/* 8. Results Screen: Vertical Photo Strip */}
      {appState === "results" && photoStripUrl && (
        <div className="absolute inset-0 z-40 flex flex-col bg-neutral-950/98 safe-top safe-bottom safe-left safe-right animate-strip">
          {/* Top Bar on Results */}
          <div className="flex items-center justify-between px-6 py-2">
            <span className="text-sm font-semibold tracking-wider text-neutral-400 uppercase">
              Your Photo Strip
            </span>
            {saveStatus && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium animate-pulse">
                {saveStatus}
              </span>
            )}
          </div>

          {/* Scrollable / Scaled Photo Strip Container */}
          <div className="flex-1 overflow-y-auto px-4 py-2 flex items-center justify-center">
            <div className="max-w-[290px] sm:max-w-[340px] w-full max-h-[72vh] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoStripUrl}
                alt="Photo Booth Strip"
                className="w-auto h-auto max-h-[72vh] rounded-md shadow-2xl border border-neutral-800 object-contain mx-auto"
              />
            </div>
          </div>

          {/* Action Buttons: Save & Retake */}
          <div className="p-4 sm:p-6 bg-black/60 backdrop-blur-xl border-t border-neutral-900 flex flex-col gap-3 max-w-md mx-auto w-full">
            {/* Save Button */}
            <button
              onClick={handleSave}
              className="w-full py-4 px-6 bg-white text-black font-bold text-base rounded-full shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span>Save Photo Strip</span>
            </button>

            {/* Retake Button */}
            <button
              onClick={handleRetake}
              className="w-full py-3.5 px-6 bg-neutral-900 border border-neutral-800 text-neutral-200 font-semibold text-sm rounded-full active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Retake</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
