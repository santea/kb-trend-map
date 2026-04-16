import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Pause,
  Upload,
  MapPin,
  Map as MapIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import Map from './components/Map';
import { parseRealEstateExcel, ParsedRealEstateData } from './data/excelParser';
import { RegionData } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [parsedData, setParsedData] = useState<ParsedRealEstateData | null>(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  // Synchronization refs for Maps
  const mapSaleRef = useRef<any>(null);
  const mapJeonseRef = useRef<any>(null);
  const activeMap = useRef<'SALE' | 'JEONSE' | null>(null);

  const handleTransformed = (source: 'SALE' | 'JEONSE', ref: any, state: any) => {
    // Only propagate the event if this map is the one actively being interacted with
    // If activeMap is null (no prior hover), set it to source automatically
    if (activeMap.current === null) {
      activeMap.current = source;
    }
    if (activeMap.current !== source) return;

    const targetRef = source === 'SALE' ? mapJeonseRef : mapSaleRef;
    if (!targetRef.current) return;

    const { positionX, positionY, scale } = state || {};

    // Prevent passing NaN values which breaks react-zoom-pan-pinch
    if (
      typeof positionX !== 'number' || Number.isNaN(positionX) ||
      typeof positionY !== 'number' || Number.isNaN(positionY) ||
      typeof scale !== 'number' || Number.isNaN(scale)
    ) {
      return;
    }

    try {
      if (targetRef.current.instance) {
        // Bypass animations for instant exact synchronization
        targetRef.current.instance.setState(scale, positionX, positionY);
        targetRef.current.instance.applyTransformation();
      } else {
        targetRef.current.setTransform(positionX, positionY, scale, 0);
      }
    } catch (err) {
      // silent fail
    }
  };

  const saleRegionData = parsedData?.saleData || [];
  const jeonseRegionData = parsedData?.jeonseData || [];

  const weekLabels = parsedData?.labels || [];
  const WEEKS_COUNT = weekLabels.length;

  // Load default data on mount
  useEffect(() => {
    const loadDefaultData = async () => {
      try {
        const baseUrl = (import.meta as any).env.BASE_URL || '/';
        const res = await fetch(`${baseUrl}20260406_주간시계열.xlsx`);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          // Create a File object to ensure compatibility with parseRealEstateExcel
          const file = new File([buffer], "20260406_주간시계열.xlsx");
          const data = await parseRealEstateExcel(file);
          setParsedData(data);
        }
      } catch (err) {
        console.error("Failed to load default data:", err);
      }
    };

    if (!parsedData) {
      loadDefaultData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Playback logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && WEEKS_COUNT > 0) {
      interval = setInterval(() => {
        setCurrentWeek((prev) => {
          if (prev >= WEEKS_COUNT - 1) {
            return prev;
          }
          return prev + 1;
        });
      }, 500 / speedMultiplier);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speedMultiplier, WEEKS_COUNT]);

  // Handle auto-pause when reaching the end
  useEffect(() => {
    if (isPlaying && currentWeek >= WEEKS_COUNT - 1) {
      setIsPlaying(false);
    }
  }, [currentWeek, isPlaying, WEEKS_COUNT]);

  const currentWeekLabel = weekLabels[currentWeek] || '';

  const handlePlayToggle = () => {
    if (WEEKS_COUNT > 0) {
      if (!isPlaying && currentWeek >= WEEKS_COUNT - 1) {
        setCurrentWeek(0);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseRealEstateExcel(file);
      setParsedData(data);
      setCurrentWeek(0);
      setIsPlaying(false);
    } catch (error) {
      console.error(error);
      alert('엑셀 파일을 읽는 데 실패했습니다.');
    }
  };

  return (
    <div className="flex flex-col h-screen text-text-primary bg-bg-base font-inter">
      {/* Header */}
      <header className="h-[70px] bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm relative">
        <div className="flex items-center gap-2 text-brand-blue">
          <MapIcon size={24} className="stroke-[2.5px]" />
          <h1 className="text-sm font-[800] tracking-tight">kb 부동산시세 증감</h1>
        </div>

        <div className="text-md font-bold text-accent-red">{currentWeekLabel} <br></br>({WEEKS_COUNT > 0 ? currentWeek + 1 : 0}주차)</div>

        <div className="flex items-center gap-4">
          <label className="text-sm flex items-center gap-2 bg-gradient-to-r p-2 from-brand-blue text-white bg-blue-500 rounded-[12px] font-semibold cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-0.5">
            <Upload size={18} />
            <span>data upload</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </header>

      {/* Main Grid - Dual Map Layout */}
      <main className="flex-1 grid grid-cols-2 gap-2 p-2 overflow-hidden">
        {/* Left Map: Sale */}
        <section
          className="vibrant-card relative flex items-center justify-center overflow-hidden border border-gray-200"
          onMouseEnter={() => { activeMap.current = 'SALE' }}
          onTouchStart={() => { activeMap.current = 'SALE' }}
        >
          <div className="w-full h-full">
            {parsedData ? (
              <Map
                regionData={saleRegionData}
                currentWeekIndex={currentWeek}
                title="매매 증감률"
                transformRef={mapSaleRef}
                onTransformed={(ref, state) => handleTransformed('SALE', ref, state)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-secondary flex-col gap-2">
                <MapPin size={32} className="opacity-40" />
                <p className="font-semibold tracking-wide">매매 데이터 로딩 중 .....</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Map: Jeonse */}
        <section
          className="vibrant-card relative flex items-center justify-center overflow-hidden border border-gray-200"
          onMouseEnter={() => { activeMap.current = 'JEONSE' }}
          onTouchStart={() => { activeMap.current = 'JEONSE' }}
        >
          <div className="w-full h-full">
            {parsedData ? (
              <Map
                regionData={jeonseRegionData}
                currentWeekIndex={currentWeek}
                title="전세 증감률"
                transformRef={mapJeonseRef}
                onTransformed={(ref, state) => handleTransformed('JEONSE', ref, state)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-secondary flex-col gap-2">
                <MapPin size={32} className="opacity-40" />
                <p className="font-semibold tracking-wide">전세 데이터 로딩 중 ......</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Timeline Bar */}
      < section className="h-[100px] bg-card-bg mx-3 mb-5 rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex items-center px-5 gap-5" >
        <div className="vibrant-play-btn" onClick={handlePlayToggle}>
          {isPlaying ? <Pause size={20} fill="white" className="text-white" /> : <Play size={20} fill="white" className="text-white ml-1" />}
        </div>

        <div className="flex-1 relative h-1.5 bg-accent-gray rounded-full">
          <input
            type="range"
            min="0"
            max={Math.max(0, WEEKS_COUNT - 1)}
            value={currentWeek}
            onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={WEEKS_COUNT === 0}
          />
          <div
            className="absolute h-full bg-accent-red rounded-full"
            style={{ width: WEEKS_COUNT > 1 ? `${(currentWeek / (WEEKS_COUNT - 1)) * 100}%` : '0%' }}
          />
          <div
            className="vibrant-slider-handle absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
            style={{ left: WEEKS_COUNT > 1 ? `${(currentWeek / (WEEKS_COUNT - 1)) * 100}%` : '0%' }}
          />

          <div className="flex justify-between absolute w-full top-5 text-[10px] text-text-secondary">
            {WEEKS_COUNT > 0 && (
              <>
                <span>{weekLabels[0]}</span>
                {WEEKS_COUNT > 4 && <span>{weekLabels[Math.floor(WEEKS_COUNT * 0.25)]}</span>}
                {WEEKS_COUNT > 2 && <span>{weekLabels[Math.floor(WEEKS_COUNT * 0.5)]}</span>}
                {WEEKS_COUNT > 4 && <span>{weekLabels[Math.floor(WEEKS_COUNT * 0.75)]}</span>}
                <span className="text-accent-red font-bold">{weekLabels[WEEKS_COUNT - 1]}</span>
              </>
            )}
          </div>
        </div>

        <div className="w-[80px] text-right">
          <button
            onClick={() => setSpeedMultiplier(prev => prev >= 3 ? 1 : prev + 1)}
            className="text-[12px] font-semibold text-text-primary bg-white shadow-sm hover:shadow px-3 py-1.5 rounded-[8px] transition-all border border-gray-100"
          >
            재생속도: {speedMultiplier}.0x
          </button>
        </div>
      </section >
    </div >
  );
}
