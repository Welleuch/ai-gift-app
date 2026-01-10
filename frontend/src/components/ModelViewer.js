"use client";
import { Suspense, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

const Model = forwardRef(({ url, pedestalSettings }, ref) => {
  const { scene } = useGLTF(url);
  const pedestalRef = useRef();

  useImperativeHandle(ref, () => ({
    exportSTL: () => {
      const exporter = new STLExporter();
      const exportGroup = new THREE.Group();

      // 1. Process the AI Model
      // We look for every mesh inside the AI scene and flatten it
      scene.traverse((child) => {
        if (child.isMesh && child.geometry) {
          const meshClone = new THREE.Mesh(child.geometry.clone(), child.material.clone());
          
          // Apply current UI Scale
          meshClone.scale.set(
            pedestalSettings.scale, 
            pedestalSettings.scale, 
            pedestalSettings.scale
          );

          // Apply current UI Position (Offset)
          // We divide by 10 to match Three.js units
          meshClone.position.y = pedestalSettings.offset / 10;
          
          meshClone.updateMatrixWorld();
          exportGroup.add(meshClone);
        }
      });

      // 2. Process the Pedestal
      if (pedestalRef.current) {
        const pClone = pedestalRef.current.clone();
        // Calculate pedestal Y position (it is centered at -h/2)
        pClone.position.y = -(pedestalSettings.height / 10) / 2;
        pClone.updateMatrixWorld();
        exportGroup.add(pClone);
      }

      // 3. Parse the clean group
      return exporter.parse(exportGroup, { binary: true });
    }
  }));

  const h = pedestalSettings.height / 10;
  const r = pedestalSettings.radius / 10;
  const yOffset = pedestalSettings.offset / 10;

  return (
    <group>
      {/* Visual Model for Screen */}
      <group position={[0, yOffset, 0]}>
        <Center bottom>
          <primitive object={scene} scale={pedestalSettings.scale} />
        </Center>
      </group>

      {/* Visual Pedestal for Screen */}
      <group position={[0, -h / 2, 0]}>
        <mesh ref={pedestalRef}>
          {pedestalSettings.shape === 'cylinder' ? (
            <cylinderGeometry args={[r, r, h, 64]} />
          ) : (
            <RoundedBox args={[r * 2, h, r * 2]} radius={0.1} smoothness={4}>
              <meshStandardMaterial color="#cbd5e1" />
            </RoundedBox>
          )}
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>

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