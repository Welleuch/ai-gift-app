"use client";
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text } from '@react-three/drei';

export default function ModelViewer({ url, pedestalSettings }) {
  if (!url) return null;
  const { scene } = useGLTF(url);

  return (
    <Canvas shadows camera={{ position: [0, 2, 5], fov: 45 }} className="w-full h-full">
      <Stage environment="city" intensity={0.5} adjustCamera={false}>
        <Center top>
          {/* THE AI GENERATED MODEL */}
          <primitive object={scene} castShadow />

          {/* THE DYNAMIC PEDESTAL */}
          <mesh position={[0, -pedestalSettings.height / 20, 0]} receiveShadow>
            {pedestalSettings.shape === 'cylinder' ? (
              <cylinderGeometry args={[pedestalSettings.radius/10, pedestalSettings.radius/10, pedestalSettings.height/10, 32]} />
            ) : (
              <boxGeometry args={[pedestalSettings.radius/5, pedestalSettings.height/10, pedestalSettings.radius/5]} />
            )}
            <meshStandardMaterial color="#d1d5db" roughness={0.3} />
            
            {/* ENGRAVED TEXT PREVIEW */}
            <Text
              position={[0, 0, pedestalSettings.radius/10 + 0.01]}
              fontSize={0.2}
              color="#475569"
              anchorX="center"
              anchorY="middle"
            >
              {pedestalSettings.text}
            </Text>
          </mesh>
        </Center>
      </Stage>
      <OrbitControls makeDefault />
    </Canvas>
  );
}