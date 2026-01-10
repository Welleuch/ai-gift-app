"use client";
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text, RoundedBox } from '@react-three/drei';

function Model({ url, pedestalSettings }) {
  // useGLTF will "suspend" the component until the model is downloaded
  const { scene } = useGLTF(url);

  const h = pedestalSettings.height / 10;
  const r = pedestalSettings.radius / 10;

  return (
    <group>
      {/* 1. THE AI MODEL */}
      <Center bottom>
        <primitive object={scene} castShadow />
      </Center>

      {/* 2. THE PEDESTAL */}
      <group position={[0, -h / 2, 0]}>
        <mesh receiveShadow>
          {pedestalSettings.shape === 'cylinder' ? (
            <cylinderGeometry args={[r, r, h, 64]} />
          ) : (
            <RoundedBox args={[r * 1.8, h, r * 1.8]} radius={0.1} smoothness={4}>
              <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
            </RoundedBox>
          )}
          <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
        </mesh>

        {/* 3. THE TEXT (Removed the custom font path to prevent 404 error) */}
        <Text
          position={[0, 0, r + 0.02]} 
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
}

export default function ModelViewer({ url, pedestalSettings }) {
  if (!url) return null;

  return (
    <div className="w-full h-full">
      <Canvas shadows camera={{ position: [0, 2, 5], fov: 40 }}>
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