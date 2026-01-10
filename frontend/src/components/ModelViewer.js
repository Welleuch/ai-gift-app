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

        // 1. Process the AI Model
        scene.traverse((child) => {
          if (child.isMesh && child.geometry) {
            // FIX: We must "un-index" and "de-interleave" the geometry
            // This converts the complex AI memory into a simple list of triangles
            let geometry = child.geometry.clone();
            if (geometry.index) {
                geometry = geometry.toNonIndexed();
            }

            const meshClone = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
            
            // Apply current UI Scale and Position
            const s = pedestalSettings.scale || 1;
            meshClone.scale.set(s, s, s);
            meshClone.position.y = (pedestalSettings.offset || 0) / 10;
            
            meshClone.updateMatrixWorld(true);
            exportGroup.add(meshClone);
          }
        });

        // 2. Process the Pedestal
        if (pedestalRef.current) {
          const pGeom = pedestalRef.current.geometry.clone();
          const pClone = new THREE.Mesh(pGeom, new THREE.MeshStandardMaterial());
          pClone.position.y = -(pedestalSettings.height / 10) / 2;
          pClone.updateMatrixWorld(true);
          exportGroup.add(pClone);
        }

        // 3. Final Export (Binary mode is much faster and smaller)
        const result = exporter.parse(exportGroup, { binary: true });
        console.log("Success: STL Data parsed successfully");
        return result;

      } catch (err) {
        console.error("STLExporter crashed:", err);
        return null;
      }
    }
  }));

  const h = pedestalSettings.height / 10;
  const r = pedestalSettings.radius / 10;
  const yOffset = pedestalSettings.offset / 10;

  return (
    <group>
      {/* Visual Preview */}
      <group position={[0, yOffset, 0]}>
        <Center bottom>
          <primitive object={scene} scale={pedestalSettings.scale} />
        </Center>
      </group>

      <group position={[0, -h / 2, 0]}>
        <mesh ref={pedestalRef}>
          {pedestalSettings.shape === 'cylinder' ? (
            <cylinderGeometry args={[r, r, h, 64]} />
          ) : (
            <RoundedBox args={[r * 2, h, r * 2]} radius={0.15} smoothness={4}>
              <meshStandardMaterial color="#cbd5e1" />
            </RoundedBox>
          )}
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
        <Text position={[0, 0, r + 0.05]} fontSize={h * 0.4} color="#1e293b">
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