"use client";
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text, RoundedBox } from '@react-three/drei';

export default function ModelViewer({ url, pedestalSettings }) {
  if (!url) return null;
  const { scene } = useGLTF(url);

  // Conversion: We treat our slider values as mm, but Three.js uses units. 
  // We divide by 10 for a good visual scale.
  const h = pedestalSettings.height / 10;
  const r = pedestalSettings.radius / 10;

  return (
    <Canvas shadows camera={{ position: [0, 2, 5], fov: 40 }} className="w-full h-full">
      <Stage environment="city" intensity={0.5} shadows="contact" adjustCamera>
        
        {/* 1. THE AI MODEL: We wrap it in <Center bottom> 
            This ensures the "feet" of the model are always at y=0 */}
        <Center bottom>
          <primitive object={scene} castShadow />
        </Center>

        {/* 2. THE PEDESTAL: We position it at -h/2 
            This ensures the "top surface" of the pedestal is at y=0 */}
        <group position={[0, -h / 2, 0]}>
          <mesh receiveShadow>
            {pedestalSettings.shape === 'cylinder' ? (
              <cylinderGeometry args={[r, r, h, 64]} />
            ) : (
              // RoundedBox is perfect for FDM printing
              <RoundedBox args={[r * 1.8, h, r * 1.8]} radius={0.1} smoothness={4}>
                <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
              </RoundedBox>
            )}
            <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
          </mesh>

          {/* 3. THE TEXT: Positioned on the front face of the pedestal */}
          <Text
            position={[0, 0, r + 0.05]} // Positioned slightly in front of the base
            fontSize={h * 0.4} // Scale font based on pedestal height
            color="#1e293b"
            font="/fonts/Inter-Bold.woff" // Standard font
            anchorX="center"
            anchorY="middle"
          >
            {pedestalSettings.text}
          </Text>
        </group>

      </Stage>
      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
    </Canvas>
  );
}