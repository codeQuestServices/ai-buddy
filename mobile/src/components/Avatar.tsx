/**
 * 3D Avatar & Viseme Renderer Component using React Three Fiber.
 * Complies strictly with Oculus viseme morph target standards.
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  OCULUS_VISEME_KEYS,
  OculusVisemeKey,
  VisemeWeights,
  createDefaultVisemeWeights,
} from '../hooks/useVisemeSync';

export interface AvatarProps {
  modelUrl?: string;
  visemeWeights?: VisemeWeights | React.MutableRefObject<VisemeWeights>;
  updateFrame?: (delta: number) => VisemeWeights;
  isSpeaking?: boolean;
  position?: [number, number, number];
  scale?: number;
}

/**
 * Preloads a GLTF avatar asset in advance to ensure instantaneous rendering.
 */
export function preloadAvatarModel(modelUrl: string): void {
  if (modelUrl && typeof useGLTF.preload === 'function') {
    useGLTF.preload(modelUrl);
  }
}

/**
 * Procedural stylized 3D avatar head fallback with Oculus viseme blendshapes.
 */
function ProceduralAvatarMesh({
  weightsRef,
  isSpeaking,
  updateFrame,
}: {
  weightsRef: React.MutableRefObject<VisemeWeights>;
  isSpeaking?: boolean;
  updateFrame?: (delta: number) => VisemeWeights;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const jawRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    // Advance viseme interpolation towards target weights
    if (updateFrame) {
      updateFrame(delta);
    }

    const elapsed = state.clock.getElapsedTime();

    // Subtle idle breathing and head sway micro-animations
    if (headGroupRef.current) {
      headGroupRef.current.position.y = Math.sin(elapsed * 1.8) * 0.02;
      headGroupRef.current.rotation.y = Math.sin(elapsed * 0.8) * 0.04;
      headGroupRef.current.rotation.x = Math.cos(elapsed * 1.2) * 0.02;
      headGroupRef.current.rotation.z = Math.sin(elapsed * 0.6) * 0.01;
    }

    // Jaw/mouth motion driven by Oculus visemes
    if (jawRef.current) {
      const weights = weightsRef.current;
      // Open mouth influence from AA, O, E, U, I
      const mouthOpen =
        (weights.viseme_AA ?? 0) * 1.0 +
        (weights.viseme_O ?? 0) * 0.85 +
        (weights.viseme_E ?? 0) * 0.6 +
        (weights.viseme_I ?? 0) * 0.4 +
        (weights.viseme_U ?? 0) * 0.5;

      const clampedOpen = Math.min(1.0, mouthOpen);
      jawRef.current.rotation.x = -clampedOpen * 0.35;
      jawRef.current.position.y = -0.3 - clampedOpen * 0.08;
    }
  });

  return (
    <group ref={headGroupRef}>
      {/* Stylized Avatar Head */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial
          color="#8b5cf6"
          roughness={0.3}
          metalness={0.1}
          emissive="#4c1d95"
          emissiveIntensity={isSpeaking ? 0.35 : 0.15}
        />
      </mesh>

      {/* Expressive Glowing Eyes */}
      <mesh position={[-0.22, 0.12, 0.6]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={1.2}
          roughness={0.1}
        />
      </mesh>
      <mesh position={[0.22, 0.12, 0.6]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={1.2}
          roughness={0.1}
        />
      </mesh>

      {/* Articulated Jaw / Mouth Segment */}
      <group ref={jawRef} position={[0, -0.28, 0.5]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.26, 0.08, 0.15]} />
          <meshStandardMaterial
            color="#ec4899"
            emissive="#be185d"
            emissiveIntensity={isSpeaking ? 0.6 : 0.2}
            roughness={0.4}
          />
        </mesh>
      </group>

      {/* Cybernetic Aura Ring */}
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.02, 16, 64]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
}

/**
 * GLTF Model Loader sub-component for ReadyPlayerMe / standard humanoid avatars.
 */
function GLTFAvatarMesh({
  modelUrl,
  weightsRef,
  updateFrame,
}: {
  modelUrl: string;
  weightsRef: React.MutableRefObject<VisemeWeights>;
  updateFrame?: (delta: number) => VisemeWeights;
}) {
  const { scene } = useGLTF(modelUrl);
  const headMeshNodes = useRef<THREE.SkinnedMesh[]>([]);

  useEffect(() => {
    const morphMeshes: THREE.SkinnedMesh[] = [];
    scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const sm = child as THREE.SkinnedMesh;
        if (sm.morphTargetDictionary && sm.morphTargetInfluences) {
          morphMeshes.push(sm);
        }
      }
    });
    headMeshNodes.current = morphMeshes;
  }, [scene]);

  useFrame((state, delta) => {
    // Advance viseme interpolation towards target weights
    if (updateFrame) {
      updateFrame(delta);
    }

    const elapsed = state.clock.getElapsedTime();

    // Idle head sway
    scene.rotation.y = Math.sin(elapsed * 0.7) * 0.03;
    scene.rotation.x = Math.sin(elapsed * 1.1) * 0.015;

    // Apply Oculus morph target influences
    const weights = weightsRef.current;
    for (const mesh of headMeshNodes.current) {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) continue;

      for (const visemeKey of OCULUS_VISEME_KEYS) {
        const targetIdx = mesh.morphTargetDictionary[visemeKey];
        if (targetIdx !== undefined) {
          const targetWeight = weights[visemeKey] ?? 0.0;
          mesh.morphTargetInfluences[targetIdx] = targetWeight;
        }
      }
    }
  });

  return <primitive object={scene} />;
}

/**
 * Main 3D Avatar Component.
 */
export function Avatar({
  modelUrl,
  visemeWeights,
  updateFrame,
  isSpeaking = false,
  position = [0, 0, 0],
  scale = 1.0,
}: AvatarProps) {
  const fallbackWeightsRef = useRef<VisemeWeights>(createDefaultVisemeWeights());

  // Resolve weights ref or object
  const activeWeightsRef = useMemo(() => {
    if (visemeWeights && 'current' in visemeWeights) {
      return visemeWeights as React.MutableRefObject<VisemeWeights>;
    }
    if (visemeWeights && typeof visemeWeights === 'object') {
      fallbackWeightsRef.current = visemeWeights as VisemeWeights;
    }
    return fallbackWeightsRef;
  }, [visemeWeights]);

  return (
    <group position={position} scale={scale}>
      {/* Studio Lighting Rig */}
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.2}
        color="#ffffff"
      />
      <pointLight
        position={[-3, -1, 2]}
        intensity={0.6}
        color="#818cf8"
      />
      <pointLight
        position={[0, 3, -2]}
        intensity={0.8}
        color="#38bdf8"
      />

      {/* Render GLTF (with Suspense fallback) or Procedural 3D Mesh */}
      {modelUrl ? (
        <React.Suspense
          fallback={
            <ProceduralAvatarMesh
              weightsRef={activeWeightsRef}
              isSpeaking={isSpeaking}
              updateFrame={updateFrame}
            />
          }
        >
          <GLTFAvatarMesh
            modelUrl={modelUrl}
            weightsRef={activeWeightsRef}
            updateFrame={updateFrame}
          />
        </React.Suspense>
      ) : (
        <ProceduralAvatarMesh
          weightsRef={activeWeightsRef}
          isSpeaking={isSpeaking}
          updateFrame={updateFrame}
        />
      )}
    </group>
  );
}

export default Avatar;
