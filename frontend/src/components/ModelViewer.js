"use client";
import { Suspense, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

const Model = forwardRef(({ url, pedestalSettings }, ref) => {
  const { scene } = useGLTF(url);
  const pedestalMeshRef = useRef();

  useImperativeHandle(ref, () => ({
    exportSTL: () => {
      try {
        const exporter = new STLExporter();
        const allVertices = [];
        
        // h is the height in Three.js units (e.g., 1.3 for 13mm)
        const h = pedestalSettings.height / 10;

        const extractMeshTriangles = (mesh, customMatrix = new THREE.Matrix4()) => {
          const geom = mesh.geometry;
          if (!geom || !geom.attributes.position) return;

          const tempGeom = geom.index ? geom.toNonIndexed() : geom.clone();
          const position = tempGeom.attributes.position;
          
          mesh.updateMatrixWorld(true);
          const finalMatrix = new THREE.Matrix4().multiplyMatrices(customMatrix, mesh.matrixWorld);

          for (let i = 0; i < position.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(position, i);
            v.applyMatrix4(finalMatrix);
            
            // --- THE PHYSICAL FIX ---
            // 1. Multiply by 10 to get real mm.
            // 2. Add (height / 2) to the Y coordinate (which is Z in the slicer).
            // This ensures the bottom of the pedestal is at 0.
            const physicalX = v.x * 10;
            const physicalY = v.y * 10;
            const physicalZ = (v.z * 10) + (pedestalSettings.height / 2); 

            // Note: STL uses X, Y, Z. In Three.js, Y is UP. In Slicers, Z is UP.
            // So we map Three.js Y to STL Z.
            allVertices.push(physicalX, physicalZ, physicalY);
          }
          tempGeom.dispose();
        };

        // 1. Process AI Model
        const modelMatrix = new THREE.Matrix4().makeScale(
          pedestalSettings.scale,
          pedestalSettings.scale,
          pedestalSettings.scale
        );
        // Position it based on the offset
        modelMatrix.setPosition(0, pedestalSettings.offset / 10, 0);

        scene.traverse((child) => {
          if (child.isMesh) extractMeshTriangles(child, modelMatrix);
        });

        // 2. Process Pedestal
        if (pedestalMeshRef.current) {
          extractMeshTriangles(pedestalMeshRef.current);
        }

        const unifiedGeom = new THREE.BufferGeometry();
        unifiedGeom.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
        const unifiedMesh = new THREE.Mesh(unifiedGeom);

        return exporter.parse(unifiedMesh, { binary: true });
      } catch (err) {
        console.error("Export failed:", err);
        return null;
      }
    }
  }));

  const h = pedestalSettings.height / 10;
  const w = pedestalSettings.width / 10;
  const d = pedestalSettings.depth / 10;
  const yOffset = pedestalSettings.offset / 10;

  return (
    <group>
      <group position={[0, yOffset, 0]}>
        <Center bottom><primitive object={scene} scale={pedestalSettings.scale} /></Center>
      </group>

      <group position={[0, -h / 2, 0]}>
        <mesh ref={pedestalMeshRef}>
          {pedestalSettings.shape === 'cylinder' ? (
            <cylinderGeometry args={[w/2, w/2, h, 64]} />
          ) : (
            <RoundedBox args={[w, h, d]} radius={0.1} smoothness={4}>
               <meshStandardMaterial color="#cbd5e1" />
            </RoundedBox>
          )}
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
        <Text position={[0, 0, (pedestalSettings.shape === 'cylinder' ? w/2 : d/2) + 0.05]} 
              fontSize={h * 0.5} color="#1e293b">
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
          <Stage environment="city" intensity={0.5} adjustCamera>
            <Model ref={exporterRef} url={url} pedestalSettings={pedestalSettings} />
          </Stage>
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}