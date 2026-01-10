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
      try {
        const exporter = new STLExporter();
        const exportGroup = new THREE.Group();

        // 1. Process the AI Model with EXTREME caution
        scene.traverse((child) => {
          // Check if it's a mesh and HAS triangular geometry
          if (child.isMesh && child.geometry && child.geometry.attributes.position) {
            const clone = new THREE.Mesh(child.geometry.clone(), new THREE.MeshBasicMaterial());
            
            // Apply the user's scale and vertical offset
            const s = pedestalSettings.scale || 1;
            clone.scale.set(s, s, s);
            clone.position.y = (pedestalSettings.offset || 0) / 10;
            
            clone.updateMatrixWorld(true);
            exportGroup.add(clone);
            console.log("Exporter: Added AI Mesh component successfully");
          }
        });

        // 2. Process the Pedestal
        if (pedestalRef.current) {
          const pClone = new THREE.Mesh(pedestalRef.current.geometry.clone(), new THREE.MeshBasicMaterial());
          // Match the visual position of the pedestal
          pClone.position.y = -(pedestalSettings.height / 10) / 2;
          pClone.updateMatrixWorld(true);
          exportGroup.add(pClone);
          console.log("Exporter: Added Pedestal Mesh successfully");
        }

        // 3. Final Export
        return exporter.parse(exportGroup, { binary: true });
      } catch (err) {
        console.error("CRITICAL EXPORT ERROR:", err);
        alert("3D Geometry is too complex. Try a different design.");
        return null;
      }
    }
  }));

  const h = pedestalSettings.height / 10;
  const r = pedestalSettings.radius / 10;
  const yOffset = pedestalSettings.offset / 10;

  return (
    <group>
      {/* VISUAL MODEL */}
      <group position={[0, yOffset, 0]}>
        <Center bottom>
          <primitive object={scene} scale={pedestalSettings.scale} />
        </Center>
      </group>

      {/* VISUAL PEDESTAL */}
      <group position={[0, -h / 2, 0]}>
        <mesh ref={pedestalRef} receiveShadow>
          {pedestalSettings.shape === 'cylinder' ? (
            <cylinderGeometry args={[r, r, h, 64]} />
          ) : (
            <RoundedBox args={[r * 2, h, r * 2]} radius={0.1} smoothness={4}>
              <meshStandardMaterial color="#cbd5e1" />
            </RoundedBox>
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
    <div className="w-full h-full">
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