import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FiCamera,
  FiEdit2,
  FiImage,
  FiLoader,
  FiPauseCircle,
  FiPlayCircle,
  FiRefreshCw,
  FiSave,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
  FiUploadCloud
} from "react-icons/fi";
import FaceInfoSummary from "./FaceInfoSummary";
import { getImageFaceLandmarker, getVideoFaceLandmarker } from "../services/faceLandmarkerService";
import {
  analyzeFaceMeasurements,
  buildEmptyAnalysis,
  extractFaceMeasurements,
  averageMeasurements
} from "../utils/faceAnalysis";
import { drawFaceOverlay } from "../utils/drawFaceOverlay";
import { detectBestImageLandmarks } from "../utils/imageLandmarkDetection";

const STABILITY_WINDOW_SIZE = 15;
const MIN_VALID_FRAMES = 8;
const STABLE_CAPTURE_MS = 1500;
const DOT_HIT_RADIUS_PX = 14;

function parseCameraError(error) {
  if (!error) {
    return "Unable to start camera.";
  }

  if (error.name === "NotAllowedError") {
    return "Camera access denied. Please allow camera permission and retry.";
  }

  if (error.name === "NotFoundError") {
    return "No camera device found on this machine.";
  }

  return "Camera failed to start. Please close other camera apps and retry.";
}

function getContainViewport(naturalWidth, naturalHeight, stageWidth, stageHeight) {
  if (!naturalWidth || !naturalHeight || !stageWidth || !stageHeight) {
    return {
      x: 0,
      y: 0,
      width: stageWidth,
      height: stageHeight
    };
  }

  const scale = Math.min(stageWidth / naturalWidth, stageHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  return {
    x: (stageWidth - width) / 2,
    y: (stageHeight - height) / 2,
    width,
    height
  };
}

function shapeLabel(value) {
  if (!value) {
    return "";
  }

  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function clampValue(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function cloneFaces(faces) {
  if (!Array.isArray(faces)) {
    return [];
  }

  return faces.map((face) => face.map((point) => ({ ...point })));
}

function LiveCameraPanel({ startSignal, onAnalysisChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const videoLandmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const lastStateUpdateRef = useRef(0);
  const cameraStateRef = useRef("idle");
  const showLandmarksRef = useRef(true);

  const imageInputRef = useRef(null);
  const imageRef = useRef(null);
  const imageCanvasRef = useRef(null);
  const imageFacesRef = useRef([]);
  const originalImageFacesRef = useRef([]);
  const imageObjectUrlRef = useRef("");
  const imageViewportRef = useRef(null);
  const activeDraggedDotRef = useRef(null);

  const validMeasurementsRef = useRef([]);
  const stableSinceRef = useRef(0);
  const lockedAnalysisRef = useRef(null);

  const [mode, setMode] = useState("webcam");
  const [cameraState, setCameraState] = useState("idle");
  const [cameraNotice, setCameraNotice] = useState("Camera is off. Click Start Camera to begin analysis.");
  const [analysis, setAnalysis] = useState(buildEmptyAnalysis());
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [imageName, setImageName] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageDragActive, setImageDragActive] = useState(false);
  const [isResultLocked, setIsResultLocked] = useState(false);
  const [imageHasLandmarks, setImageHasLandmarks] = useState(false);
  const [editDotsMode, setEditDotsMode] = useState(false);
  const [isDotDragging, setIsDotDragging] = useState(false);
  const [hasUnsavedDotEdits, setHasUnsavedDotEdits] = useState(false);

  const updateCameraState = useCallback((nextState) => {
    cameraStateRef.current = nextState;
    setCameraState(nextState);
  }, []);

  const publishAnalysis = useCallback(
    (nextAnalysis) => {
      setAnalysis(nextAnalysis);
      onAnalysisChange?.(nextAnalysis);
    },
    [onAnalysisChange]
  );

  const resetWebcamCapture = useCallback((clearLocked = true) => {
    validMeasurementsRef.current = [];
    stableSinceRef.current = 0;

    if (clearLocked) {
      lockedAnalysisRef.current = null;
      setIsResultLocked(false);
    }
  }, []);

  const clearImageOverlay = useCallback(() => {
    if (imageCanvasRef.current) {
      const context = imageCanvasRef.current.getContext("2d");
      context?.clearRect(0, 0, imageCanvasRef.current.width, imageCanvasRef.current.height);
    }
  }, []);

  const drawImageOverlay = useCallback(() => {
    const imageEl = imageRef.current;
    const canvasEl = imageCanvasRef.current;

    if (!imageEl || !canvasEl) {
      return;
    }

    const stageWidth = Math.max(1, Math.round(canvasEl.clientWidth || imageEl.clientWidth || 1));
    const stageHeight = Math.max(1, Math.round(canvasEl.clientHeight || imageEl.clientHeight || 1));

    if (canvasEl.width !== stageWidth || canvasEl.height !== stageHeight) {
      canvasEl.width = stageWidth;
      canvasEl.height = stageHeight;
    }

    const viewport = getContainViewport(
      imageEl.naturalWidth,
      imageEl.naturalHeight,
      canvasEl.width,
      canvasEl.height
    );
    imageViewportRef.current = viewport;

    drawFaceOverlay(canvasEl, imageFacesRef.current, {
      showLandmarks,
      viewport
    });
  }, [showLandmarks]);

  const publishAnalysisFromCurrentImageFaces = useCallback(() => {
    const faces = imageFacesRef.current;
    if (!faces.length) {
      publishAnalysis(buildEmptyAnalysis());
      return null;
    }

    const measurement = extractFaceMeasurements(faces[0]);
    const computed = analyzeFaceMeasurements(measurement, {
      multipleFaces: faces.length > 1,
      forceClosest: !measurement?.isFrontal
    });
    publishAnalysis(computed);

    return {
      measurement,
      computed,
      multipleFaces: faces.length > 1
    };
  }, [publishAnalysis]);

  const clearImageSelection = useCallback(
    (message = "Drop an image to analyze face landmarks.") => {
      if (imageObjectUrlRef.current) {
        URL.revokeObjectURL(imageObjectUrlRef.current);
        imageObjectUrlRef.current = "";
      }

      imageFacesRef.current = [];
      originalImageFacesRef.current = [];
      imageViewportRef.current = null;
      activeDraggedDotRef.current = null;

      setImagePreviewUrl("");
      setImageName("");
      setImageHasLandmarks(false);
      setEditDotsMode(false);
      setIsDotDragging(false);
      setHasUnsavedDotEdits(false);

      clearImageOverlay();
      setCameraNotice(message);
      updateCameraState("idle");
      publishAnalysis(buildEmptyAnalysis());

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    },
    [clearImageOverlay, publishAnalysis, updateCameraState]
  );

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    resetWebcamCapture(true);
    updateCameraState("idle");
    setCameraNotice("Camera is off. Click Start Camera to begin analysis.");
    publishAnalysis(buildEmptyAnalysis());
  }, [publishAnalysis, resetWebcamCapture, updateCameraState]);

  const handleRecapture = useCallback(() => {
    resetWebcamCapture(true);
    publishAnalysis(buildEmptyAnalysis());
    setCameraNotice("Recapture started. Keep face centered and still for stable locking.");
  }, [publishAnalysis, resetWebcamCapture]);

  const getCanvasPointer = useCallback((event, canvasEl) => {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }, []);

  const findNearestEditableDot = useCallback((pointer) => {
    const viewport = imageViewportRef.current;
    const faces = imageFacesRef.current;

    if (!viewport || !faces.length) {
      return null;
    }

    let best = null;
    const maxDistanceSq = DOT_HIT_RADIUS_PX * DOT_HIT_RADIUS_PX;

    faces.forEach((face, faceIndex) => {
      face.forEach((point, pointIndex) => {
        if (!point) {
          return;
        }

        const px = viewport.x + point.x * viewport.width;
        const py = viewport.y + point.y * viewport.height;
        const dx = pointer.x - px;
        const dy = pointer.y - py;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq > maxDistanceSq) {
          return;
        }

        if (!best || distanceSq < best.distanceSq) {
          best = {
            faceIndex,
            pointIndex,
            distanceSq
          };
        }
      });
    });

    return best;
  }, []);

  const handleOverlayPointerDown = useCallback(
    (event) => {
      if (mode !== "image" || !editDotsMode || !imageHasLandmarks || !showLandmarks) {
        return;
      }

      const canvasEl = imageCanvasRef.current;
      if (!canvasEl) {
        return;
      }

      const pointer = getCanvasPointer(event, canvasEl);
      const nearest = findNearestEditableDot(pointer);
      if (!nearest) {
        return;
      }

      activeDraggedDotRef.current = nearest;
      setIsDotDragging(true);

      if (canvasEl.setPointerCapture) {
        canvasEl.setPointerCapture(event.pointerId);
      }

      event.preventDefault();
    },
    [editDotsMode, findNearestEditableDot, getCanvasPointer, imageHasLandmarks, mode, showLandmarks]
  );

  const handleOverlayPointerMove = useCallback(
    (event) => {
      if (!activeDraggedDotRef.current || mode !== "image" || !editDotsMode) {
        return;
      }

      const canvasEl = imageCanvasRef.current;
      const viewport = imageViewportRef.current;
      if (!canvasEl || !viewport || !viewport.width || !viewport.height) {
        return;
      }

      const pointer = getCanvasPointer(event, canvasEl);
      const x = clampValue((pointer.x - viewport.x) / viewport.width, 0, 1);
      const y = clampValue((pointer.y - viewport.y) / viewport.height, 0, 1);

      const { faceIndex, pointIndex } = activeDraggedDotRef.current;
      const face = imageFacesRef.current[faceIndex];
      if (!face || !face[pointIndex]) {
        return;
      }

      face[pointIndex] = {
        ...face[pointIndex],
        x,
        y
      };

      drawImageOverlay();
      if (!hasUnsavedDotEdits) {
        setHasUnsavedDotEdits(true);
      }
    },
    [drawImageOverlay, editDotsMode, getCanvasPointer, hasUnsavedDotEdits, mode]
  );

  const finishDotDrag = useCallback(
    (event) => {
      if (!activeDraggedDotRef.current) {
        return;
      }

      const canvasEl = imageCanvasRef.current;
      if (canvasEl?.releasePointerCapture && event?.pointerId !== undefined) {
        canvasEl.releasePointerCapture(event.pointerId);
      }

      activeDraggedDotRef.current = null;
      setIsDotDragging(false);

      const updated = publishAnalysisFromCurrentImageFaces();
      if (updated?.computed) {
        setCameraNotice("Dot adjusted. Save adjustments or continue refining.");
      }
    },
    [publishAnalysisFromCurrentImageFaces]
  );

  const toggleEditDotsMode = useCallback(() => {
    if (!imagePreviewUrl || !imageHasLandmarks) {
      setCameraNotice("Upload and analyze an image first, then enable Edit Dots mode.");
      return;
    }

    const next = !editDotsMode;
    setEditDotsMode(next);
    activeDraggedDotRef.current = null;
    setIsDotDragging(false);

    if (next) {
      setShowLandmarks(true);
      setCameraNotice("Edit Dots mode enabled. Drag landmark dots to improve mesh fitting.");
    } else if (hasUnsavedDotEdits) {
      setCameraNotice("Edit mode closed. Save adjustments or reset dots.");
    } else {
      setCameraNotice("Edit mode closed.");
    }
  }, [editDotsMode, hasUnsavedDotEdits, imageHasLandmarks, imagePreviewUrl]);

  const handleResetDots = useCallback(() => {
    if (!originalImageFacesRef.current.length) {
      return;
    }

    imageFacesRef.current = cloneFaces(originalImageFacesRef.current);
    setHasUnsavedDotEdits(false);
    setEditDotsMode(false);
    setIsDotDragging(false);
    activeDraggedDotRef.current = null;

    drawImageOverlay();
    publishAnalysisFromCurrentImageFaces();
    setCameraNotice("Dots reset to detected positions.");
  }, [drawImageOverlay, publishAnalysisFromCurrentImageFaces]);

  const handleSaveDotAdjustments = useCallback(() => {
    if (!imageFacesRef.current.length) {
      return;
    }

    originalImageFacesRef.current = cloneFaces(imageFacesRef.current);
    setHasUnsavedDotEdits(false);
    setEditDotsMode(false);
    setIsDotDragging(false);
    activeDraggedDotRef.current = null;

    publishAnalysisFromCurrentImageFaces();
    setCameraNotice("Dot adjustments saved.");
  }, [publishAnalysisFromCurrentImageFaces]);

  const detectFrame = useCallback(() => {
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;

    if (!videoEl || !canvasEl || cameraStateRef.current !== "active" || !videoLandmarkerRef.current) {
      return;
    }

    if (videoEl.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    if (canvasEl.width !== videoEl.videoWidth || canvasEl.height !== videoEl.videoHeight) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
    }

    const now = performance.now();
    const result = videoLandmarkerRef.current.detectForVideo(videoEl, now);
    const faceLandmarks = result?.faceLandmarks ?? [];

    drawFaceOverlay(canvasEl, faceLandmarks, { showLandmarks: showLandmarksRef.current });

    if (now - lastStateUpdateRef.current > 220) {
      lastStateUpdateRef.current = now;

      if (!faceLandmarks.length) {
        resetWebcamCapture(true);
        setCameraNotice("No face detected. Move into frame and face the camera.");
        publishAnalysis(buildEmptyAnalysis());
      } else if (faceLandmarks.length > 1) {
        resetWebcamCapture(true);
        const measurement = extractFaceMeasurements(faceLandmarks[0]);
        const computed = analyzeFaceMeasurements(measurement, {
          multipleFaces: true,
          forceClosest: true
        });
        publishAnalysis(computed);
        setCameraNotice("Multiple faces detected. Keep only one face in frame for accurate locking.");
      } else {
        const measurement = extractFaceMeasurements(faceLandmarks[0]);
        if (!measurement) {
          resetWebcamCapture(true);
          setCameraNotice("Unable to read key landmarks. Improve lighting and try again.");
          publishAnalysis(buildEmptyAnalysis());
          rafRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        if (lockedAnalysisRef.current) {
          publishAnalysis(lockedAnalysisRef.current);
          setCameraNotice("Stable capture locked. Press Recapture to scan again.");
          rafRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        if (!measurement.isFrontal) {
          resetWebcamCapture(false);
          setCameraNotice("Face the camera directly for better accuracy.");
          publishAnalysis(buildEmptyAnalysis());
          rafRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        validMeasurementsRef.current.push(measurement);
        if (validMeasurementsRef.current.length > STABILITY_WINDOW_SIZE) {
          validMeasurementsRef.current.shift();
        }

        if (!stableSinceRef.current) {
          stableSinceRef.current = now;
        }

        const validFrames = validMeasurementsRef.current.length;
        if (validFrames < MIN_VALID_FRAMES) {
          setCameraNotice(
            `Hold still and face forward (${validFrames}/${MIN_VALID_FRAMES} stable frames)...`
          );
          rafRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        const stableElapsed = now - stableSinceRef.current;
        if (stableElapsed < STABLE_CAPTURE_MS) {
          setCameraNotice("Great. Keep still for a moment while capture locks...");
          rafRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        const averaged = averageMeasurements(validMeasurementsRef.current);
        const computed = analyzeFaceMeasurements(averaged);
        lockedAnalysisRef.current = computed;
        setIsResultLocked(true);
        publishAnalysis(computed);

        if (computed.faceShapeConfidenceLabel === "closest match") {
          setCameraNotice(
            `Stable capture complete. Closest match: ${shapeLabel(computed.faceShape)}. Similar: ${shapeLabel(
              computed.similarFaceShape
            )}.`
          );
        } else {
          setCameraNotice(`Stable capture complete. Strong match: ${shapeLabel(computed.faceShape)}.`);
        }
      }
    }

    rafRef.current = requestAnimationFrame(detectFrame);
  }, [publishAnalysis, resetWebcamCapture]);

  const startCamera = useCallback(async () => {
    if (cameraStateRef.current === "loading" || cameraStateRef.current === "active") {
      return;
    }

    resetWebcamCapture(true);
    setMode("webcam");
    setEditDotsMode(false);
    setIsDotDragging(false);
    setHasUnsavedDotEdits(false);
    updateCameraState("loading");
    setCameraNotice("Requesting camera and loading face model...");

    try {
      videoLandmarkerRef.current = await getVideoFaceLandmarker();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 540 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error("Video element not available.");
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      updateCameraState("active");
      setCameraNotice("Face the camera directly. Waiting for stable capture...");
      lastStateUpdateRef.current = 0;
      rafRef.current = requestAnimationFrame(detectFrame);
    } catch (error) {
      updateCameraState("error");
      setCameraNotice(parseCameraError(error));

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      publishAnalysis(buildEmptyAnalysis());
    }
  }, [detectFrame, publishAnalysis, resetWebcamCapture, updateCameraState]);

  const analyzeUploadedImage = useCallback(async () => {
    const imageEl = imageRef.current;
    if (!imageEl) {
      return;
    }

    activeDraggedDotRef.current = null;
    setIsDotDragging(false);
    setEditDotsMode(false);
    setHasUnsavedDotEdits(false);
    setImageHasLandmarks(false);

    resetWebcamCapture(true);
    updateCameraState("loading");
    setCameraNotice("Analyzing uploaded image...");

    try {
      const imageLandmarker = await getImageFaceLandmarker();
      const detection = detectBestImageLandmarks(imageLandmarker, imageEl);
      const faceLandmarks = cloneFaces(detection.faces ?? []);

      imageFacesRef.current = faceLandmarks;
      originalImageFacesRef.current = cloneFaces(faceLandmarks);
      setImageHasLandmarks(faceLandmarks.length > 0);
      drawImageOverlay();

      if (!faceLandmarks.length) {
        updateCameraState("idle");
        setCameraNotice("No face detected in image. Try a clear, front-facing portrait.");
        publishAnalysis(buildEmptyAnalysis());
        return;
      }

      const result = publishAnalysisFromCurrentImageFaces();

      if (result?.multipleFaces) {
        setCameraNotice("Multiple faces detected in image. Using the first face.");
      } else if (!result?.measurement?.isFrontal) {
        setCameraNotice("Image analyzed with angle warning. Result shown as closest match.");
      } else if (result?.computed?.faceShapeConfidenceLabel === "closest match") {
        setCameraNotice("Image analyzed. Closest match shown with similar alternative.");
      } else if (detection.candidateLabel && detection.candidateLabel !== "original") {
        setCameraNotice("Image analyzed successfully using enhanced framing for better face coverage.");
      } else {
        setCameraNotice("Image analyzed successfully with strong match.");
      }

      updateCameraState("idle");
    } catch (error) {
      imageFacesRef.current = [];
      originalImageFacesRef.current = [];
      setImageHasLandmarks(false);
      drawImageOverlay();
      updateCameraState("error");
      setCameraNotice("Image analysis failed. Try another clear, front-facing photo.");
      publishAnalysis(buildEmptyAnalysis());
    }
  }, [drawImageOverlay, publishAnalysis, publishAnalysisFromCurrentImageFaces, resetWebcamCapture, updateCameraState]);

  const handleSelectedImage = useCallback(
    (file) => {
      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        setCameraNotice("Unsupported file type. Please upload a JPG or PNG image.");
        return;
      }

      stopCamera();
      setMode("image");

      if (imageObjectUrlRef.current) {
        URL.revokeObjectURL(imageObjectUrlRef.current);
      }

      const nextUrl = URL.createObjectURL(file);
      imageObjectUrlRef.current = nextUrl;
      imageFacesRef.current = [];
      originalImageFacesRef.current = [];
      imageViewportRef.current = null;
      activeDraggedDotRef.current = null;

      setImagePreviewUrl(nextUrl);
      setImageName(file.name);
      setImageHasLandmarks(false);
      setEditDotsMode(false);
      setIsDotDragging(false);
      setHasUnsavedDotEdits(false);

      setCameraNotice("Image loaded. Detecting face landmarks...");
      publishAnalysis(buildEmptyAnalysis());
    },
    [publishAnalysis, stopCamera]
  );

  const openImagePicker = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileInput = (event) => {
    const file = event.target.files?.[0];
    handleSelectedImage(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setImageDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    handleSelectedImage(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setImageDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setImageDragActive(false);
  };

  useEffect(() => {
    showLandmarksRef.current = showLandmarks;
  }, [showLandmarks]);

  useEffect(() => {
    if (startSignal > 0) {
      startCamera();
    }
  }, [startSignal, startCamera]);

  useEffect(() => {
    if (mode === "image") {
      stopCamera();
    }
  }, [mode, stopCamera]);

  useEffect(() => {
    if (mode === "image" && imagePreviewUrl) {
      drawImageOverlay();
    }
  }, [drawImageOverlay, imagePreviewUrl, mode, showLandmarks, editDotsMode]);

  useEffect(() => {
    if (mode !== "image" || !imagePreviewUrl) {
      return undefined;
    }

    const onResize = () => drawImageOverlay();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawImageOverlay, imagePreviewUrl, mode]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (imageObjectUrlRef.current) {
        URL.revokeObjectURL(imageObjectUrlRef.current);
      }
    };
  }, [stopCamera]);

  const cameraStageActive = cameraState === "active" || (mode === "image" && Boolean(imagePreviewUrl));
  const imageOverlayEditable = mode === "image" && editDotsMode && imageHasLandmarks && showLandmarks;

  return (
    <motion.section
      className="live-camera-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="live-camera-head">
        <h2>Live Analysis</h2>
        <div className="mode-toggle-wrap" role="tablist" aria-label="Input mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "webcam"}
            className={mode === "webcam" ? "active" : ""}
            onClick={() => setMode("webcam")}
          >
            <FiCamera /> Webcam
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "image"}
            className={mode === "image" ? "active" : ""}
            onClick={() => setMode("image")}
          >
            <FiImage /> Image
          </button>
        </div>
      </div>

      <div className={`camera-stage ${cameraStageActive ? "is-active" : ""}`}>
        {mode === "webcam" ? (
          <>
            <video ref={videoRef} playsInline muted className="camera-video" />
            <canvas ref={canvasRef} className="camera-canvas" />
          </>
        ) : (
          <div
            className={`image-drop-surface ${imageDragActive ? "is-dragging" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={imageInputRef}
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageFileInput}
              hidden
            />

            {!imagePreviewUrl ? (
              <button type="button" className="image-dropzone" onClick={openImagePicker}>
                <FiUploadCloud />
                <p>Drop image here or click to upload</p>
                <small>The image will stay in this box and be analyzed directly.</small>
              </button>
            ) : (
              <>
                <img
                  ref={imageRef}
                  src={imagePreviewUrl}
                  alt="Uploaded face for analysis"
                  className="uploaded-image"
                  onLoad={analyzeUploadedImage}
                />
                <canvas
                  ref={imageCanvasRef}
                  className={`camera-canvas image-overlay-canvas ${imageOverlayEditable ? "is-editable" : ""} ${
                    isDotDragging ? "is-dragging" : ""
                  }`}
                  onPointerDown={handleOverlayPointerDown}
                  onPointerMove={handleOverlayPointerMove}
                  onPointerUp={finishDotDrag}
                  onPointerCancel={finishDotDrag}
                  onPointerLeave={finishDotDrag}
                />
                {imageDragActive ? <div className="image-drop-overlay">Drop to replace image</div> : null}
              </>
            )}
          </div>
        )}

        {mode === "webcam" ? (
          <div className="camera-overlay-state" aria-live="polite">
            {cameraState === "loading" ? (
              <span>
                <FiLoader className="spin" /> Loading...
              </span>
            ) : null}
            {cameraState === "idle" ? <span>Camera preview will appear here</span> : null}
            {cameraState === "error" ? <span>{cameraNotice}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="camera-controls">
        {mode === "webcam" ? (
          <>
            <button
              type="button"
              className="control-btn primary"
              onClick={cameraState === "active" ? stopCamera : startCamera}
              disabled={cameraState === "loading"}
            >
              {cameraState === "active" ? <FiPauseCircle /> : <FiPlayCircle />}
              {cameraState === "active" ? "Stop Camera" : "Start Camera"}
            </button>

            <button
              type="button"
              className="control-btn"
              onClick={() => setShowLandmarks((current) => !current)}
              disabled={cameraState !== "active"}
            >
              {showLandmarks ? <FiToggleRight /> : <FiToggleLeft />}
              {showLandmarks ? "Hide Landmarks" : "Show Landmarks"}
            </button>

            {isResultLocked ? (
              <button type="button" className="control-btn" onClick={handleRecapture}>
                <FiRefreshCw /> Recapture
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button type="button" className="control-btn primary" onClick={openImagePicker}>
              <FiUploadCloud /> Upload / Replace
            </button>

            <button
              type="button"
              className={`control-btn ${editDotsMode ? "active-edit" : ""}`}
              onClick={toggleEditDotsMode}
              disabled={!imagePreviewUrl || !imageHasLandmarks}
            >
              <FiEdit2 /> {editDotsMode ? "Exit Edit Dots" : "Edit Dots"}
            </button>

            <button
              type="button"
              className="control-btn"
              onClick={handleSaveDotAdjustments}
              disabled={!hasUnsavedDotEdits}
            >
              <FiSave /> Save Adjustments
            </button>

            <button
              type="button"
              className="control-btn"
              onClick={handleResetDots}
              disabled={!imageHasLandmarks}
            >
              <FiRefreshCw /> Reset Dots
            </button>

            <button
              type="button"
              className="control-btn"
              onClick={() => clearImageSelection()}
              disabled={!imagePreviewUrl}
            >
              <FiTrash2 /> Clear Image
            </button>

            <button
              type="button"
              className="control-btn"
              onClick={() => setShowLandmarks((current) => !current)}
              disabled={!imagePreviewUrl || editDotsMode}
            >
              {showLandmarks ? <FiToggleRight /> : <FiToggleLeft />}
              {showLandmarks ? "Hide Landmarks" : "Show Landmarks"}
            </button>

            {imageName ? <span className="image-file-chip">{imageName}</span> : null}
          </>
        )}
      </div>

      <FaceInfoSummary analysis={analysis} notice={cameraNotice} />
    </motion.section>
  );
}

export default LiveCameraPanel;
