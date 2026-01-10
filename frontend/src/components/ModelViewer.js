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

        // HELPER: Extract raw triangles from any mesh
        const extractMeshTriangles = (mesh, customMatrix = new THREE.Matrix4()) => {
          const geom = mesh.geometry;
          if (!geom || !geom.attributes.position) return;

          // Convert to non-indexed to get a simple list of triangles
          const tempGeom = geom.index ? geom.toNonIndexed() : geom.clone();
          const position = tempGeom.attributes.position;
          
          mesh.updateMatrixWorld(true);
          // Combine the mesh's world position with any extra UI adjustments
          const finalMatrix = new THREE.Matrix4().multiplyMatrices(customMatrix, mesh.matrixWorld);

          for (let i = 0; i < position.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(position, i);
            v.applyMatrix4(finalMatrix); // Bake the scale/offset into the vertex
            allVertices.push(v.x, v.y, v.z);
          }
          tempGeom.dispose();
        };

        // 1. Process AI Model
        // We create a specific transform matrix based on your UI sliders
        const modelMatrix = new THREE.Matrix4().makeScale(
          pedestalSettings.scale,
          pedestalSettings.scale,
          pedestalSettings.scale
        );
        modelMatrix.setPosition(0, pedestalSettings.offset / 10, 0);

        scene.traverse((child) => {
          if (child.isMesh) extractMeshTriangles(child, modelMatrix);
        });

        // 2. Process Pedestal
        if (pedestalMeshRef.current) {
          extractMeshTriangles(pedestalMeshRef.current);
        }

        // 3. Create a "Perfect" unified Mesh for the exporter
        const unifiedGeom = new THREE.BufferGeometry();
        unifiedGeom.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
        const unifiedMesh = new THREE.Mesh(unifiedGeom);

        // 4. Export (This will never fail because unifiedMesh is a standard Three.js object)
        const stlResult = exporter.parse(unifiedMesh, { binary: true });
        
        // Cleanup memory
        unifiedGeom.dispose();
        
        return stlResult;
      } catch (err) {
        console.error("The 'Once and For All' Exporter failed:", err);
        return null;
      }
    }
  }));

  const h = pedestalSettings.height / 10;
  const r = pedestalSettings.radius / 10;
  const yOffset = pedestalSettings.offset / 10;

  return (
    <group>
      {/* Visual Model for the user */}
      <group position={[0, yOffset, 0]}>
        <Center bottom>
          <primitive object={scene} scale={pedestalSettings.scale} />
        </Center>
      </group>

      {/* Visual Pedestal for the user */}
      <group position={[0, -h / 2, 0]}>
        <mesh ref={pedestalMeshRef}>
          {pedestalSettings.shape === 'cylinder' ? (
            <cylinderGeometry args={[r, r, h, 64]} />
          ) : (
            <RoundedBox args={[r * 2, h, r * 2]} radius={0.1} smoothness={4}>
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