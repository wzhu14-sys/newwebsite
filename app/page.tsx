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
  const [aperture, setAperture] = useState<number>(2.8);

  // Filter Selection
  const [selectedFilter, setSelectedFilter] = useState<FilterId>("haru");

  // Multi-shot sequence state
  const [currentShotIndex, setCurrentShotIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);

  // Results State: Paper Theme, Doodling & Save
  const [selectedThemeId, setSelectedThemeId] = useState<string>("fresh-mint");
  const [photoStripUrl, setPhotoStripUrl] = useState<string | null>(null);
  const [stripBlob, setStripBlob] = useState<Blob | null>(null);
  const [activeTab, setActiveTab] = useState<"view" | "doodle">("view");
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Start camera stream at highest resolution supported
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
            width: { ideal: 3840, min: 1280 },
            height: { ideal: 2160, min: 720 },
            frameRate: { ideal: 30, max: 60 },
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

  // Capture single frame with uncompressed quality & applied filter
  const captureFrame = useCallback((): string => {
    const video = videoRef.current;
    if (!video) return "";

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (isMirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    const currentFilterConfig = FILTERS.find((f) => f.id === selectedFilter);
    if (currentFilterConfig && currentFilterConfig.cssFilter !== "none") {
      ctx.filter = currentFilterConfig.cssFilter;
    }
    ctx.drawImage(video, 0, 0, width, height);
    ctx.filter = "none";

    applyFilterToCanvas(ctx, width, height, selectedFilter, aperture);

    return canvas.toDataURL("image/jpeg", 1.0);
  }, [isMirrored, selectedFilter, aperture]);

  // Run 4-shot photobooth session
  const startPhotoBoothSession = async () => {
    if (appState !== "camera" || permission !== "granted") return;

    setAppState("capturing");
    setCapturedPhotos([]);
    const photos: string[] = [];

    for (let shot = 1; shot <= 4; shot++) {
      setCurrentShotIndex(shot);

      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        playCountdownTick(c % 2 === 0);
        if ("vibrate" in navigator) {
          navigator.vibrate(30);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      setCountdown(0);

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

      if (shot < 4) {
        await new Promise((r) => setTimeout(r, 700));
      }
    }

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
  };

  const handleSave = async () => {
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

    const fileName = `photobooth-${Date.now()}.png`;
    const file = new File([currentBlob], fileName, { type: "image/png" });

    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: "Life 4 Cuts Photo Strip",
          text: "Created with Retro Photo Booth!",
        });
        setSaveStatus("Saved to Photos!");
        setTimeout(() => setSaveStatus(null), 3000);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.warn("Share sheet dismissed:", err);
      }
    }

    try {
      const a = document.createElement("a");
      a.href = currentUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSaveStatus("Downloaded!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Download failed:", err);
      setSaveStatus("Save Failed");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const currentFilterConfig = FILTERS.find((f) => f.id === selectedFilter);

  return (
    <div className="min-h-[100dvh] w-full bg-[#C3C7D0] flex flex-col items-center justify-center p-2 sm:p-6 overflow-y-auto">
      {/* Retro Window Container (Portrait Focused) */}
      <div className="retro-window w-full max-w-[460px] flex flex-col overflow-hidden my-auto">
        {/* 1. Classic Windows Title Bar */}
        <div className="bg-[#000080] text-white px-2 py-1 flex items-center justify-between font-bold text-xs select-none">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-sm">📸</span>
            <span className="tracking-wide">PhotoBooth FM</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="retro-button w-4 h-4 bg-[#D4D0C8] text-black font-bold text-[10px] leading-none flex items-center justify-center"
            >
              _
            </button>
            <button
              type="button"
              className="retro-button w-4 h-4 bg-[#D4D0C8] text-black font-bold text-[10px] leading-none flex items-center justify-center"
            >
              □
            </button>
            <button
              type="button"
              className="retro-button w-4 h-4 bg-[#D4D0C8] text-black font-bold text-[10px] leading-none flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 2. Window Main Body */}
        <div className="p-3 bg-[#D4D0C8] flex flex-col gap-3">
          {/* Top Panel: Sunken Viewport (Left) + Tactile Control Deck (Right) */}
          <div className="flex gap-3 items-stretch">
            {/* Left: Sunken Portrait Camera Viewport (保持竖屏拍摄) */}
            <div className="relative w-[56%] aspect-[3/4] retro-bevel-in overflow-hidden flex items-center justify-center bg-black">
              {permission === "denied" ? (
                <div className="p-3 text-center text-red-400 text-xs flex flex-col items-center justify-center">
                  <span className="text-2xl mb-1">⚠️</span>
                  <span>Camera access needed</span>
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="retro-button px-2 py-1 mt-2 text-black text-[11px] font-bold"
                  >
                    Enable
                  </button>
                </div>
              ) : appState === "results" && photoStripUrl ? (
                /* Results preview inside the retro frame */
                <div className="w-full h-full p-1 overflow-y-auto flex items-center justify-center bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoStripUrl}
                    alt="Photo Strip Preview"
                    className="w-full h-auto max-h-full object-contain mx-auto"
                  />
                </div>
              ) : (
                /* Live Camera Video Feed */
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{
                      transform: isMirrored ? "scaleX(-1)" : "none",
                      filter: currentFilterConfig?.cssFilter || "none",
                    }}
                  />

                  {/* Aperture soft focus vignette */}
                  {aperture < 8 && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at center, transparent 40%, rgba(0,0,0,${(
                          (8 - aperture) *
                          0.04
                        ).toFixed(2)}) 85%)`,
                        backdropFilter: `blur(${Math.max(0, (4 - aperture) * 1.1)}px)`,
                      }}
                    />
                  )}

                  {/* Red REC dot */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span>REC</span>
                  </div>

                  {/* Shot countdown overlay inside viewport */}
                  {appState === "capturing" && countdown !== null && countdown > 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none">
                      <div
                        key={countdown}
                        className="text-6xl font-black text-[#10B981] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] animate-pop"
                      >
                        {countdown}
                      </div>
                      <div className="text-[11px] font-bold text-white bg-black/80 px-2 py-0.5 mt-1 border border-white/20">
                        SHOT {currentShotIndex} OF 4
                      </div>
                    </div>
                  )}

                  {/* Flash */}
                  {isFlashing && (
                    <div className="absolute inset-0 bg-white animate-flash pointer-events-none" />
                  )}
                </>
              )}
            </div>

            {/* Right: Tactile Audio/Player Control Deck */}
            <div className="flex-1 flex flex-col justify-between gap-2">
              {/* Spinning CD & LED Meter */}
              <div className="flex items-center justify-between gap-2">
                {/* Iridescent Spinning CD */}
                <div
                  className={`w-12 h-12 rounded-full retro-bevel-out relative flex items-center justify-center shadow ${
                    appState === "capturing" ? "animate-spin-cd" : ""
                  }`}
                  style={{
                    background:
                      "radial-gradient(circle, #D4D0C8 18%, #808080 20%, #E2E8F0 40%, #A7F3D0 60%, #DDD6FE 80%, #D4D0C8 100%)",
                  }}
                >
                  <div className="w-4 h-4 rounded-full bg-white border border-gray-400 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-black" />
                  </div>
                </div>

                {/* Vertical LED Progress Bar (Mint Green) */}
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-12 retro-bevel-in p-0.5 flex flex-col-reverse justify-between bg-black">
                    {[1, 2, 3, 4].map((step) => {
                      const isLit =
                        appState === "results" || currentShotIndex >= step;
                      return (
                        <div
                          key={step}
                          className={`w-full h-2 rounded-[1px] transition-colors ${
                            isLit
                              ? "bg-[#10B981] shadow-[0_0_4px_#10B981]"
                              : "bg-[#064E3B]"
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setAperture((a) => (a <= 1.4 ? 16 : 1.4))}
                      className="retro-button w-6 h-5 text-[11px] font-bold flex items-center justify-center"
                      title="Toggle Aperture"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMirrored((m) => !m)}
                      className="retro-button w-6 h-5 text-[11px] font-bold flex items-center justify-center"
                      title="Toggle Mirror"
                    >
                      🪞
                    </button>
                  </div>
                </div>
              </div>

              {/* Tape Cassette Motif */}
              <div className="retro-bevel-in p-1 bg-[#1F2937] flex items-center justify-around h-7 text-[9px] text-[#10B981] font-mono">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-sm" />
                <span>[ 4 SHOTS CASSETTE ]</span>
              </div>

              {/* Shutter / Snap Button (Play/Pause style) */}
              {appState !== "results" ? (
                <button
                  type="button"
                  onClick={startPhotoBoothSession}
                  disabled={permission !== "granted" || appState === "capturing"}
                  className="retro-button w-full py-2 bg-[#D4D0C8] font-bold text-xs flex items-center justify-center gap-1.5 active:bg-[#C0C0C0]"
                >
                  <span className="w-3 h-3 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
                  <span>{appState === "capturing" ? "RECORDING..." : "● SNAP"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRetake}
                  className="retro-button w-full py-2 bg-[#D4D0C8] font-bold text-xs flex items-center justify-center gap-1"
                >
                  <span>↺ RETAKE</span>
                </button>
              )}

              {/* Row of Icon Controls (Flip Camera, Undo, Save) */}
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="retro-button flex-1 py-1 text-xs font-bold flex items-center justify-center"
                  title="Flip front/rear camera"
                >
                  ⏮ FLIP
                </button>
                <button
                  type="button"
                  onClick={() => setIsMirrored((m) => !m)}
                  className="retro-button flex-1 py-1 text-xs font-bold flex items-center justify-center"
                  title="Mirror view"
                >
                  ⇄ MIR
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={appState !== "results"}
                  className={`retro-button flex-1 py-1 text-xs font-bold flex items-center justify-center ${
                    appState === "results"
                      ? "bg-[#10B981] text-black font-extrabold"
                      : "opacity-40"
                  }`}
                  title="Save strip to photos"
                >
                  ♥ SAVE
                </button>
              </div>
            </div>
          </div>

          {/* Middle Selectors: Artist, Title, Station, Mode style */}
          <div className="flex flex-col gap-2 pt-1 font-mono text-xs">
            {/* Filter Selector */}
            <div className="flex items-center gap-2">
              <span className="w-16 text-right font-bold text-[#111827]">Filter:</span>
              <div className="flex-1 relative">
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value as FilterId)}
                  className="retro-select w-full"
                >
                  {FILTERS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.badge})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Aperture Selector */}
            <div className="flex items-center gap-2">
              <span className="w-16 text-right font-bold text-[#111827]">Aperture:</span>
              <div className="flex-1 relative">
                <select
                  value={aperture}
                  onChange={(e) => setAperture(parseFloat(e.target.value))}
                  className="retro-select w-full"
                >
                  <option value={1.4}>f/1.4 - Wide Bokeh (Soft Focus)</option>
                  <option value={2.0}>f/2.0 - Dreamy Portrait</option>
                  <option value={2.8}>f/2.8 - Standard Studio</option>
                  <option value={4.0}>f/4.0 - Clean Balanced</option>
                  <option value={8.0}>f/8.0 - Sharp Edge-to-Edge</option>
                  <option value={16.0}>f/16.0 - Ultra Sharp Field</option>
                </select>
              </div>
            </div>

            {/* Paper Theme Selector */}
            <div className="flex items-center gap-2">
              <span className="w-16 text-right font-bold text-[#111827]">Theme:</span>
              <div className="flex-1 relative">
                <select
                  value={selectedThemeId}
                  onChange={(e) => handleThemeChange(e.target.value)}
                  className="retro-select w-full"
                >
                  {PAPER_THEMES.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Lower Slider Bar & Time Indicator */}
          <div className="flex items-center gap-3 pt-1">
            <span className="font-mono text-xs font-bold w-10">
              0:0{currentShotIndex || 4}
            </span>

            {/* Beveled Slider Track */}
            <div className="flex-1 h-3 retro-bevel-in bg-[#808080] relative flex items-center">
              {/* Draggable/Stepping Retro Slider Thumb */}
              <div
                className="w-4 h-5 retro-bevel-out bg-[#D4D0C8] shadow absolute cursor-pointer"
                style={{
                  left: `${((currentShotIndex || 4) / 4) * 88}%`,
                  transform: "translateX(-50%)",
                }}
              />
            </div>

            <span className="font-mono text-xs font-bold w-12 text-right">
              {appState === "capturing"
                ? `${currentShotIndex}/4`
                : appState === "results"
                ? "DONE"
                : "READY"}
            </span>
          </div>

          {/* Results Action Mode Tab (Doodle Canvas overlay when requested) */}
          {appState === "results" && (
            <div className="flex flex-col gap-2 pt-2 border-t-2 border-[#808080]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#111827]">
                  {saveStatus ? `Status: ${saveStatus}` : "Strip Ready!"}
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === "view" ? "doodle" : "view")}
                    className="retro-button px-2.5 py-1 text-xs font-bold flex items-center gap-1"
                  >
                    {activeTab === "view" ? "✏️ Doodle Mode" : "🖼️ View Strip"}
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="retro-button px-3 py-1 bg-[#10B981] text-black text-xs font-extrabold flex items-center gap-1"
                  >
                    💾 Save to Photos
                  </button>
                </div>
              </div>

              {/* Embedded Doodle Tool when active */}
              {activeTab === "doodle" && (
                <div className="relative w-full rounded retro-bevel-in bg-black p-2 flex flex-col items-center">
                  <div className="relative w-full max-w-[280px] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoStripUrl || ""}
                      alt="Strip for doodling"
                      className="w-full h-auto block select-none pointer-events-none"
                    />
                    <DoodleCanvas
                      ref={doodleRef}
                      width={1200}
                      height={3712}
                      className="absolute inset-0 w-full h-full"
                      onStrokeChange={() => updateStrip(selectedThemeId)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Bottom Windows Taskbar (Start Bar) */}
        <div className="h-9 bg-[#D4D0C8] border-t-2 border-white px-2 flex items-center justify-between font-mono text-xs select-none">
          {/* Start Button */}
          <button
            type="button"
            onClick={startPhotoBoothSession}
            className="retro-button h-6 px-2 flex items-center gap-1.5 font-bold"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-green-500 to-emerald-400 border border-black/40" />
            <span>Start</span>
          </button>

          {/* Inset Status Pill */}
          <div className="h-6 px-3 retro-bevel-in bg-[#C3C7D0] flex items-center text-[11px] text-gray-800 truncate">
            {saveStatus || "photobooth.vercel.app"}
          </div>
        </div>
      </div>
    </div>
  );
}
