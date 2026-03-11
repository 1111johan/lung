"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { speakText, stopSpeaking } from '../lib/voice';
import { askDeepseek } from '../lib/deepseek';
import { uiStyles } from '../lib/theme';
import { MessageCircle, Mic, Pause } from 'lucide-react';
import { useI18n } from '../lib/i18n';

useGLTF.preload('/models/doctor.glb');

function findMouthController(scene: THREE.Object3D) {
  let morphMesh: THREE.Mesh | null = null;
  let morphIndex: number | null = null;

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const dict = mesh.morphTargetDictionary as Record<string, number> | undefined;
    if (!dict) return;

    const names = Object.keys(dict).map((k) => k.toLowerCase());
    const hitKey =
      names.find((k) => k.includes('mouthopen')) ??
      names.find((k) => k.includes('jawopen')) ??
      names.find((k) => k.includes('viseme')) ??
      names.find((k) => k.includes('mouth'));

    if (hitKey && morphIndex === null) {
      const originalKey = Object.keys(dict).find(
        (k) => k.toLowerCase() === hitKey
      );
      if (originalKey) {
        morphMesh = mesh;
        morphIndex = dict[originalKey];
      }
    }
  });

  let jawBone: THREE.Bone | null = null;
  scene.traverse((obj) => {
    const sk = obj as THREE.SkinnedMesh;
    if (!sk.isSkinnedMesh) return;
    const bones = sk.skeleton?.bones ?? [];
    const hit = bones.find((b) => b.name.toLowerCase().includes('jaw'));
    if (hit && !jawBone) jawBone = hit;
  });

  return { morphMesh, morphIndex, jawBone };
}

export function DoctorModel({ speaking }: { speaking: boolean }) {
  const gltf = useGLTF('/models/doctor.glb') as { scene: THREE.Group };
  const group = useRef<THREE.Group>(null);

  const { morphMesh, morphIndex, jawBone } = useMemo(
    () => findMouthController(gltf.scene),
    [gltf.scene]
  );

  const [mouth, setMouth] = useState(0);

  useEffect(() => {
    window.__setMouth = (v: number) => setMouth(Math.min(1, Math.max(0, v)));
    return () => {
      delete window.__setMouth;
    };
  }, []);

  useFrame((state) => {
    if (group.current) {
      group.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.01;
      const targetNod = speaking ? 0.08 : 0.0;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        targetNod,
        0.08
      );
    }

    if (morphMesh && morphIndex !== null) {
      const influences = (morphMesh as THREE.Mesh & { morphTargetInfluences?: number[] }).morphTargetInfluences;
      if (Array.isArray(influences)) {
        influences[morphIndex] = THREE.MathUtils.lerp(
          influences[morphIndex] ?? 0,
          mouth,
          0.35
        );
      }
    }

    if (jawBone) {
      const target = -0.35 * mouth;
      (jawBone as THREE.Bone).rotation.x = THREE.MathUtils.lerp(
        (jawBone as THREE.Bone).rotation.x,
        target,
        0.35
      );
    }
  });

  return (
    <group ref={group} position={[0, -1.2, 0]} scale={1.2}>
      <primitive object={gltf.scene} />
    </group>
  );
}

export function DigitalHumanQA() {
  const { locale, tr } = useI18n();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(tr('你好，我是数字人迎宾医生，准备为你解答。'));
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setAnswer('');
    try {
      const reply = await askDeepseek(q, undefined, locale);
      setAnswer(reply);
      speakText(
        reply,
        locale,
        () => setSpeaking(true),
        () => {
          setSpeaking(false);
        }
      );
    } catch {
      setAnswer(tr('当前问答服务暂不可用，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4 h-[calc(100vh-64px)] p-4 bg-gray-900 text-gray-100">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <MessageCircle className="h-4 w-4 text-teal-400" />
          {tr('数字人问答')}
          <span className="text-xs text-gray-500">
            {tr('（模型无嘴部控制器，使用点头/呼吸表示说话）')}
          </span>
        </div>

        <div className={uiStyles.card.default + ' space-y-2'}>
          <textarea
            className={uiStyles.input.textarea + ' min-h-[120px]'}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={tr('请描述你的问题或症状...')}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAsk}
              disabled={loading}
              className={
                uiStyles.button.primary +
                ' flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
              }
            >
              <Mic className="h-4 w-4" />
              {tr('提问并朗读')}
            </button>
            <button
              onClick={() => {
                stopSpeaking();
                setSpeaking(false);
              }}
              className={uiStyles.button.secondary + ' flex items-center gap-2'}
            >
              <Pause className="h-4 w-4" />
              {tr('停止语音')}
            </button>
          </div>
        </div>

        <div className={uiStyles.card.default + ' flex-1 space-y-2'}>
          <div className="text-xs text-gray-400">{tr('回答')}</div>
          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed">
            {loading ? tr('正在生成...') : answer || tr('暂无回答')}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <DigitalHumanAvatar speaking={speaking} />
        <div className="text-xs text-gray-500">
          {tr('状态：')}{speaking ? tr('正在朗读') : tr('待机')}
        </div>
        <div className="text-[11px] text-gray-500 text-center">
          {tr('提示：本模型无口型控制，已用点头 + 呼吸模拟“说话”。')}
        </div>
      </div>
    </div>
  );
}

export function DigitalHumanAvatar({ speaking }: { speaking: boolean }) {
  const { tr } = useI18n();
  return (
    <div className="w-full bg-gray-800 border border-gray-700 rounded-lg">
      <Suspense
        fallback={
          <div className="h-[520px] flex items-center justify-center text-gray-400">
            {tr('模型加载中...')}
          </div>
        }
      >
        <div className="w-full flex justify-center py-2">
          <div
            className="rounded-lg overflow-hidden border border-gray-700"
            style={{ width: 400, height: 540 }}
          >
            <Canvas camera={{ position: [0, 0.6, 3.2], fov: 35 }}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[3, 5, 2]} intensity={1.0} />
              <directionalLight position={[-3, 2, 2]} intensity={0.5} />
              <DoctorModel speaking={speaking} />
              <OrbitControls enablePan={false} target={[0, 0.3, 0]} />
            </Canvas>
          </div>
        </div>
      </Suspense>
    </div>
  );
}
