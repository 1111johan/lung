import { useState } from 'react';
import { Maximize2, Ruler, Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';
import type { MedicalImage, AIAnalysis } from '../lib/database.types';
import type { AnalysisFinding } from '../lib/analysisTypes';
import { filterFindings } from '../lib/analysisUtils';
import { getImageStatusStyle } from '../lib/theme';
import { DEFAULT_WINDOW_LEVEL, ZOOM_CONFIG, DATE_FORMAT } from '../lib/constants';

interface ImageViewerProps {
  image: MedicalImage | null;
  analysis: AIAnalysis | null;
}

export function ImageViewer({ image, analysis }: ImageViewerProps) {
  const [aiOverlay, setAiOverlay] = useState(true);
  const [zoom, setZoom] = useState<number>(ZOOM_CONFIG.default);

  if (!image) {
    return (
      <section className="relative bg-black flex flex-col items-center justify-center">
        <div className="text-gray-500 text-center">
          <div className="text-6xl mb-4">🖼️</div>
          <p className="text-lg">请从左侧队列选择患者</p>
          <p className="text-sm mt-2 text-gray-600">DICOM 影像查看器已就绪</p>
        </div>
      </section>
    );
  }

  const rawFindings: AnalysisFinding[] = Array.isArray(analysis?.findings)
    ? (analysis.findings as AnalysisFinding[])
    : [];
  const overlayFindings = filterFindings(rawFindings);

  return (
    <section className="relative viewer-bg flex flex-col flex-1 min-w-0">
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 viewer-toolbar px-4 py-2 flex gap-4 z-10 shadow-lg">
        <button className="viewer-tool-button p-1" title="窗宽窗位">
          <Maximize2 className="h-4 w-4" />
        </button>
        <button className="viewer-tool-button p-1" title="测量工具">
          <Ruler className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom(Math.min(zoom + ZOOM_CONFIG.step, ZOOM_CONFIG.max))}
          className="viewer-tool-button p-1"
          title="放大"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom(Math.max(zoom - ZOOM_CONFIG.step, ZOOM_CONFIG.min))}
          className="viewer-tool-button p-1"
          title="缩小"
        >
          <ZoomOut className="h-4 w-4" />
        </button>

        <div className="w-px h-4 bg-gray-600"></div>

        <button
          onClick={() => setAiOverlay(!aiOverlay)}
          className={`viewer-tool-button font-bold flex items-center gap-2 px-2 py-1 transition-all ${
            aiOverlay ? 'active' : ''
          }`}
          title={aiOverlay ? 'AI标注已开启' : 'AI标注已关闭'}
        >
          {aiOverlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <span className="text-xs">AI 标注</span>
          {aiOverlay && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div
          className="relative viewer-canvas viewer-frame shadow-2xl overflow-hidden"
          style={{
            width: '80%',
            aspectRatio: '4/3',
            transform: `scale(${zoom})`,
          }}
        >
          {image.image_url ? (
            <img
              src={image.image_url}
              alt="DICOM case"
              className="absolute inset-0 w-full h-full object-contain bg-transparent rounded-[20px]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-600 mb-4 text-8xl">🖼️</div>
                <div className="text-gray-500 text-sm font-mono">
                  {image.image_type} - {image.modality || 'PA'}
                </div>
                <div className="text-gray-600 text-xs mt-2">
                  {new Date(image.acquisition_date).toLocaleString(DATE_FORMAT.display, DATE_FORMAT.dateTime)}
                </div>
                <div className="mt-6 text-gray-700 text-xs">[ DICOM 影像渲染区域 ]</div>
              </div>
            </div>
          )}

          {aiOverlay && overlayFindings.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {overlayFindings.map((finding, idx) => (
                <div
                  key={idx}
                  className="absolute border-2 border-red-500 bg-red-500/20 rounded"
                  style={{
                    left: `${finding.x ?? 30 + idx * 10}%`,
                    top: `${finding.y ?? 20 + idx * 15}%`,
                    width: `${finding.width ?? 12}%`,
                    height: `${finding.height ?? 15}%`,
                  }}
                >
                  <div className="absolute -top-6 left-0 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                    {finding.type || '病灶'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 right-4 text-xs text-gray-500 font-mono bg-gray-900/80 px-3 py-1.5 rounded">
        <div>Zoom: {zoom.toFixed(1)}x</div>
        <div>WW/WL: {DEFAULT_WINDOW_LEVEL.width}/{DEFAULT_WINDOW_LEVEL.level}</div>
      </div>

      <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-gray-900/80 px-3 py-2 rounded space-y-1">
        <div className="font-semibold text-gray-300">{image.patient_id.slice(0, 8)}...</div>
        <div>序列: {image.series_description || 'Standard PA'}</div>
        <div>
          状态: <span className={getImageStatusStyle(image.status).color}>{getImageStatusStyle(image.status).label}</span>
        </div>
      </div>
    </section>
  );
}
