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
      const exporter = new STLExporter();
      const exportGroup = new THREE.Group();
      
      const modelMatrix = new THREE.Matrix4().makeScale(pedestalSettings.scale, pedestalSettings.scale, pedestalSettings.scale);
      modelMatrix.setPosition(0, pedestalSettings.offset / 10, 0);

      scene.traverse((child) => {
        if (child.isMesh) {
          const geom = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
          const mesh = new THREE.Mesh(geom);
          const finalMatrix = new THREE.Matrix4().multiplyMatrices(modelMatrix, child.matrixWorld);
          mesh.applyMatrix4(finalMatrix);
          exportGroup.add(mesh);
        }
      });

      if (pedestalMeshRef.current) {
        const pClone = pedestalMeshRef.current.clone();
        pClone.position.y = -(pedestalSettings.height / 10) / 2;
        pClone.updateMatrixWorld(true);
        exportGroup.add(pClone);
      }

      return exporter.parse(exportGroup, { binary: true });
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