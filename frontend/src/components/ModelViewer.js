"use client";
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';

export default function ModelViewer({ url }) {
  // If no URL is provided, don't try to render
  if (!url) return null;

  const { scene } = useGLTF(url);
  return (
    <Canvas shadows camera={{ position: [0, 0, 4], fov: 50 }} className="w-full h-full">
      <Stage environment="city" intensity={0.6} adjustCamera>
        <primitive object={scene} />
      </Stage>
      <OrbitControls makeDefault />
    </Canvas>
  );
}