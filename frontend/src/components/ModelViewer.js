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
    // 1. Calculate the model's boundaries
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // 2. AUTO-SCALE: Make the model roughly 80% of the pedestal's width
    // pedestalSettings.width is in mm (e.g., 60), Three.js units are /10 (e.g., 6.0)
    const targetSize = (pedestalSettings.width / 10) * 0.8; 
    const currentMaxDimension = Math.max(size.x, size.y, size.z);
    const autoScale = targetSize / currentMaxDimension;
    
    // 3. AUTO-POSITION: Center the model and place its bottom at Y=0
    // This makes the 'primitive' pivot point its actual feet
    scene.position.x = -center.x * autoScale;
    scene.position.y = -box.min.y * autoScale; // Forces bottom to 0
    scene.position.z = -center.z * autoScale;
    scene.scale.setScalar(autoScale);

    // 4. Update the settings so the sliders reflect this auto-calculation
    // This prevents the "confused user" because the scale slider will move to the right spot
    setSettings(prev => ({
      ...prev,
      scale: autoScale * 10, // Adjusting back to your slider's expected scale range
      offset: (pedestalSettings.height / 2) // Lift it by half the pedestal height to sit on top
    }));

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