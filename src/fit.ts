import { Matrix4, Quaternion, Vector3 } from 'three';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export interface HeadFit {
  size: number;
  lift: number;
  setback: number;
}

export const DEFAULT_FIT: Readonly<HeadFit> = {
  size: 120,
  lift: -6,
  setback: 75,
};

export const FIT_LIMITS = {
  size: [70, 160],
  lift: [-35, 60],
  setback: [0, 120],
} as const;

export const FIT_STORAGE_KEY = 'evergreen.personal-fit.v2';
export const LEGACY_FIT_STORAGE_KEY = 'evergreen.personal-fit.v1';

function measurement(candidate: unknown, key: string, min: number, max: number) {
  if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < min || candidate > max) {
    throw new Error(`Saved head fit has an invalid ${key} measurement.`);
  }
  return candidate;
}

export function parseFit(serialized: string): HeadFit {
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== 'object'
    || !('size' in value) || !('lift' in value) || !('setback' in value)) {
    throw new Error('Saved head fit is missing its measurements.');
  }
  return {
    size: measurement(value.size, 'size', ...FIT_LIMITS.size),
    lift: measurement(value.lift, 'lift', ...FIT_LIMITS.lift),
    setback: measurement(value.setback, 'setback', ...FIT_LIMITS.setback),
  };
}

export function migrateLegacyFit(serialized: string): HeadFit {
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== 'object'
    || !('width' in value) || !('height' in value) || !('lift' in value) || !('setback' in value)) {
    throw new Error('Saved legacy head fit is missing its measurements.');
  }
  const width = measurement(value.width, 'width', 70, 160);
  measurement(value.height, 'height', 40, 130);
  const lift = measurement(value.lift, 'lift', -10, 60);
  return {
    size: Math.max(DEFAULT_FIT.size, width),
    lift: Math.max(FIT_LIMITS.lift[0], lift - 24),
    setback: measurement(value.setback, 'setback', ...FIT_LIMITS.setback),
  };
}

export function estimateCrownPose(
  result: FaceLandmarkerResult,
  rect: { x: number; y: number; width: number; height: number },
  outputWidth: number,
  outputHeight: number,
  fit: HeadFit,
) {
  const landmarks = result.faceLandmarks[0];
  const forehead = landmarks?.[10];
  const left = landmarks?.[234];
  const right = landmarks?.[454];
  const matrix = result.facialTransformationMatrixes[0];
  if (!forehead || !left || !right || !matrix) return undefined;

  const rotation = new Matrix4().fromArray(matrix.data);
  rotation.extractRotation(rotation);
  const quaternion = new Quaternion().setFromRotationMatrix(rotation);
  // X and Z landmarks share a width-normalized scale; Y is height-normalized.
  const faceWidth = Math.hypot(
    (left.x - right.x) * rect.width,
    (left.y - right.y) * rect.height,
    (left.z - right.z) * rect.width,
  );
  const position = new Vector3(
    rect.x + forehead.x * rect.width - outputWidth / 2,
    outputHeight / 2 - rect.y - forehead.y * rect.height,
    0,
  );
  // Move from the measured forehead to the crown in head-local space, not screen space.
  // The backward offset is what keeps the hat over the skull when turning sideways.
  position.add(new Vector3(0, fit.lift / 100, -fit.setback / 100)
    .multiplyScalar(faceWidth).applyQuaternion(quaternion));
  return { position, quaternion, scale: faceWidth / 1.6 };
}
