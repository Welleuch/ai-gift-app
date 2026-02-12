"use client";
import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text, RoundedBox, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

const Model = forwardRef(({ url, pedestalSettings, setSettings }, ref) => {
  const { scene } = useGLTF(url);
  const pedestalMeshRef = useRef();
  const [modelError, setModelError] = useState(false);
  const hasAutoScaled = useRef(false); // Prevents the infinite loop

  useEffect(() => {
    if (scene && !hasAutoScaled.current) {
      // 1. Calculate the model's boundaries
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // 2. AUTO-SCALE Logic
      // Target: Model should be 70% of the pedestal width (w/10)
      const targetSizeInThreeUnits = (pedestalSettings.width / 10) * 0.7; 
      const currentMaxDim = Math.max(size.x, size.y, size.z);
      const calculatedScale = targetSizeInThreeUnits / currentMaxDim;
      
      // 3. APPLY POSITION (Feet to 0)
      scene.position.x = -center.x * calculatedScale;
      scene.position.y = -box.min.y * calculatedScale; 
      scene.position.z = -center.z * calculatedScale;
      scene.scale.setScalar(calculatedScale);

      // 4. UPDATE GLOBAL SETTINGS (Once)
      // We wrap this in a timeout or check to prevent React render loops
      setTimeout(() => {
        setSettings(prev => ({
          ...prev,
          scale: calculatedScale * 10, // Sync slider to the new scale
          offset: pedestalSettings.height / 2 // Position feet on top of base
        }));
      }, 0);

      hasAutoScaled.current = true; // Lock it so it doesn't loop
    }
  }, [scene, url]); // Reset when the URL changes (new model)

  // Reset the lock if a new model is loaded
  useEffect(() => {
    hasAutoScaled.current = false;
  }, [url]);


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
      {/* We use position directly on Center to move the model relative to the world 0,0,0 */}
      <Center 
         
        position={[0, pedestalSettings.height / 20, (pedestalSettings.modelZOffset / 10) || 0]}
      >
        <primitive 
          object={scene} 
          scale={pedestalSettings.scale} 
          onError={() => setModelError(true)} 
        />
      </Center>

      {/* 2. PEDESTAL & TEXT */}
      {/* Removed the negative Y offset to keep the pedestal resting ON the grid */}
      <group position={[0, h / 2, 0]}>
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

        {/* 3. TEXT - Lifted slightly above the top surface (h/2) */}
        <Text 
          position={[0, h / 2 + 0.02, d / 4]} 
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.2} // Reduced size to fit better on top
          color="#1e293b" // Changed back from Red to Dark Slate
          anchorX="center"
          anchorY="middle"
          maxWidth={w * 0.9}
        >
          {pedestalSettings.text || ""}
        </Text>
      </group>
    </group>
  );
});

// IMPORTANT: Name the component for the forwardRef
Model.displayName = "Model";

export default function ModelViewer({ url, pedestalSettings, setSettings, exporterRef }) {
  if (!url) return null;
  
  return (
    <div className="w-full h-full">
      <Canvas shadows camera={{ position: [0, 2, 5], fov: 40 }}>
        {/* ... */}
        <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.2}>
              {/* Added setSettings prop here */}
              <Model 
                ref={exporterRef} 
                url={url} 
                pedestalSettings={pedestalSettings} 
                setSettings={setSettings} 
              />
            </Bounds>
        </Suspense>
        {/* ... */}
      </Canvas>
    </div>
  );
}