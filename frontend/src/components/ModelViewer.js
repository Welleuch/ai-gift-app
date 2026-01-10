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
            // THE ULTIMATE FIX: Rebuild the geometry from scratch
            // This removes "Interleaved Buffers" which cause the 'count' error
            const posAttr = child.geometry.attributes.position;
            if (!posAttr) return;

            const newGeometry = new THREE.BufferGeometry();
            // Manually copy the vertex positions into a standard Float32Array
            const vertices = new Float32Array(posAttr.array);
            newGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

            // If the AI model has an index (shortcuts), flatten it
            if (child.geometry.index) {
                const index = child.geometry.index.array;
                newGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1));
            }

            const cleanMesh = new THREE.Mesh(newGeometry.toNonIndexed(), new THREE.MeshStandardMaterial());
            
            // Apply scale and position from the UI sliders
            const s = pedestalSettings.scale || 1;
            cleanMesh.scale.set(s, s, s);
            cleanMesh.position.y = (pedestalSettings.offset || 0) / 10;
            
            cleanMesh.updateMatrixWorld(true);
            exportGroup.add(cleanMesh);
          }
        });

        // 2. Process the Pedestal
        if (pedestalRef.current) {
          const pGeom = pedestalRef.current.geometry.clone();
          const pMesh = new THREE.Mesh(pGeom, new THREE.MeshStandardMaterial());
          pMesh.position.y = -(pedestalSettings.height / 10) / 2;
          pMesh.updateMatrixWorld(true);
          exportGroup.add(pMesh);
        }

        // 3. Export as Binary STL
        return exporter.parse(exportGroup, { binary: true });

      } catch (err) {
        console.error("STLExporter process failed:", err);
        return null;
      }
    }
  }));

  const h = pedestalSettings.height / 10;
  const r = pedestalSettings.radius / 10;
  const yOffset = pedestalSettings.offset / 10;

  return (
    <group>
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
            <RoundedBox args={[r * 2, h, r * 2]} radius={0.1} smoothness={4} />
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