"use client";
import { Suspense, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

const Model = forwardRef(({ url, pedestalSettings }, ref) => {
  const { scene } = useGLTF(url);
  const groupRef = useRef();

  // This allows the parent (Page.js) to call "exportSTL"
  useImperativeHandle(ref, () => ({
    exportSTL: () => {
      const exporter = new STLExporter();
      return exporter.parse(groupRef.current, { binary: true });
    }
  }));

  const h = pedestalSettings.height / 10;
  const r = pedestalSettings.radius / 10;
  const yOffset = pedestalSettings.offset / 10;

  return (
    <group ref={groupRef}>
      <Center bottom position={[0, yOffset, 0]}>
        <primitive object={scene} scale={pedestalSettings.scale} castShadow />
      </Center>

      <group position={[0, -h / 2, 0]}>
        <mesh receiveShadow>
          {pedestalSettings.shape === 'cylinder' ? (
            <cylinderGeometry args={[r, r, h, 64]} />
          ) : (
            <RoundedBox args={[r * 2, h, r * 2]} radius={0.15} smoothness={4} />
          )}
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
        <Text position={[0, 0, r + 0.05]} fontSize={h * 0.5} color="#1e293b">
          {pedestalSettings.text}
        </Text>
      </group>
    </group>
  );
});

export default function ModelViewer({ url, pedestalSettings, exporterRef }) {
  if (!url) return null;
  return (
    <Canvas shadows camera={{ position: [0, 2, 5], fov: 45 }}>
      <Suspense fallback={null}>
        <Stage environment="city" intensity={0.5} adjustCamera>
          <Model ref={exporterRef} url={url} pedestalSettings={pedestalSettings} />
        </Stage>
      </Suspense>
      <OrbitControls makeDefault />
    </Canvas>
  );
}