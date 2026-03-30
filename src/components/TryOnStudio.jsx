import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FiAlertCircle, FiImage, FiLoader, FiSliders, FiUploadCloud } from "react-icons/fi";
import { getImageFaceLandmarker } from "../services/faceLandmarkerService";
import { detectBestImageLandmarks } from "../utils/imageLandmarkDetection";
import { HAIRSTYLE_LIBRARY, hairstyleLabelFromSlug, normalizeHairstyleSlug } from "../services/hairstyleLibrary";

const LEFT_TEMPLE_INDEX = 234;
const RIGHT_TEMPLE_INDEX = 454;
const FOREHEAD_TOP_INDEX = 10;
const CHIN_INDEX = 152;

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

  return {
    x: (stageWidth - naturalWidth * scale) / 2,
    y: (stageHeight - naturalHeight * scale) / 2,
    width: naturalWidth * scale,
    height: naturalHeight * scale
  };
}

function toViewportPoint(point, viewport) {
  if (!point || !viewport) {
    return null;
  }

  return {
    x: viewport.x + point.x * viewport.width,
    y: viewport.y + point.y * viewport.height
  };
}

function distance(pointA, pointB) {
  if (!pointA || !pointB) {
    return 0;
  }

  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildImageCandidates(slug) {
  return [
    `/hairstyles/overlays/${slug}_overlay.png`,
    `/${slug}_overlay.png`,
    `/${slug}.png`,
    `/${slug}.webp`,
    `/${slug}.jpg`,
    `/${slug}.jpeg`,
    `/hairstyles/previews/${slug}.png`,
    `/hairstyles/previews/${slug}.webp`,
    `/hairstyles/previews/${slug}.jpg`,
    `/hairstyles/previews/${slug}.jpeg`
  ];
}

function loadImageFromCandidates(candidates) {
  return new Promise((resolve, reject) => {
    let index = 0;

    const tryNext = () => {
      if (index >= candidates.length) {
        reject(new Error("No usable image found."));
        return;
      }

      const source = candidates[index];
      index += 1;

      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = tryNext;
      image.src = source;
    };

    tryNext();
  });
}

function buildStyleOptions(suggestedStyles) {
  const suggestedSet = new Set(suggestedStyles.map((style) => normalizeHairstyleSlug(style)).filter(Boolean));
  const seen = new Set();
  const ordered = [];

  suggestedSet.forEach((slug) => {
    if (seen.has(slug)) {
      return;
    }

    seen.add(slug);
    ordered.push(slug);
  });

  HAIRSTYLE_LIBRARY.forEach((style) => {
    if (seen.has(style.slug)) {
      return;
    }

    seen.add(style.slug);
    ordered.push(style.slug);
  });

  return ordered.map((slug) => ({
    slug,
    label: hairstyleLabelFromSlug(slug),
    suggested: suggestedSet.has(slug)
  }));
}

function drawFaceDots(context, face, viewport) {
  context.save();
  context.fillStyle = "rgba(47, 75, 207, 0.65)";

  for (let index = 0; index < face.length; index += 5) {
    const point = toViewportPoint(face[index], viewport);
    if (!point) {
      continue;
    }

    context.beginPath();
    context.arc(point.x, point.y, 1.6, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawHairOverlay(context, image, face, viewport, scaleMultiplier, liftOffset) {
  if (!image || !face || !viewport) {
    return false;
  }

  const leftTemple = toViewportPoint(face[LEFT_TEMPLE_INDEX], viewport);
  const rightTemple = toViewportPoint(face[RIGHT_TEMPLE_INDEX], viewport);
  const foreheadTop = toViewportPoint(face[FOREHEAD_TOP_INDEX], viewport);
  const chin = toViewportPoint(face[CHIN_INDEX], viewport);

  if (!leftTemple || !rightTemple || !foreheadTop || !chin) {
    return false;
  }

  const faceWidth = distance(leftTemple, rightTemple);
  const faceHeight = distance(foreheadTop, chin);

  if (!faceWidth || !faceHeight) {
    return false;
  }

  const centerX = (leftTemple.x + rightTemple.x) / 2;
  const targetY = foreheadTop.y + faceHeight * (0.09 + liftOffset);
  const angle = Math.atan2(rightTemple.y - leftTemple.y, rightTemple.x - leftTemple.x);

  const drawWidth = faceWidth * scaleMultiplier;
  const drawHeight = drawWidth * (image.height / image.width);
  const anchorY = drawHeight * 0.74;

  context.save();
  context.translate(centerX, targetY);
  context.rotate(angle);
  context.drawImage(image, -drawWidth / 2, -anchorY, drawWidth, drawHeight);
  context.restore();

  return true;
}

function TryOnStudio({ suggestedStyles = [] }) {
  const imageInputRef = useRef(null);
  const sourceImageRef = useRef(null);
  const canvasRef = useRef(null);
  const imageObjectUrlRef = useRef("");
  const overlayImageRef = useRef(null);
  const primaryFaceRef = useRef(null);
  const analysisRunRef = useRef(0);

  const styleOptions = useMemo(() => buildStyleOptions(suggestedStyles), [suggestedStyles]);
  const [selectedStyle, setSelectedStyle] = useState(styleOptions[0]?.slug ?? "");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [assetState, setAssetState] = useState("idle");
  const [analysisState, setAnalysisState] = useState("idle");
  const [notice, setNotice] = useState("Upload one front-facing image to preview hairstyle try-on.");
  const [overlayScale, setOverlayScale] = useState(2.02);
  const [overlayLift, setOverlayLift] = useState(-0.02);
  const [showDots, setShowDots] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);

  const renderComposite = useCallback(() => {
    const canvas = canvasRef.current;
    const image = sourceImageRef.current;

    if (!canvas) {
      return;
    }

    const width = Math.max(1, Math.round(canvas.clientWidth || 1));
    const height = Math.max(1, Math.round(canvas.clientHeight || 1));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f8faff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (!image || !image.naturalWidth || !image.naturalHeight) {
      return;
    }

    const viewport = getContainViewport(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);

    context.drawImage(image, viewport.x, viewport.y, viewport.width, viewport.height);

    const primaryFace = primaryFaceRef.current;
    if (!primaryFace) {
      return;
    }

    const overlayImage = overlayImageRef.current;
    if (overlayImage) {
      drawHairOverlay(context, overlayImage, primaryFace, viewport, overlayScale, overlayLift);
    }

    if (showDots) {
      drawFaceDots(context, primaryFace, viewport);
    }
  }, [overlayLift, overlayScale, showDots]);

  const analyzeUploadedImage = useCallback(async () => {
    const imageEl = sourceImageRef.current;
    if (!imageEl) {
      return;
    }

    const currentRunId = analysisRunRef.current + 1;
    analysisRunRef.current = currentRunId;

    primaryFaceRef.current = null;
    setAnalysisState("loading");
    setNotice("Analyzing uploaded image landmarks...");
    renderComposite();

    try {
      const imageLandmarker = await getImageFaceLandmarker();
      const detection = detectBestImageLandmarks(imageLandmarker, imageEl);

      if (analysisRunRef.current !== currentRunId) {
        return;
      }

      const faces = detection?.faces ?? [];
      if (!faces.length) {
        primaryFaceRef.current = null;
        setAnalysisState("error");
        setNotice("No face detected. Upload a clear front-facing image.");
        renderComposite();
        return;
      }

      primaryFaceRef.current = faces[0];
      setAnalysisState("ready");

      if (faces.length > 1) {
        setNotice("Multiple faces found. Using the first face for try-on.");
      } else if (detection?.candidateLabel && detection.candidateLabel !== "original") {
        setNotice("Image analyzed with enhanced framing for better forehead coverage.");
      } else {
        setNotice("Image ready. Pick styles and adjust size/lift for fit.");
      }

      renderComposite();
    } catch (error) {
      if (analysisRunRef.current !== currentRunId) {
        return;
      }

      primaryFaceRef.current = null;
      setAnalysisState("error");
      setNotice("Image analysis failed. Try a different clear portrait.");
      renderComposite();
    }
  }, [renderComposite]);

  const handleSelectedImage = useCallback(
    (file) => {
      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        setNotice("Unsupported file type. Upload JPG, PNG, or WEBP image.");
        return;
      }

      if (imageObjectUrlRef.current) {
        URL.revokeObjectURL(imageObjectUrlRef.current);
      }

      const nextUrl = URL.createObjectURL(file);
      imageObjectUrlRef.current = nextUrl;
      primaryFaceRef.current = null;
      analysisRunRef.current += 1;

      setImagePreviewUrl(nextUrl);
      setImageName(file.name);
      setAnalysisState("idle");
      setNotice("Image loaded. Starting face analysis...");
    },
    []
  );

  const openImagePicker = () => {
    imageInputRef.current?.click();
  };

  const handleInputChange = (event) => {
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
    if (!styleOptions.length) {
      setSelectedStyle("");
      return;
    }

    if (!selectedStyle || !styleOptions.find((option) => option.slug === selectedStyle)) {
      setSelectedStyle(styleOptions[0].slug);
    }
  }, [selectedStyle, styleOptions]);

  useEffect(() => {
    let canceled = false;

    if (!selectedStyle) {
      overlayImageRef.current = null;
      setAssetState("idle");
      renderComposite();
      return undefined;
    }

    setAssetState("loading");

    loadImageFromCandidates(buildImageCandidates(selectedStyle))
      .then((image) => {
        if (canceled) {
          return;
        }

        overlayImageRef.current = image;
        setAssetState("ready");
        renderComposite();
      })
      .catch(() => {
        if (canceled) {
          return;
        }

        overlayImageRef.current = null;
        setAssetState("error");
        renderComposite();
      });

    return () => {
      canceled = true;
    };
  }, [renderComposite, selectedStyle]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite, overlayScale, overlayLift, showDots, imagePreviewUrl, analysisState]);

  useEffect(() => {
    const onResize = () => renderComposite();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [renderComposite]);

  useEffect(() => {
    return () => {
      if (imageObjectUrlRef.current) {
        URL.revokeObjectURL(imageObjectUrlRef.current);
      }
    };
  }, []);

  const suggestedSlugSet = useMemo(
    () => new Set(suggestedStyles.map((style) => normalizeHairstyleSlug(style)).filter(Boolean)),
    [suggestedStyles]
  );

  return (
    <motion.section
      className="tryon-studio"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="tryon-head">
        <h4>
          <FiImage /> Image Try-On
        </h4>
        <p>Upload One Image, Detect Face Once, Then Preview Recommended Haircuts.</p>
      </div>

      <div className="tryon-controls-grid">
        <label>
          Selected Style
          <select value={selectedStyle} onChange={(event) => setSelectedStyle(event.target.value)}>
            {styleOptions.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
                {option.suggested ? " (Recommended)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          Size
          <input
            type="range"
            min="1.45"
            max="2.55"
            step="0.01"
            value={overlayScale}
            onChange={(event) => setOverlayScale(Number(event.target.value))}
          />
        </label>

        <label>
          Lift
          <input
            type="range"
            min="-0.2"
            max="0.2"
            step="0.01"
            value={overlayLift}
            onChange={(event) => setOverlayLift(Number(event.target.value))}
          />
        </label>
      </div>

      {suggestedStyles.length ? (
        <div className="tryon-suggested-row">
          {Array.from(suggestedSlugSet).map((slug) => (
            <button
              type="button"
              key={slug}
              className={`tryon-suggestion-chip ${selectedStyle === slug ? "active" : ""}`}
              onClick={() => setSelectedStyle(slug)}
            >
              {hairstyleLabelFromSlug(slug)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="tryon-image-actions">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="tryon-upload-input"
          onChange={handleInputChange}
        />

        <button type="button" className="tryon-btn primary" onClick={openImagePicker}>
          <FiUploadCloud /> {imagePreviewUrl ? "Replace Image" : "Upload Image"}
        </button>

        <button
          type="button"
          className="tryon-btn"
          onClick={() => setShowDots((current) => !current)}
          disabled={analysisState !== "ready"}
        >
          <FiSliders /> {showDots ? "Hide Dots" : "Show Dots"}
        </button>

        {imageName ? <span className="tryon-file-chip">{imageName}</span> : null}
      </div>

      <div
        className={`tryon-stage ${imagePreviewUrl ? "is-active has-image" : ""} ${imageDragActive ? "is-dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {!imagePreviewUrl ? (
          <button type="button" className="tryon-placeholder" onClick={openImagePicker}>
            <FiUploadCloud />
            <p>Drop Image Here Or Click To Upload</p>
            <small>Best results come from front-facing portrait photos.</small>
          </button>
        ) : (
          <>
            <img
              ref={sourceImageRef}
              src={imagePreviewUrl}
              alt="Uploaded source for hairstyle try-on"
              className="tryon-source-image"
              onLoad={analyzeUploadedImage}
            />
            <canvas ref={canvasRef} className="tryon-canvas" />
          </>
        )}

        {imageDragActive ? <div className="tryon-drop-overlay">Drop to replace image</div> : null}

        <div className={`tryon-stage-status ${analysisState === "loading" ? "is-loading" : ""}`}>
          {analysisState === "loading" ? (
            <span>
              <FiLoader className="spin" /> Detecting Face Landmarks...
            </span>
          ) : (
            <span>{notice}</span>
          )}
        </div>
      </div>

      {assetState === "error" ? (
        <p className="tryon-warning">
          <FiAlertCircle /> Selected style image could not be loaded. Check matching filename in public folder.
        </p>
      ) : null}
    </motion.section>
  );
}

export default TryOnStudio;
