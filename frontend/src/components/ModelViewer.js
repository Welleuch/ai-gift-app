"use client";
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text, RoundedBox } from '@react-three/drei';

function Model({ url, pedestalSettings }) {
  const { scene } = useGLTF(url);

  // Conversion for Three.js units
  const h = pedestalSettings.height / 10;
  const r = pedestalSettings.radius / 10;
  const yOffset = pedestalSettings.offset / 10; // Vertical adjustment

  return (
    <group>
      {/* 1. THE AI MODEL 
          We add scale and position props here */}
      <Center bottom position={[0, yOffset, 0]}>
        <primitive 
          object={scene} 
          scale={pedestalSettings.scale} 
          castShadow 
        />
      </Center>

      {/* 2. THE PEDESTAL 
          Positioned below y=0 so the top is the "floor" */}
      <group position={[0, -h / 2, 0]}>
        <mesh receiveShadow>
          {pedestalSettings.shape === 'cylinder' ? (
            <cylinderGeometry args={[r, r, h, 64]} />
          ) : (
            <RoundedBox args={[r * 2, h, r * 2]} radius={0.15} smoothness={4}>
              <meshStandardMaterial color="#d1d5db" roughness={0.4} />
            </RoundedBox>
          )}
          <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
        </mesh>

        {/* 3. THE TEXT */}
        <Text
          position={[0, 0, r + 0.05]} 
          fontSize={h * 0.5} 
          color="#1e293b"
          anchorX="center"
          anchorY="middle"
        >
          {pedestalSettings.text}
        </Text>
      </group>
    </group>
  );
}

export default function ModelViewer({ url, pedestalSettings }) {
  if (!url) return null;
  return (
    <div className="w-full h-full bg-slate-50">
      <Canvas shadows camera={{ position: [0, 2, 5], fov: 45 }}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5} shadows="contact" adjustCamera>
            <Model url={url} pedestalSettings={pedestalSettings} />
          </Stage>
        </Suspense>
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
      </Canvas>
    </div>
  );
}