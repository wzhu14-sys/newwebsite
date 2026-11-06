"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  playCountdownTick,
  playMechanicalShutterThud,
  playThermalPrinterWhir,
} from "./utils/sound";
import {
  createPhotoStrip,
  PAPER_THEMES,
} from "./utils/photoStrip";
import {
  FILTERS,
  FilterId,
  applyFilterToCanvas,
} from "./utils/filters";
import {
  getRandom4Poses,
  PosePrompt,
} from "./utils/poses";
import {
  DoodleCanvas,
  DoodleCanvasRef,
} from "./components/DoodleCanvas";

type PermissionStatus = "pending" | "granted" | "denied";
type AppState = "camera" | "capturing" | "results";

export default function PhotoBooth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doodleRef = useRef<DoodleCanvasRef>(null);

  const [permission, setPermission] = useState<PermissionStatus>("pending");
  const [appState, setAppState] = useState<AppState>("camera");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // Camera Settings: Mirror & Aperture
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [aperture, setAperture] = useState<number>(2.8); // f/1.4 ~ f/16
  const [showApertureControl, setShowApertureControl] = useState<boolean>(false);

  // Filter Selection
  const [selectedFilter, setSelectedFilter] = useState<FilterId>("kodak");
  const [showFilterPicker, setShowFilterPicker] = useState<boolean>(false);

  // Pose Roulette
  const [poses, setPoses] = useState<PosePrompt[]>([]);
  const [enablePoseRoulette, setEnablePoseRoulette] = useState<boolean>(true);

  // Multi-shot sequence state
  const [currentShotIndex, setCurrentShotIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);

  // Results State: Paper Theme, Doodling & Save
  const [selectedThemeId, setSelectedThemeId] = useState<string>("pastel-pink");
  const [photoStripUrl, setPhotoStripUrl] = useState<string | null>(null);
  const [stripBlob, setStripBlob] = useState<Blob | null>(null);
  const [activeTab, setActiveTab] = useState<"view" | "doodle">("view");
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Initialize poses on load
  useEffect(() => {
    setPoses(getRandom4Poses());
  }, []);

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

  // Re-roll pose roulette
  const rerollPoses = () => {
    setPoses(getRandom4Poses());
  };

  // Capture single frame with baked filter, grain, and aperture
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

    // Mirror image if isMirrored is active
    if (isMirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    // Draw base video
    const currentFilterConfig = FILTERS.find((f) => f.id === selectedFilter);
    if (currentFilterConfig && currentFilterConfig.cssFilter !== "none") {
      ctx.filter = currentFilterConfig.cssFilter;
    }
    ctx.drawImage(video, 0, 0, width, height);
    ctx.filter = "none";

    // Apply pixel-level effects (grain, pixelate, aperture vignette)
    applyFilterToCanvas(ctx, width, height, selectedFilter, aperture);

    return canvas.toDataURL("image/jpeg", 0.95);
  }, [isMirrored, selectedFilter, aperture]);

  // Run 4-shot photobooth session
  const startPhotoBoothSession = async () => {
    if (appState !== "camera" || permission !== "granted") return;

    setAppState("capturing");
    setCapturedPhotos([]);
    const photos: string[] = [];

    // Ensure we have fresh poses if roulette is enabled
    if (enablePoseRoulette && poses.length < 4) {
      setPoses(getRandom4Poses());
    }

    for (let shot = 1; shot <= 4; shot++) {
      setCurrentShotIndex(shot);

      // 3-2-1 Countdown with tick-tock audio
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        playCountdownTick(c % 2 === 0);
        if ("vibrate" in navigator) {
          navigator.vibrate(30);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      setCountdown(0);

      // Shutter flash & heavy mechanical thud
      setIsFlashing(true);
      playMechanicalShutterThud();
      if ("vibrate" in navigator) {
        navigator.vibrate([70, 50, 70]);
      }

      const photo = captureFrame();
      photos.push(photo);
      setCapturedPhotos([...photos]);

      await new Promise((r) => setTimeout(r, 220));
      setIsFlashing(false);
      setCountdown(null);

      // Pause briefly for user to look at next pose
      if (shot < 4) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    // Sequence finished -> Trigger thermal printer whirring sound & eject animation!
    setIsPrinting(true);
    playThermalPrinterWhir(1.6);

    try {
      const { dataUrl, blob } = await createPhotoStrip(photos, {
        themeId: selectedThemeId,
      });
      setPhotoStripUrl(dataUrl);
      setStripBlob(blob);
      setAppState("results");
    } catch (e) {
      console.error("Failed to generate photo strip:", e);
      setAppState("results");
    } finally {
      setTimeout(() => setIsPrinting(false), 1600);
    }
  };

  // Re-composite strip when theme or doodle changes
  const updateStrip = useCallback(
    async (themeId: string = selectedThemeId) => {
      if (capturedPhotos.length === 0) return;
      try {
        const doodleCanvas = doodleRef.current?.getCanvas();
        const { dataUrl, blob } = await createPhotoStrip(capturedPhotos, {
          themeId,
          doodleCanvas,
        });
        setPhotoStripUrl(dataUrl);
        setStripBlob(blob);
      } catch (err) {
        console.error("Failed to update strip:", err);
      }
    },
    [capturedPhotos, selectedThemeId]
  );

  // Handle theme color change
  const handleThemeChange = (themeId: string) => {
    setSelectedThemeId(themeId);
    updateStrip(themeId);
  };

  const handleRetake = () => {
    setAppState("camera");
    setCapturedPhotos([]);
    setPhotoStripUrl(null);
    setStripBlob(null);
    setSaveStatus(null);
    setActiveTab("view");
    startCamera(facingMode);
    rerollPoses();
  };

  // Save / Share Image
  const handleSave = async () => {
    // Generate fresh composite with doodle layer baked in
    const doodleCanvas = doodleRef.current?.getCanvas();
    let currentBlob = stripBlob;
    let currentUrl = photoStripUrl;

    if (capturedPhotos.length > 0) {
      const { dataUrl, blob } = await createPhotoStrip(capturedPhotos, {
        themeId: selectedThemeId,
        doodleCanvas,
      });
      currentUrl = dataUrl;
      currentBlob = blob;
      setPhotoStripUrl(dataUrl);
      setStripBlob(blob);
    }

    if (!currentUrl || !currentBlob) return;

    const fileName = `purikura-${Date.now()}.png`;
    const file = new File([currentBlob], fileName, { type: "image/png" });

    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: "Life 4 Cuts Photo Strip",
          text: "Created with Japanese/Korean Photo Booth!",
        });
        setSaveStatus("Saved to Photos / 已分享!");
        setTimeout(() => setSaveStatus(null), 3000);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.warn("Share sheet dismissed:", err);
      }
    }

    // Laptop/Desktop download
    try {
      const a = document.createElement("a");
      a.href = currentUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSaveStatus("Downloaded / 已保存!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Download failed:", err);
      setSaveStatus("Save failed / 保存失败");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const currentPose =
    appState === "capturing" && currentShotIndex > 0
      ? poses[currentShotIndex - 1]
      : null;

  const currentFilterConfig = FILTERS.find((f) => f.id === selectedFilter);

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
          style={{ position: "absolute", inset: 0, zIndex: 60 }}
        >
          <div className="w-20 h-20 mb-6 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">需要相机权限 / Camera Needed</h1>
          <p className="text-gray-300 text-sm max-w-sm mb-6 leading-relaxed">
            请在浏览器设置中允许相机访问权限，以便体验大头贴拍摄。
          </p>
          <button
            onClick={() => startCamera(facingMode)}
            className="w-full max-w-xs py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-base rounded-full shadow-lg active:scale-95 transition-transform"
          >
            开启相机 / Try Again
          </button>
        </div>
      )}

      {/* 2. Full-Screen Live Video Feed with Filter & Aperture Preview */}
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
          className="w-full h-full object-cover"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: isMirrored ? "scaleX(-1)" : "none",
            filter: currentFilterConfig?.cssFilter || "none",
          }}
        />

        {/* Aperture Soft Depth-of-Field Vignette Simulation */}
        {aperture < 8 && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at center, transparent 40%, rgba(0,0,0,${(
                (8 - aperture) *
                0.05
              ).toFixed(2)}) 85%)`,
              backdropFilter: `blur(${Math.max(0, (4 - aperture) * 1.2)}px)`,
            }}
          />
        )}

        {/* Purikura Framing Corner Brackets */}
        <div className="viewfinder-corner corner-tl border-pink-400/60" />
        <div className="viewfinder-corner corner-tr border-pink-400/60" />
        <div className="viewfinder-corner corner-bl border-pink-400/60" />
        <div className="viewfinder-corner corner-br border-pink-400/60" />
      </div>

      {/* 3. Screen Flash */}
      {isFlashing && (
        <div
          className="absolute inset-0 bg-white animate-flash pointer-events-none"
          style={{ position: "absolute", inset: 0, zIndex: 60 }}
        />
      )}

      {/* 4. Top Safe-Area Bar: Filters, Poses, Mirror, Aperture */}
      {appState !== "results" && (
        <header
          className="absolute top-0 inset-x-0 flex flex-col px-4 safe-top-area pointer-events-none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            paddingTop: "max(14px, env(safe-area-inset-top))",
            paddingLeft: "max(16px, env(safe-area-inset-left))",
            paddingRight: "max(16px, env(safe-area-inset-right))",
          }}
        >
          {/* Main Top Navigation Row */}
          <div className="flex items-center justify-between w-full">
            {/* Purikura Brand Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-pink-500/30 shadow-md pointer-events-auto">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping" />
              <span className="text-xs font-black tracking-wider uppercase text-pink-200">
                LIFE 4 CUTS
              </span>
            </div>

            {/* Quick Action Pills */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Filter Button */}
              <button
                type="button"
                onClick={() => {
                  setShowFilterPicker((prev) => !prev);
                  setShowApertureControl(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-xl border transition-all flex items-center gap-1.5 ${
                  showFilterPicker
                    ? "bg-pink-500 text-white border-pink-400 shadow-lg shadow-pink-500/30"
                    : "bg-black/60 text-neutral-200 border-white/15"
                }`}
              >
                <span>✨ 滤镜: {currentFilterConfig?.name}</span>
              </button>

              {/* Aperture Button */}
              <button
                type="button"
                onClick={() => {
                  setShowApertureControl((prev) => !prev);
                  setShowFilterPicker(false);
                }}
                className={`px-2.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-xl border transition-all ${
                  showApertureControl
                    ? "bg-amber-400 text-black border-amber-300"
                    : "bg-black/60 text-neutral-200 border-white/15"
                }`}
              >
                f/{aperture}
              </button>

              {/* Mirror Flip Toggle */}
              <button
                type="button"
                onClick={() => setIsMirrored((prev) => !prev)}
                title={isMirrored ? "镜像开启" : "原图不镜像"}
                className={`p-2 rounded-full backdrop-blur-xl border transition-all ${
                  isMirrored
                    ? "bg-pink-500/30 border-pink-400/50 text-pink-300"
                    : "bg-black/60 border-white/15 text-white/70"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Sub-bar: Filter Picker Drawer */}
          {showFilterPicker && (
            <div className="mt-2.5 p-2 bg-black/80 backdrop-blur-2xl border border-white/15 rounded-2xl flex items-center gap-2 overflow-x-auto pointer-events-auto animate-pop shadow-2xl">
              {FILTERS.map((f) => {
                const isSelected = selectedFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0 transition-all ${
                      isSelected
                        ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md scale-105"
                        : "bg-neutral-900 text-neutral-300 border border-neutral-800"
                    }`}
                  >
                    <div>{f.name}</div>
                    <div className="text-[9px] opacity-75">{f.nameEn}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sub-bar: Aperture Slider Drawer */}
          {showApertureControl && (
            <div className="mt-2.5 p-3 bg-black/85 backdrop-blur-2xl border border-white/15 rounded-2xl pointer-events-auto animate-pop shadow-2xl flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-bold text-amber-300">
                <span>镜头光圈: f/{aperture}</span>
                <span className="text-neutral-400 text-[11px]">
                  {aperture <= 2.0 ? "大光圈 • 柔美虚化" : aperture <= 4 ? "标准人像" : "小光圈 • 全景清晰"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 mt-1">
                {[1.4, 2.0, 2.8, 4.0, 5.6, 8.0, 16.0].map((fVal) => (
                  <button
                    key={fVal}
                    type="button"
                    onClick={() => setAperture(fVal)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                      aperture === fVal
                        ? "bg-amber-400 text-black shadow-md scale-110"
                        : "bg-neutral-800 text-neutral-300"
                    }`}
                  >
                    {fVal}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pose Roulette Card (Camera Idle State) */}
          {appState === "camera" && enablePoseRoulette && poses.length > 0 && (
            <div className="mt-3 mx-auto w-full max-w-sm p-2.5 bg-gradient-to-r from-pink-950/70 via-purple-950/70 to-black/80 backdrop-blur-xl border border-pink-500/30 rounded-2xl shadow-lg pointer-events-auto flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-xl">🎲</span>
                <div className="truncate">
                  <div className="text-xs font-black text-pink-300 flex items-center gap-1.5">
                    <span>姿势盲盒连拍提示</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-pink-500/30 rounded-full text-pink-200">
                      4 POSES
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-300 truncate">
                    {poses.map((p, idx) => `${idx + 1}.${p.emoji}${p.title}`).join("  ")}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <button
                  type="button"
                  onClick={rerollPoses}
                  title="随机换一批姿势"
                  className="px-2 py-1 text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/40 rounded-lg active:scale-95 transition-transform"
                >
                  换一组 🔄
                </button>
              </div>
            </div>
          )}
        </header>
      )}

      {/* 5. Live Captured Thumbnails Preview Rail (during capture) */}
      {appState === "capturing" && (
        <div
          className="absolute top-24 right-4 flex flex-col gap-2.5 pointer-events-none"
          style={{ position: "absolute", top: "90px", right: "16px", zIndex: 35 }}
        >
          {[0, 1, 2, 3].map((index) => {
            const photo = capturedPhotos[index];
            const isCurrent = currentShotIndex === index + 1;
            const poseItem = poses[index];
            return (
              <div
                key={index}
                className={`w-14 h-12 rounded-xl border-2 overflow-hidden transition-all duration-300 shadow-xl relative ${
                  photo
                    ? "border-pink-400 bg-black scale-100 opacity-100"
                    : isCurrent
                    ? "border-amber-400 bg-amber-400/30 scale-110 animate-pulse"
                    : "border-white/20 bg-black/60 opacity-40"
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
                  <div className="w-full h-full flex flex-col items-center justify-center text-[10px] font-bold text-white/80">
                    <span>{poseItem ? poseItem.emoji : index + 1}</span>
                    <span className="text-[9px]">{index + 1}/4</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Big Animated Countdown & Pose Tip Overlay during capture */}
      {appState === "capturing" && countdown !== null && countdown > 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ position: "absolute", inset: 0, zIndex: 40 }}
        >
          {/* Big number */}
          <div
            key={countdown}
            className="text-9xl font-black text-pink-300 drop-shadow-[0_4px_30px_rgba(255,42,133,0.8)] animate-pop"
            style={{ fontSize: "7.5rem", fontWeight: 900 }}
          >
            {countdown}
          </div>

          {/* Current Pose Prompt Card */}
          {currentPose && (
            <div className="mt-4 px-6 py-2.5 rounded-full bg-black/80 backdrop-blur-2xl border-2 border-pink-400/80 shadow-[0_0_24px_rgba(255,105,180,0.5)] flex items-center gap-2.5 animate-pop">
              <span className="text-3xl">{currentPose.emoji}</span>
              <div className="text-left">
                <div className="text-sm font-black text-pink-200">
                  第 {currentShotIndex} 张: {currentPose.title}
                </div>
                <div className="text-xs text-white/80">{currentPose.tip}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. Bottom Shutter Controls Deck (Camera Mode) */}
      {appState === "camera" && (
        <footer
          className="absolute bottom-0 inset-x-0 flex items-center justify-around px-8 bg-gradient-to-t from-black/95 via-black/75 to-transparent pointer-events-auto"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            paddingBottom: "max(32px, env(safe-area-inset-bottom))",
            paddingTop: "24px",
            minHeight: "140px",
          }}
        >
          {/* Left Dock Button: Pose Roulette Toggle */}
          <div className="w-16 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setEnablePoseRoulette((prev) => !prev)}
              className={`p-3 rounded-full backdrop-blur-xl border transition-all ${
                enablePoseRoulette
                  ? "bg-pink-500/30 border-pink-400 text-pink-300 shadow-md"
                  : "bg-white/10 border-white/15 text-white/50"
              }`}
              title="切换姿势轮盘"
            >
              <span className="text-xl">🎲</span>
            </button>
          </div>

          {/* Center: Iconic Japanese Purikura Shutter Button */}
          <button
            onClick={startPhotoBoothSession}
            disabled={permission !== "granted"}
            aria-label="Start Photo Booth"
            className="relative flex items-center justify-center active:scale-90 transition-transform duration-150 focus:outline-none"
            style={{
              width: "86px",
              height: "86px",
              borderRadius: "50%",
              border: "4px solid #FF2A85",
              boxShadow: "0 0 20px rgba(255, 42, 133, 0.4)",
              backgroundColor: "transparent",
              padding: "4px",
              cursor: "pointer",
            }}
          >
            {/* Inner Shutter Solid White with pink ring */}
            <div
              style={{
                width: "70px",
                height: "70px",
                borderRadius: "50%",
                backgroundColor: "#FFFFFF",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  backgroundColor: "#FF2A85",
                }}
              />
            </div>
          </button>

          {/* Right Dock Button: Camera Switch */}
          <div className="w-16 flex items-center justify-center">
            <button
              type="button"
              onClick={toggleFacingMode}
              aria-label="Flip front/back camera"
              className="p-3 rounded-full bg-white/15 backdrop-blur-xl text-white active:scale-90 transition-transform shadow-lg border border-white/15"
              style={{
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </footer>
      )}

      {/* 8. Results Screen: Purikura Japanese/Korean Photo Booth */}
      {appState === "results" && photoStripUrl && (
        <div
          className="absolute inset-0 flex flex-col bg-neutral-950/98 animate-strip"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 45,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "rgba(12, 12, 12, 0.98)",
          }}
        >
          {/* Top Bar on Results */}
          <div
            className="flex items-center justify-between px-5 py-2.5 safe-top-area border-b border-neutral-900 bg-black/60 backdrop-blur-xl"
            style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}
          >
            {/* View / Doodle Mode Switch Tabs */}
            <div className="flex items-center p-1 bg-neutral-900 rounded-full border border-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTab("view")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  activeTab === "view"
                    ? "bg-white text-black shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                预览效果 / Strip
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("doodle")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  activeTab === "doodle"
                    ? "bg-pink-500 text-white shadow-md shadow-pink-500/30"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                ✏️ 手写涂鸦 / Doodle
              </button>
            </div>

            {saveStatus ? (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-pulse">
                {saveStatus}
              </span>
            ) : isPrinting ? (
              <span className="px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-bold animate-bounce">
                🖨️ 吐纸打印中...
              </span>
            ) : (
              <span className="text-xs font-bold text-neutral-400">
                LIFE 4 CUTS
              </span>
            )}
          </div>

          {/* Paper Theme Swatch Bar */}
          <div className="px-4 py-2 bg-neutral-950/80 border-b border-neutral-900/60 flex items-center justify-between gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-neutral-400 flex-shrink-0">
              边框颜色:
            </span>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {PAPER_THEMES.map((theme) => {
                const isSelected = selectedThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleThemeChange(theme.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex-shrink-0 ${
                      isSelected
                        ? "ring-2 ring-pink-500 border-white scale-105 shadow-md"
                        : "border-neutral-800 opacity-80"
                    }`}
                    style={{
                      backgroundColor: theme.bgColor,
                      color: theme.textColor,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: theme.accentDot }}
                    />
                    <span>{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex items-center justify-center">
            {activeTab === "view" ? (
              /* View Strip Preview */
              <div className="max-w-[280px] sm:max-w-[320px] w-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoStripUrl}
                  alt="Photo Booth Strip"
                  className="w-auto h-auto max-h-[60vh] rounded-lg shadow-2xl border border-neutral-800 object-contain mx-auto transition-transform"
                  style={{
                    maxHeight: "60vh",
                    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.85)",
                  }}
                />
              </div>
            ) : (
              /* Interactive Doodle Mode */
              <div className="relative max-w-[280px] sm:max-w-[320px] w-full flex flex-col items-center">
                <div className="relative w-full rounded-lg overflow-hidden border border-neutral-700 shadow-2xl">
                  {/* Background Strip */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoStripUrl}
                    alt="Photo Strip for doodling"
                    className="w-full h-auto block select-none pointer-events-none"
                  />
                  {/* Transparent Drawing Canvas Overlay */}
                  <DoodleCanvas
                    ref={doodleRef}
                    width={800}
                    height={2474}
                    className="absolute inset-0 w-full h-full"
                    onStrokeChange={() => updateStrip(selectedThemeId)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Results Action Buttons: Save & Retake */}
          <div
            className="p-4 sm:p-5 bg-black/85 backdrop-blur-2xl border-t border-neutral-900 flex flex-col gap-2.5 max-w-md mx-auto w-full"
            style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
          >
            {/* Save Button */}
            <button
              onClick={handleSave}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white font-extrabold text-base rounded-full shadow-lg shadow-pink-500/25 active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>保存相册 / Save Photo Strip</span>
            </button>

            {/* Retake Button */}
            <button
              onClick={handleRetake}
              className="w-full py-3 px-6 bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold text-sm rounded-full active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>重新拍摄 / Retake</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
