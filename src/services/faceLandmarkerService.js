import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let videoLandmarkerPromise;
let imageLandmarkerPromise;

async function createLandmarker(runningMode) {
  const filesetResolver = await FilesetResolver.forVisionTasks(WASM_PATH);

  return FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: MODEL_PATH
    },
    runningMode,
    numFaces: 2,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  });
}

export async function getVideoFaceLandmarker() {
  if (!videoLandmarkerPromise) {
    videoLandmarkerPromise = createLandmarker("VIDEO");
  }

  return videoLandmarkerPromise;
}

export async function getImageFaceLandmarker() {
  if (!imageLandmarkerPromise) {
    imageLandmarkerPromise = createLandmarker("IMAGE");
  }

  return imageLandmarkerPromise;
}
