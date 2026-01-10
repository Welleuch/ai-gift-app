"use client";
import { Suspense, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

const Model = forwardRef(({ url, pedestalSettings }, ref) => {
  const { scene } = useGLTF(url);
  const groupRef = useRef();

  useImperativeHandle(ref, () => ({
    exportSTL: () => {
      const exporter = new STLExporter();
      const cleanScene = new THREE.Scene();

      // 1. Traverse the AI Model and the Pedestal Group
      // We ONLY add objects that are real Meshes with valid geometry
      groupRef.current.traverse((child) => {
        if (child.isMesh && child.geometry) {
          // We create a temporary copy to maintain world position/scale
          const clone = child.clone();
          child.getWorldPosition(clone.position);
          child.getWorldQuaternion(clone.quaternion);
          child.getWorldScale(clone.scale);
          cleanScene.add(clone);
        }
      });

      // 2. Export the clean scene (No text, no lights, no helpers)
      return exporter.parse(cleanScene, { binary: true });
    }
  }));

  const h = pedestalSettings.height / 10;
  const r = pedestalSettings.radius / 10;
  const yOffset = pedestalSettings.offset / 10;

  return (
    <group ref={groupRef}>
      {/* 1. THE AI MODEL */}
      <group position={[0, yOffset, 0]}>
        <Center bottom>
          <primitive object={scene} scale={pedestalSettings.scale} />
        </Center>
      </group>

      {/* 2. THE PEDESTAL */}
      <group position={[0, -h / 2, 0]}>
        <mesh receiveShadow>
          {pedestalSettings.shape === 'cylinder' ? (
            <cylinderGeometry args={[r, r, h, 64]} />
          ) : (
            <RoundedBox args={[r * 2, h, r * 2]} radius={0.1} smoothness={4} />
          )}
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>

        {/* 3. THE TEXT (Visual only - ignored by exporter) */}
        <Text
          position={[0, 0, r + 0.05]}
          fontSize={h * 0.4}
          color="#1e293b"
          anchorX="center"
          anchorY="middle"
        >
          {pedestalSettings.text}
        </Text>
      </group>
    </group>
  );
});

export default function ModelViewer({ url, pedestalSettings, exporterRef }) {
  if (!url) return null;
  return (
    <div className="w-full h-full bg-slate-50">
      <Canvas shadows camera={{ position: [0, 2, 5], fov: 40 }}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5} shadows="contact" adjustCamera>
            <Model ref={exporterRef} url={url} pedestalSettings={pedestalSettings} />
          </Stage>
        </Suspense>
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
      </Canvas>
    </div>
  );
}