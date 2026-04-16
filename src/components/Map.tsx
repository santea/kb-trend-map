import React, { useMemo, useEffect, useState } from 'react';
import { interpolateRgb } from 'd3-interpolate';
import { scaleLinear } from 'd3-scale';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { RegionData } from '../types';
import { motion } from 'motion/react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface MapProps {
  regionData: RegionData[];
  currentWeekIndex: number;
  title?: string;
  transformRef?: React.Ref<any>;
  onTransformed?: (ref: any, state: any) => void;
}

// Color scale: Blue (-2% or less) -> White (0%) -> Red (+2% or more)
const colorScale = scaleLinear<string>()
  .domain([-2, 0, 2])
  .range(['#3333ff', '#ffffff', '#ff3333'])
  .interpolate(interpolateRgb);

const geoIdMap: Record<string, string> = {}; // We will rely mostly on exact Korean name matching for districts

export default function Map({ regionData, currentWeekIndex, title, transformRef, onTransformed }: MapProps) {
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    const loadMap = async () => {
      const sources = [
        {
          url: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_topo_simple.json',
          type: 'topojson',
          objectKey: 'skorea_municipalities_geo'
        },
        {
          url: 'https://cdn.jsdelivr.net/gh/southkorea/southkorea-maps@master/kostat/2013/json/skorea_municipalities_topo_simple.json',
          type: 'topojson',
          objectKey: 'skorea_municipalities_geo'
        }
      ];

      for (const source of sources) {
        try {
          const res = await fetch(source.url);
          if (!res.ok) continue;

          const text = await res.text();
          // Basic check to ensure it's not an HTML error page
          if (text.trim().startsWith('<!DOCTYPE html>')) continue;

          const data = JSON.parse(text);

          if (source.type === 'topojson') {
            const provinces = feature(data, data.objects[source.objectKey!] as any);
            setGeoData(provinces);
          } else {
            setGeoData(data);
          }
          console.log(`Successfully loaded map from ${source.url}`);
          return; // Success!
        } catch (e) {
          console.error(`Failed to load map from ${source.url}:`, e);
        }
      }

      console.error('All map data sources failed to load.');
    };

    loadMap();
  }, []);

  const projection = useMemo(() => {
    const proj = geoMercator();
    if (geoData) {
      proj.fitSize([800, 1200], geoData);
    }
    return proj;
  }, [geoData]);

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

  const regionColors = useMemo(() => {
    const colors: Record<string, string> = {};
    regionData.forEach((region) => {
      const change = region.weeklyChanges[currentWeekIndex] || 0;
      colors[region.id] = colorScale(change);
    });
    return colors;
  }, [regionData, currentWeekIndex]);

  if (!geoData) {
    return (
      <div className="flex items-center justify-center w-full h-full text-text-secondary">
        지도 데이터를 불러오는 중...
      </div>
    );
  }

  // A utility function to map TopoJSON region name to Excel region name
  const findRegionColor = (featureData: any) => {
    const props = featureData.properties;
    const nameKo = props.name || props.NAME_KO || props.name_kor || props.name_local || '';

    // 1. First try exact match
    let regionObj = regionData.find(r => r.name === nameKo || r.id === nameKo);

    // 2. If exact match fails, find suffix match (뒷부분만 일치하는 경우)
    // e.g. Map:"성남시수정구" <-> Excel:"수정구" (Matches!)
    // e.g. Map:"성남시수정구" <-> Excel:"성남시" (Does NOT match, because it is at the front)
    if (!regionObj) {
      regionObj = regionData.find(r => r.name && nameKo.endsWith(r.name));
    }

    if (regionObj) {
      return regionColors[regionObj.id] || '#f5f5f5';
    }
    return '#f5f5f5';
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div className="absolute top-4 left-4 z-20 pointer-events-none">
        {title && <h2 className="text-xl font-bold bg-white/90 px-4 py-2 rounded-lg shadow-sm text-text-primary border border-gray-100">{title}</h2>}
      </div>

      <TransformWrapper
        ref={transformRef}
        onTransformed={(ref) => { onTransformed?.(ref, ref?.state); }}
        onPanning={(ref) => { onTransformed?.(ref, ref?.state); }}
        onZoom={(ref) => { onTransformed?.(ref, ref?.state); }}
        onWheel={(ref) => { onTransformed?.(ref, ref?.state); }}
        initialScale={1}
        minScale={0.5}
        maxScale={8}
        centerOnInit={true}
        wheel={{ step: 0.03 }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute top-2 right-2 flex flex-col gap-2 z-10">
              <button onClick={() => zoomIn()} className="p-2 bg-white rounded shadow hover:bg-gray-50 text-text-primary">
                <ZoomIn size={16} />
              </button>
              <button onClick={() => zoomOut()} className="p-2 bg-white rounded shadow hover:bg-gray-50 text-text-primary">
                <ZoomOut size={16} />
              </button>
              <button onClick={() => resetTransform()} className="p-2 bg-white rounded shadow hover:bg-gray-50 text-text-primary">
                <Maximize size={16} />
              </button>
            </div>

            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg
                viewBox="0 0 800 1200"
                className="w-full h-full drop-shadow-xl"
                preserveAspectRatio="xMidYMid meet"
                style={{ width: '100%', height: '100%' }}
              >
                <g>
                  {geoData.features.map((feature: any, i: number) => {
                    const props = feature.properties;
                    const nameKo = props.name || props.name_local || props.name_kor || '';
                    const color = findRegionColor(feature);

                    return (
                      <g key={i}>
                        <motion.path
                          d={pathGenerator(feature) || ''}
                          fill={color}
                          stroke="#a9b4b9"
                          strokeWidth="0.2"
                          className="cursor-pointer hover:stroke-accent-red transition-colors"
                          initial={false}
                          animate={{ fill: color }}
                          transition={{ duration: 0.4 }}
                        >
                          <title>{nameKo}</title>
                        </motion.path>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
};
