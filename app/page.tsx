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

  // Multi-shot sequence state
  const [currentShotIndex, setCurrentShotIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);

  // Results state
  const [photoStripUrl, setPhotoStripUrl] = useState<string | null>(null);
  const [stripBlob, setStripBlob] = useState<Blob | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Start camera stream
  const startCamera = useCallback(
    async (facing: "user" | "environment" = facingMode) => {
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
    },
    [facingMode]
  );

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, startCamera]);

  const toggleFacingMode = () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
  };

  // Capture single frame
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

    // Mirror user-facing camera for natural selfie view
    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.95);
  }, [facingMode]);

  // Run 4-shot photobooth session
  const startPhotoBoothSession = async () => {
    if (appState !== "camera" || permission !== "granted") return;

    setAppState("capturing");
    setCapturedPhotos([]);
    const photos: string[] = [];

    for (let shot = 1; shot <= 4; shot++) {
      setCurrentShotIndex(shot);

      // 3-2-1 Countdown
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        playCountdownBeep(c === 1 ? 987 : 784);
        if ("vibrate" in navigator) {
          navigator.vibrate(35);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      setCountdown(0);

      // Flash & shutter click
      setIsFlashing(true);
      playShutterSound();
      if ("vibrate" in navigator) {
        navigator.vibrate([60, 40, 60]);
      }

      const photo = captureFrame();
      photos.push(photo);
      setCapturedPhotos([...photos]);

      await new Promise((r) => setTimeout(r, 220));
      setIsFlashing(false);
      setCountdown(null);

      // Pause briefly between shots so user can reposition
      if (shot < 4) {
        await new Promise((r) => setTimeout(r, 750));
      }
    }

    // Generate Photo Strip
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

  const handleRetake = () => {
    setAppState("camera");
    setCapturedPhotos([]);
    setPhotoStripUrl(null);
    setStripBlob(null);
    setSaveStatus(null);
    startCamera(facingMode);
  };

  const handleSave = async () => {
    if (!photoStripUrl || !stripBlob) return;

    const fileName = `photobooth-${Date.now()}.png`;
    const file = new File([stripBlob], fileName, { type: "image/png" });

    // Try native iOS Share Sheet first (has "Save Image" to Apple Photos)
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: "Photo Booth Strip",
          text: "My photo strip taken with Photo Booth!",
        });
        setSaveStatus("Shared!");
        setTimeout(() => setSaveStatus(null), 3000);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.warn("Share sheet dismissed, fallback to download:", err);
      }
    }

    // Laptop/Desktop download fallback
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
    <main
      className="relative w-full h-[100dvh] bg-black text-white overflow-hidden select-none"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#000000",
      }}
    >
      {/* 1. Camera Denied Modal */}
      {permission === "denied" && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center px-6 text-center bg-black/95 safe-top-area safe-bottom-area"
          style={{ position: "absolute", inset: 0, zIndex: 50 }}
        >
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
            Please allow camera access to take your photos.
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
              <span>Tap below to re-enable the camera.</span>
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
      <div
        className="absolute inset-0 w-full h-full overflow-hidden bg-neutral-950 flex items-center justify-center"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${
            facingMode === "user" ? "scale-x-[-1]" : ""
          }`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: facingMode === "user" ? "scaleX(-1)" : "none",
          }}
        />

        {/* Viewfinder framing brackets */}
        <div className="viewfinder-corner corner-tl" />
        <div className="viewfinder-corner corner-tr" />
        <div className="viewfinder-corner corner-bl" />
        <div className="viewfinder-corner corner-br" />
      </div>

      {/* 3. Screen Flash */}
      {isFlashing && (
        <div
          className="absolute inset-0 bg-white animate-flash pointer-events-none"
          style={{ position: "absolute", inset: 0, zIndex: 60 }}
        />
      )}

      {/* 4. Top Safe-Area iOS Bar */}
      {appState !== "results" && (
        <header
          className="absolute top-0 inset-x-0 flex items-center justify-between px-5 safe-top-area pointer-events-none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            paddingTop: "max(16px, env(safe-area-inset-top))",
            paddingLeft: "max(20px, env(safe-area-inset-left))",
            paddingRight: "max(20px, env(safe-area-inset-right))",
          }}
        >
          {/* Logo / Status Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 shadow-md pointer-events-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold tracking-widest uppercase text-neutral-100">
              PHOTO BOOTH
            </span>
          </div>

          {/* Shot Tracker */}
          {appState === "capturing" && (
            <div className="px-3.5 py-1.5 rounded-full bg-amber-500/80 backdrop-blur-md text-xs font-black tracking-widest text-black shadow-lg pointer-events-auto">
              SHOT {currentShotIndex} OF 4
            </div>
          )}

          {/* Top Camera Flip Button */}
          {appState === "camera" && (
            <button
              onClick={toggleFacingMode}
              aria-label="Flip camera"
              className="p-2.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 text-white active:scale-90 transition-transform pointer-events-auto shadow-md"
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

      {/* 5. Live Captured Thumbnails Preview Rail (during capture) */}
      {appState === "capturing" && (
        <div
          className="absolute top-20 right-4 flex flex-col gap-2.5 pointer-events-none"
          style={{ position: "absolute", top: "80px", right: "16px", zIndex: 35 }}
        >
          {[0, 1, 2, 3].map((index) => {
            const photo = capturedPhotos[index];
            const isCurrent = currentShotIndex === index + 1;
            return (
              <div
                key={index}
                className={`w-14 h-11 rounded-lg border-2 overflow-hidden transition-all duration-300 shadow-lg ${
                  photo
                    ? "border-white bg-black scale-100 opacity-100"
                    : isCurrent
                    ? "border-amber-400 bg-amber-400/20 scale-105 animate-pulse"
                    : "border-white/20 bg-black/50 opacity-40"
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
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/70">
                    {index + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Big Countdown Animation */}
      {appState === "capturing" && countdown !== null && countdown > 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ position: "absolute", inset: 0, zIndex: 40 }}
        >
          <div
            key={countdown}
            className="text-9xl font-black text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)] animate-pop"
            style={{ fontSize: "7rem", fontWeight: 900 }}
          >
            {countdown}
          </div>
          <div className="mt-4 px-5 py-2 rounded-full bg-black/70 backdrop-blur-xl border border-white/20 text-sm font-semibold tracking-wider uppercase text-white shadow-xl">
            Pose for photo {currentShotIndex} / 4!
          </div>
        </div>
      )}

      {/* 7. Bottom Shutter Button Controls Deck (iPhone Camera Aesthetic) */}
      {appState === "camera" && (
        <footer
          className="absolute bottom-0 inset-x-0 flex items-center justify-between px-8 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-auto"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            paddingBottom: "max(32px, env(safe-area-inset-bottom))",
            paddingTop: "24px",
            minHeight: "140px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
          }}
        >
          {/* Left Dock Element: Mode Badge */}
          <div className="w-16 flex items-center justify-center">
            <span className="text-[11px] font-bold tracking-widest text-white/70 uppercase px-2 py-1 rounded bg-white/10 backdrop-blur-md">
              4 SHOTS
            </span>
          </div>

          {/* Center: Iconic Native iPhone Camera Shutter Button */}
          <button
            onClick={startPhotoBoothSession}
            disabled={permission !== "granted"}
            aria-label="Take Photo Booth Strip"
            className="relative flex items-center justify-center active:scale-90 transition-transform duration-150 focus:outline-none"
            style={{
              width: "82px",
              height: "82px",
              borderRadius: "50%",
              border: "4px solid #FFFFFF",
              backgroundColor: "transparent",
              padding: "4px",
              cursor: "pointer",
            }}
          >
            {/* Inner Shutter Solid White Circle */}
            <div
              style={{
                width: "66px",
                height: "66px",
                borderRadius: "50%",
                backgroundColor: "#FFFFFF",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
            />
          </button>

          {/* Right Dock Element: Flip Camera Button */}
          <div className="w-16 flex items-center justify-center">
            <button
              onClick={toggleFacingMode}
              aria-label="Flip camera"
              className="p-3 rounded-full bg-white/15 backdrop-blur-xl text-white active:scale-90 transition-transform shadow-lg border border-white/10"
              style={{
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.15)",
              }}
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
          </div>
        </footer>
      )}

      {/* 8. Results Screen: Vertical Photo Strip Display */}
      {appState === "results" && photoStripUrl && (
        <div
          className="absolute inset-0 flex flex-col bg-neutral-950/98 animate-strip"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 45,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "rgba(10, 10, 10, 0.98)",
          }}
        >
          {/* Header on Results */}
          <div
            className="flex items-center justify-between px-6 py-3 safe-top-area border-b border-neutral-900"
            style={{
              paddingTop: "max(16px, env(safe-area-inset-top))",
            }}
          >
            <span className="text-xs font-bold tracking-widest text-neutral-400 uppercase">
              YOUR PHOTO STRIP
            </span>
            {saveStatus && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-pulse">
                {saveStatus}
              </span>
            )}
          </div>

          {/* Scrollable / Scaled Preview Container */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex items-center justify-center">
            <div className="max-w-[280px] sm:max-w-[330px] w-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoStripUrl}
                alt="Photo Booth Strip"
                className="w-auto h-auto max-h-[66vh] rounded-lg shadow-2xl border border-neutral-800 object-contain mx-auto"
                style={{
                  maxHeight: "66vh",
                  borderRadius: "8px",
                  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8)",
                }}
              />
            </div>
          </div>

          {/* Actions: Save & Retake */}
          <div
            className="p-5 bg-black/80 backdrop-blur-2xl border-t border-neutral-900 flex flex-col gap-3 max-w-md mx-auto w-full"
            style={{
              paddingBottom: "max(28px, env(safe-area-inset-bottom))",
            }}
          >
            {/* Save Button */}
            <button
              onClick={handleSave}
              className="w-full py-4 px-6 bg-white text-black font-bold text-base rounded-full shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2.5"
              style={{
                backgroundColor: "#FFFFFF",
                color: "#000000",
                borderRadius: "9999px",
                fontWeight: 700,
              }}
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
              style={{
                backgroundColor: "#171717",
                color: "#E5E5E5",
                borderRadius: "9999px",
              }}
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
