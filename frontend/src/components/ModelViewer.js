"use client";
import { Suspense, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
// FIXED: Proper imports from drei
import { OrbitControls, Stage, useGLTF, RoundedBox, Text, Center } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

const Model = forwardRef(({ url, pedestalSettings, setSettings }, ref) => {
  const { scene } = useGLTF(url);
  const pedestalMeshRef = useRef();
  const hasAutoScaled = useRef(false);

  useEffect(() => {
    if (scene && !hasAutoScaled.current) {
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const targetSize = (pedestalSettings.width / 10) * 0.7; 
      const currentMax = Math.max(size.x, size.y, size.z);
      const calculatedScale = targetSize / currentMax;
      
      scene.position.x = -center.x * calculatedScale;
      scene.position.y = -box.min.y * calculatedScale; 
      scene.position.z = -center.z * calculatedScale;
      scene.scale.setScalar(calculatedScale);

      if (setSettings) {
        setTimeout(() => {
          setSettings(prev => ({
            ...prev,
            scale: calculatedScale,
            offset: pedestalSettings.height
          }));
        }, 50);
      }
      hasAutoScaled.current = true;
    }
  }, [scene, url, pedestalSettings.width, pedestalSettings.height, setSettings]);

  useImperativeHandle(ref, () => ({
    exportSTL: () => {
      const exporter = new STLExporter();
      const allVertices = [];
      const extract = (mesh, matrix) => {
        const geom = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        const pos = geom.attributes.position;
        mesh.updateMatrixWorld(true);
        const finalM = new THREE.Matrix4().multiplyMatrices(matrix, mesh.matrixWorld);
        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(finalM);
          allVertices.push(v.x * 10, v.z * 10, v.y * 10);
        }
      };
      const modelM = new THREE.Matrix4().makeScale(pedestalSettings.scale, pedestalSettings.scale, pedestalSettings.scale);
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

  return (
    <group>
      <group position={[0, pedestalSettings.offset / 10, (pedestalSettings.modelZOffset / 10) || 0]}>
          <primitive object={scene} scale={pedestalSettings.scale} />
      </group>

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
        // Headline (Line 1) - Bold/Script feel
<Text 
  position={[0, h / 2 + 0.02, d / 4 - 0.1]} // Positioned slightly higher
  rotation={[-Math.PI / 2, 0, 0]}
  fontSize={0.25} 
  font="https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff"
  color="#1e293b"
  anchorX="center"
>
  {pedestalSettings.textLine1}
</Text>

// Signature (Line 2) - Clean/Smaller
<Text 
  position={[0, h / 2 + 0.02, d / 4 + 0.2]} // Positioned below line 1
  rotation={[-Math.PI / 2, 0, 0]}
  fontSize={0.15}
font="https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff" 
  color="#475569"
  anchorX="center"
>
  {pedestalSettings.textLine2}
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
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.6} contactShadow={true} adjustCamera={false}>
            <Model 
              ref={exporterRef} 
              url={url} 
              pedestalSettings={pedestalSettings} 
              setSettings={setSettings} 
            />
          </Stage>
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}