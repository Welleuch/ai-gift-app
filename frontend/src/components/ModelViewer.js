"use client";
import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text, RoundedBox, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

const Model = forwardRef(({ url, pedestalSettings }, ref) => {
  const { scene } = useGLTF(url);
  const pedestalMeshRef = useRef();
  const [modelError, setModelError] = useState(false);

  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z);
      const scale = 1.5 / maxSize;
      
      scene.position.x = -center.x * scale;
      scene.position.y = -center.y * scale;
      scene.position.z = -center.z * scale;
      scene.scale.setScalar(scale);
      
      scene.traverse((child) => {
        if (child.isMesh) {
          if (!child.material) child.material = new THREE.MeshStandardMaterial({ color: '#cbd5e1' });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, [scene]);

  useImperativeHandle(ref, () => ({
    exportSTL: () => {
      try {
        const exporter = new STLExporter();
        const allVertices = [];
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
            allVertices.push(v.x * 10, v.z * 10, (v.y * 10) + (pedestalSettings.height / 2));
          }
          tempGeom.dispose();
        };

        const modelMatrix = new THREE.Matrix4().makeScale(pedestalSettings.scale, pedestalSettings.scale, pedestalSettings.scale);
        modelMatrix.setPosition(0, pedestalSettings.offset / 10, - (pedestalSettings.depth / 10) / 3);

        scene.traverse((child) => { if (child.isMesh) extractMeshTriangles(child, modelMatrix); });
        if (pedestalMeshRef.current) extractMeshTriangles(pedestalMeshRef.current);

        const unifiedGeom = new THREE.BufferGeometry();
        unifiedGeom.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
        return exporter.parse(new THREE.Mesh(unifiedGeom), { binary: true });
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
    {/* 1. CHARACTER POSITIONING */}
    <Center 
      bottom 
      // Use the slider value from settings, default to 0 if not yet set
      position={[0, yOffset, (pedestalSettings.modelZOffset / 10) || 0]} 
    >
      <primitive 
        object={scene} 
        scale={pedestalSettings.scale} 
        onError={() => setModelError(true)} 
      />
    </Center>

    {/* 2. PEDESTAL & TEXT */}
    <group position={[0, -h / 2, 0]}>
      <mesh ref={pedestalMeshRef}>
        {/* ... (keep existing cylinder/box logic) */}
      </mesh>

      <Text 
        position={[0, h / 2 + 0.05, d / 4]} 
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.3} 
        color="#ff0000" // Set back to "#1e293b" once you confirm it works
        anchorX="center"
        anchorY="middle"
        maxWidth={w * 0.9}
      >
        {pedestalSettings.text || "DESIGN READY"}
      </Text>
    </group>
  </group>
);
});

// IMPORTANT: Name the component for the forwardRef
Model.displayName = "Model";

export default function ModelViewer({ url, pedestalSettings, exporterRef }) {
  if (!url) return null;
  
  return (
    <div className="w-full h-full">
      <Canvas shadows camera={{ position: [0, 2, 5], fov: 40 }}>
        <color attach="background" args={['#f8fafc']} />
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5} adjustCamera={false}>
            <Bounds fit clip observe margin={1.2}>
              <Model ref={exporterRef} url={url} pedestalSettings={pedestalSettings} />
            </Bounds>
          </Stage>
        </Suspense>
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 1.5} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      </Canvas>
    </div>
  );
}