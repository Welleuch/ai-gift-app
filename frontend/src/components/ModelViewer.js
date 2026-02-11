"use client";
import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Center, Text, RoundedBox, Bounds, useBounds } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

const Model = forwardRef(({ url, pedestalSettings }, ref) => {
  const { scene } = useGLTF(url);
  const pedestalMeshRef = useRef();
  const [modelError, setModelError] = useState(false);

  // Add error handling for GLB loading
  useEffect(() => {
    if (scene) {
      console.log('Model loaded successfully');
      
      // Center and scale the model for better viewing
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      const maxSize = Math.max(size.x, size.y, size.z);
      const scale = 1.5 / maxSize;
      
      scene.position.x = -center.x * scale;
      scene.position.y = -center.y * scale;
      scene.position.z = -center.z * scale;
      scene.scale.setScalar(scale);
      
      // Make sure all materials are visible
      scene.traverse((child) => {
        if (child.isMesh) {
          if (!child.material) {
            child.material = new THREE.MeshStandardMaterial({ color: '#cbd5e1' });
          }
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
            const physicalY = v.y * 10; // This is Three.js height
            const physicalZ = v.z * 10;

            // Note: STL uses X, Y, Z. In Three.js, Y is UP. In Slicers, Z is UP.
            // So we map Three.js Y to STL Z.
            allVertices.push(physicalX, physicalZ, physicalY + (pedestalSettings.height / 2));
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
      {/* 1. CHARACTER POSITIONING */}
      {/* We push the group back along the Z-axis by 1/4 of the depth */}
      <group position={[0, yOffset, -d / 4]}>
        <Center bottom>
          <primitive 
            object={scene} 
            scale={pedestalSettings.scale} 
            onError={() => setModelError(true)}
          />
        </Center>
      </group>

      {/* 2. PEDESTAL POSITIONING */}
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

        {/* 3. TEXT ON TOP SURFACE */}
        <Text 
          // Positioned on the TOP surface (h/2)
          // Pushed FORWARD (d/4) to the empty space
          position={[0, h / 2 + 0.01, d / 4]} 
          // Rotated -90 degrees on X axis to lay flat
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={w * 0.1} // Scaling font relative to width
          color="#1e293b"
          anchorX="center"
          anchorY="middle"
          maxWidth={w * 0.8}
        >
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
        <color attach="background" args={['#f8fafc']} />
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5} adjustCamera={false}>
            <Bounds fit clip observe margin={1.2}>
              <Model ref={exporterRef} url={url} pedestalSettings={pedestalSettings} />
            </Bounds>
          </Stage>
        </Suspense>
        <OrbitControls 
          makeDefault 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 1.5}
          minDistance={1}
          maxDistance={10}
        />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <gridHelper args={[10, 10]} position={[0, -pedestalSettings.height/20, 0]} />
      </Canvas>
    </div>
  );
}