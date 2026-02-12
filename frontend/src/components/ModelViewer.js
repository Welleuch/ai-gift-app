"use client";
import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Text, RoundedBox, Bounds, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

const Model = forwardRef(({ url, pedestalSettings, setSettings }, ref) => {
  const { scene } = useGLTF(url);
  const pedestalMeshRef = useRef();
  const hasAutoScaled = useRef(false);

  useEffect(() => {
    // Only auto-scale when the scene exists and we haven't done it for this specific URL
    if (scene && !hasAutoScaled.current) {
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const targetSize = (pedestalSettings.width / 10) * 0.7; 
      const currentMax = Math.max(size.x, size.y, size.z);
      const calculatedScale = targetSize / currentMax;
      
      // Ground the model
      scene.position.x = -center.x * calculatedScale;
      scene.position.y = -box.min.y * calculatedScale; 
      scene.position.z = -center.z * calculatedScale;
      scene.scale.setScalar(calculatedScale);

      // Use a safe update to move sliders without crashing
      setTimeout(() => {
        if (setSettings) {
          setSettings(prev => ({
            ...prev,
            scale: calculatedScale, 
            offset: pedestalSettings.height // Put it on top
          }));
        }
      }, 10);

      hasAutoScaled.current = true;
    }
  }, [scene, url, pedestalSettings.width, setSettings]);

  // Reset the lock if the model changes
  useEffect(() => {
    hasAutoScaled.current = false;
  }, [url]);

  useImperativeHandle(ref, () => ({
    exportSTL: () => {
      const exporter = new STLExporter();
      const allVertices = [];
      const h = pedestalSettings.height / 10;
      const d = pedestalSettings.depth / 10;

      const extract = (mesh, matrix) => {
        const geom = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        const pos = geom.attributes.position;
        mesh.updateMatrixWorld(true);
        const finalM = new THREE.Matrix4().multiplyMatrices(matrix, mesh.matrixWorld);
        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(finalM);
          // Export: Y is UP in Three.js, but Z is UP in STL
          allVertices.push(v.x * 10, v.z * 10, (v.y * 10));
        }
      };

      const modelM = new THREE.Matrix4().makeScale(pedestalSettings.scale, pedestalSettings.scale, pedestalSettings.scale);
      // This matches the visual position
      modelM.setPosition(0, (pedestalSettings.offset / 10), (pedestalSettings.modelZOffset / 10) || 0);

      scene.traverse(c => { if (c.isMesh) extract(c, modelM); });
      if (pedestalMeshRef.current) extract(pedestalMeshRef.current, new THREE.Matrix4());

      const unified = new THREE.BufferGeometry();
      unified.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
      return exporter.parse(new THREE.Mesh(unified), { binary: true });
    }
  }));

  const h = pedestalSettings.height / 10;
  const w = pedestalSettings.width / 10;
  const d = pedestalSettings.depth / 10;
  const modelZ = (pedestalSettings.modelZOffset / 10) || 0;
  const modelY = (pedestalSettings.offset / 10) || 0;

  return (
    <group>
      {/* Character Group - Moved by 'offset' (Y) and 'modelZOffset' (Z) */}
      <group position={[0, modelY, modelZ]}>
          <primitive object={scene} scale={pedestalSettings.scale} />
      </group>

      {/* Pedestal - Bottom is at 0 */}
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
        
        <Text 
          position={[0, h / 2 + 0.02, d / 4]} 
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.2} 
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

Model.displayName = "Model";

export default function ModelViewer({ url, pedestalSettings, setSettings, exporterRef }) {
  if (!url) return null;
  
  return (
    <div className="w-full h-full" style={{ touchAction: 'none' }}>
      <Canvas shadows camera={{ position: [5, 5, 5], fov: 35 }}>
        <color attach="background" args={['#f8fafc']} />
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Suspense fallback={null}>
            <Model 
              ref={exporterRef} 
              url={url} 
              pedestalSettings={pedestalSettings} 
              setSettings={setSettings} 
            />
            <ContactShadows opacity={0.4} scale={20} blur={2} far={4.5} />
        </Suspense>
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}