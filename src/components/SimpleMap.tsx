import React, { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import { Feature } from "ol";
import { WKT } from "ol/format";
import { Style, Fill, Stroke, Circle, Text, Icon } from "ol/style";
import Draw from "ol/interaction/Draw";
import Modify from "ol/interaction/Modify";
import Translate from "ol/interaction/Translate";
import Select from "ol/interaction/Select";
import Overlay from "ol/Overlay";
import { click } from "ol/events/condition";
import { toast } from 'react-toastify';
import "ol/ol.css";

interface SimpleMapProps {
  geometries?: Array<{
    id?: string | number;
    wkt: string;
    name?: string;
    type?: string;
    area?: number;
    length?: number;
    centroid?: string | object;
    boundingBox?: string | object;
    startPoint?: string | object;
    endPoint?: string | object;
  }>;
  geometryType?: string;
  onDrawEnd?: (wkt: string) => void;
  onDeleteGeometry?: (id: number) => void;
  onUpdateGeometry?: (geometry: any) => void;
  onMoveGeometry?: (id: number, newWkt: string) => void;
  zoomToGeometry?: { wkt: string, name: string } | null;
}

// Pin/marker stillerini oluştur - basit cache ile optimize edildi
const styleCache: { [key: string]: Style } = {};

const createFeatureStyle = (feature: Feature, geometryType: string, isHighlighted: boolean = false) => {
  // Cache key oluştur
  const cacheKey = `${geometryType}-${isHighlighted}-${feature.get('name') || ''}`;
  
  // Cache'den kontrol et
  if (styleCache[cacheKey]) {
    return styleCache[cacheKey];
  }
  
  const fillColor = getColorByType(geometryType);
  const strokeColor = darkenColor(fillColor);
  
  let style: Style;
  
  if (geometryType === 'Point') {
    // Pin ikonunu kullan
    style = new Style({
      image: new Icon({
        src: '/pin.png',
        scale: 0.03,
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction'
      }),
      text: new Text({
        text: feature.get('name') || '',
        offsetY: -10,
        fill: new Fill({ color: isHighlighted ? '#ff0000' : '#000' }),
        stroke: new Stroke({ 
          color: isHighlighted ? '#ffff00' : '#fff', 
          width: isHighlighted ? 2 : 1 
        }),
        font: isHighlighted ? 'bold 11px Arial' : '10px Arial'
      })
    });
  } else if (geometryType === 'LineString') {
    style = new Style({
      stroke: new Stroke({
        color: strokeColor,
        width: 3
      })
    });
  } else if (geometryType === 'Polygon') {
    style = new Style({
      fill: new Fill({ 
        color: fillColor + '40'
      }),
      stroke: new Stroke({ 
        color: strokeColor, 
        width: 2
      })
    });
  } else {
    // Varsayılan stil
    style = new Style({
      image: new Circle({
        radius: 6,
        fill: new Fill({ color: '#ff0000' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 })
      })
    });
  }
  
  // Cache'e ekle (max 50 stil tutmak için)
  const cacheKeys = Object.keys(styleCache);
  if (cacheKeys.length > 50) {
    delete styleCache[cacheKeys[0]];
  }
  styleCache[cacheKey] = style;
  
  return style;
};

// Geometri tipine göre renk
const getColorByType = (type: string): string => {
  switch (type) {
    case 'Point': return '#e74c3c';
    case 'LineString': return '#3498db';
    case 'Polygon': return '#2ecc71';
    default: return '#f39c12';
  }
};

// Rengi koyulaştır
const darkenColor = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    '#e74c3c': '#c0392b',
    '#3498db': '#2980b9',
    '#2ecc71': '#27ae60',
    '#f39c12': '#e67e22'
  };
  return colorMap[color] || color;
};

// Obje/string değerlerini güzel formatta göster
const formatValue = (value: string | object | undefined): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // Eğer koordinat objesi ise daha güzel göster
    if ('type' in value && 'coordinates' in value) {
      const coords = (value as any).coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        return `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
      }
    }
    return JSON.stringify(value).replace(/"/g, '').replace(/[{}]/g, '');
  }
  return String(value);
};

const SimpleMap: React.FC<SimpleMapProps> = ({ 
  geometries = [], 
  geometryType = "", 
  onDrawEnd,
  onDeleteGeometry,
  onUpdateGeometry,
  onMoveGeometry,
  zoomToGeometry
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);
  const modifyInteractionRef = useRef<Modify | null>(null);
  const translateInteractionRef = useRef<Translate | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupOverlayRef = useRef<Overlay | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [popupContent, setPopupContent] = useState<{ 
    id?: string | number;
    name: string; 
    type: string; 
    wkt: string;
    area?: number;
    length?: number;
    centroid?: string | object;
    boundingBox?: string | object;
    startPoint?: string | object;
    endPoint?: string | object;
  } | null>(null);

  useEffect(() => {
    console.log('🚀 SimpleMap starting...', { geometriesCount: geometries.length });
    
    if (mapRef.current && !mapInstance.current) {
      console.log('🗺️ Creating map...');
      
      try {
        // Vector layer for geometries
        const vectorSource = new VectorSource();
        vectorSourceRef.current = vectorSource;
        
        const vectorLayer = new VectorLayer({
          source: vectorSource,
          style: (feature: any) => {
            const featureType = feature.get('type') || 'Point';
            const isHighlighted = feature.get('highlighted') || false;
            return createFeatureStyle(feature as Feature, featureType, isHighlighted);
          }
        });

        mapInstance.current = new Map({
          target: mapRef.current,
          layers: [
            new TileLayer({
              source: new OSM()
            }),
            vectorLayer
          ],
          view: new View({
            center: [3924862.6, 4865942.2], // Turkey center
            zoom: 6
          })
        });
        
        // Popup overlay oluştur
        if (popupRef.current) {
          popupOverlayRef.current = new Overlay({
            element: popupRef.current,
            autoPan: false, // Harita hareket etmesin
            offset: [0, -15]
          });
          mapInstance.current.addOverlay(popupOverlayRef.current);
          console.log('✅ Popup overlay eklendi');
        }
        
        console.log('✅ Map created successfully!');
        
        // Select interaction for drag operations
        const selectInteraction = new Select({
          condition: click,
          style: (feature) => {
            // Seçili geometriler için özel stil
            const geometryType = feature.get('type') || 'Point';
            
            if (geometryType === 'Point') {
              return new Style({
                image: new Icon({
                  src: '/pin.png',
                  scale: 0.04, // Biraz daha büyük
                  anchor: [0.5, 1],
                  anchorXUnits: 'fraction',
                  anchorYUnits: 'fraction'
                }),
                text: new Text({
                  text: feature.get('name') || '',
                  offsetY: -15,
                  fill: new Fill({ color: '#ff0000' }), // Kırmızı text
                  stroke: new Stroke({ color: '#ffffff', width: 2 }),
                  font: 'bold 12px Arial'
                })
              });
            } else if (geometryType === 'LineString') {
              return new Style({
                stroke: new Stroke({
                  color: '#ff0000', // Seçili çizgiler kırmızı
                  width: 4
                })
              });
            } else if (geometryType === 'Polygon') {
              return new Style({
                fill: new Fill({ 
                  color: '#ff000060' // Seçili alanlar kırmızı transparan
                }),
                stroke: new Stroke({ 
                  color: '#ff0000', // Seçili kenarlar kırmızı
                  width: 3
                })
              });
            }
            
            return []; // Boş array döndür
          }
        });
        selectInteractionRef.current = selectInteraction;
        mapInstance.current.addInteraction(selectInteraction);
        
        // Modify interaction for vertex editing (for detailed editing)
        const modifyInteraction = new Modify({
          features: selectInteraction.getFeatures()
        });
        modifyInteractionRef.current = modifyInteraction;
        mapInstance.current.addInteraction(modifyInteraction);
        
        // Translate interaction for moving entire geometries
        const translateInteraction = new Translate({
          features: selectInteraction.getFeatures()
        });
        translateInteractionRef.current = translateInteraction;
        mapInstance.current.addInteraction(translateInteraction);
        
        // Translate start event (şekil hareket etmeye başladı)
        translateInteraction.on('translatestart', () => {
          console.log('🖐️ Geometri taşıma başladı (Translate)');
          setIsDragging(true);
          
          // Harita container'ına drag class'ı ekle
          if (mapRef.current) {
            mapRef.current.style.cursor = 'grabbing';
          }
          
          // Popup'ı kapat
          if (popupOverlayRef.current) {
            popupOverlayRef.current.setPosition(undefined);
            setPopupContent(null);
          }
        });
        
        // Translate end event - Şekil hareket etti, WKT güncelleme
        translateInteraction.on('translateend', (evt) => {
          console.log('✋ Geometri taşıma tamamlandı (Translate)');
          setIsDragging(false);
          
          // Cursor'ı normal yap
          if (mapRef.current) {
            mapRef.current.style.cursor = '';
          }
          
          const features = evt.features;
          features.forEach((feature) => {
            const id = feature.get('id');
            const geometryType = feature.get('type');
            
            if (id && onMoveGeometry) {
              // Yeni WKT'yi al
              const wktFormat = new WKT();
              const newWkt = wktFormat.writeFeature(feature, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
              });
              
              console.log('� Geometri şekil olarak taşındı:', {
                id: id,
                name: feature.get('name'),
                type: geometryType,
                oldWkt: feature.get('wkt')?.substring(0, 50) + '...',
                newWkt: newWkt.substring(0, 50) + '...'
              });
              
              // WKT'yi feature'da güncelle
              feature.set('wkt', newWkt);
              
              // Parent component'e bildir
              onMoveGeometry(id as number, newWkt);
            }
          });
        });
        
        // Modify events (vertex düzenleme için)
        modifyInteraction.on('modifystart', () => {
          console.log('✏️ Vertex düzenleme başladı');
          setIsDragging(true);
          
          if (mapRef.current) {
            mapRef.current.style.cursor = 'crosshair';
          }
          
          if (popupOverlayRef.current) {
            popupOverlayRef.current.setPosition(undefined);
            setPopupContent(null);
          }
        });
        
        modifyInteraction.on('modifyend', (evt) => {
          console.log('✅ Vertex düzenleme tamamlandı');
          setIsDragging(false);
          
          if (mapRef.current) {
            mapRef.current.style.cursor = '';
          }
          
          const features = evt.features;
          features.forEach((feature) => {
            const id = feature.get('id');
            if (id && onMoveGeometry) {
              const wktFormat = new WKT();
              const newWkt = wktFormat.writeFeature(feature, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
              });
              
              console.log('🔄 Geometri vertex düzenlendi:', {
                id: id,
                name: feature.get('name'),
                newWkt: newWkt.substring(0, 50) + '...'
              });
              
              feature.set('wkt', newWkt);
              onMoveGeometry(id as number, newWkt);
            }
          });
        });
        
        console.log('✅ Drag interactions eklendi (Translate + Modify)');
        
        // Add geometries if any
        if (geometries.length > 0) {
          console.log(`📍 Adding ${geometries.length} geometries to map...`);
          const wktFormat = new WKT();
          
          geometries.forEach((geometry, index) => {
            try {
              const feature = wktFormat.readFeature(geometry.wkt, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
              });
              feature.set('name', geometry.name || `Geometry ${index + 1}`);
              feature.set('type', geometry.type || 'Point');
              feature.set('id', geometry.id);
              feature.set('wkt', geometry.wkt); // WKT'yi de kaydet
              feature.set('highlighted', (geometry as any).highlighted || false); // Highlighted özelliğini ekle
              vectorSource.addFeature(feature);
              console.log(`✅ Added geometry ${index + 1}: ${geometry.name || 'No name'} (${geometry.type}) - Highlighted: ${(geometry as any).highlighted || false}`);
            } catch (error) {
              console.warn(`❌ Error adding geometry ${index + 1}:`, error);
            }
          });
          
          console.log(`✅ Added ${vectorSource.getFeatures().length} geometries successfully`);
        }
        
        // Tek seferlik yükleme kontrolü
        let renderCount = 0;
        mapInstance.current.on('rendercomplete', () => {
          renderCount++;
          if (renderCount <= 3) {
            console.log(`🎨 Render complete! (${renderCount}/3)`);
          }
        });
        
        // Mouse hover popup events - MapView'deki tam sistem
        mapInstance.current.on('pointermove', (evt) => {
          const feature = mapInstance.current!.forEachFeatureAtPixel(evt.pixel, (feat) => feat);
          
          // Önceki timeout'u temizle
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          
          // Hover işlemini yap
          hoverTimeoutRef.current = window.setTimeout(() => {
            if (feature && popupOverlayRef.current) {
              const name = feature.get('name') || 'İsimsiz';
              const type = feature.get('type') || 'Bilinmeyen';
              const coordinates = evt.coordinate;
              
              // Geometri verilerini bul
              const geometryData = geometries.find(g => g.name === name && g.type === type);
              
              console.log('👆 Mouse over feature:', { name, type });
              
              setPopupContent({
                id: feature.get('id') || geometryData?.id,
                name: name,
                type: type,
                wkt: feature.get('wkt') || 'WKT bilgisi yok',
                area: geometryData?.area,
                length: geometryData?.length,
                centroid: geometryData?.centroid,
                boundingBox: geometryData?.boundingBox,
                startPoint: geometryData?.startPoint,
                endPoint: geometryData?.endPoint
              });
              
              popupOverlayRef.current.setPosition(coordinates);
            } else if (popupOverlayRef.current) {
              popupOverlayRef.current.setPosition(undefined);
              setPopupContent(null);
            }
          }, 300);
        });
        
      } catch (error) {
        console.error('❌ Map creation failed:', error);
      }
    }
    
    return () => {
      // Timeout'ları temizle
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      // Interaction'ları temizle
      if (mapInstance.current) {
        if (drawInteractionRef.current) {
          mapInstance.current.removeInteraction(drawInteractionRef.current);
          drawInteractionRef.current = null;
        }
        if (selectInteractionRef.current) {
          mapInstance.current.removeInteraction(selectInteractionRef.current);
          selectInteractionRef.current = null;
        }
        if (modifyInteractionRef.current) {
          mapInstance.current.removeInteraction(modifyInteractionRef.current);
          modifyInteractionRef.current = null;
        }
        if (translateInteractionRef.current) {
          mapInstance.current.removeInteraction(translateInteractionRef.current);
          translateInteractionRef.current = null;
        }
        
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
        console.log('🧹 Map and all interactions cleaned up');
      }
    };
  }, [geometries]);

  // Çizim modu için ayrı useEffect
  useEffect(() => {
    if (!mapInstance.current || !vectorSourceRef.current) return;

    console.log('🖊️ Draw mode changing:', { geometryType, hasMap: !!mapInstance.current });

    // Önceki draw interaction'ını kaldır
    if (drawInteractionRef.current) {
      mapInstance.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
      console.log('🗑️ Previous draw interaction removed');
    }

    // Eğer geometryType varsa yeni draw interaction ekle
    if (geometryType && geometryType !== '') {
      console.log(`✏️ Adding draw interaction for: ${geometryType}`);
      
      let olGeometryType = geometryType;
      if (geometryType === 'Point') olGeometryType = 'Point';
      else if (geometryType === 'LineString') olGeometryType = 'LineString';  
      else if (geometryType === 'Polygon') olGeometryType = 'Polygon';

      const drawInteraction = new Draw({
        source: vectorSourceRef.current,
        type: olGeometryType as any
      });

      drawInteraction.on('drawend', (event) => {
        console.log('🎯 Draw completed!');
        const feature = event.feature;
        const wktFormat = new WKT();
        
        try {
          const wkt = wktFormat.writeFeature(feature, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
          });
          console.log('📝 Generated WKT:', wkt);
          
          if (onDrawEnd) {
            onDrawEnd(wkt);
          }
        } catch (error) {
          console.error('❌ Error generating WKT:', error);
        }
      });

      mapInstance.current.addInteraction(drawInteraction);
      drawInteractionRef.current = drawInteraction;
      console.log('✅ Draw interaction added successfully');
    }

    return () => {
      if (drawInteractionRef.current && mapInstance.current) {
        mapInstance.current.removeInteraction(drawInteractionRef.current);
        drawInteractionRef.current = null;
      }
    };
  }, [geometryType, onDrawEnd]);

  // Zoom to geometry useEffect
  useEffect(() => {
    if (!mapInstance.current || !zoomToGeometry) {
      return;
    }
    
    console.log('🎯 Zoom işlemi başlatılıyor:', zoomToGeometry);
    
    try {
      const wktFormat = new WKT();
      const feature = wktFormat.readFeature(zoomToGeometry.wkt, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });
      
      const geometry = feature.getGeometry();
      if (!geometry) {
        console.error("❌ Zoom için geometri oluşturulamadı");
        return;
      }
      
      const extent = geometry.getExtent();
      const view = mapInstance.current.getView();
      
      console.log('🎯 Geometri tipi:', geometry.getType());
      console.log('🎯 Extent:', extent);
      
      // Nokta geometrisi için özel zoom
      if (geometry.getType() === 'Point') {
        const coordinates = (geometry as any).getCoordinates();
        console.log('📍 Point koordinatları:', coordinates);
        view.animate({
          center: coordinates,
          zoom: 18,
          duration: 1500
        });
      } else {
        // Diğer geometriler için fit kullan
        console.log('🔷 Polygon/LineString extent fit yapılıyor');
        view.fit(extent, {
          padding: [50, 50, 50, 50],
          maxZoom: 18,
          duration: 1500
        });
      }
      
      console.log('✅ Zoom işlemi tamamlandı');
      
      // Zoom işlemi tamamlandıktan sonra state'i temizle
      setTimeout(() => {
        // Zoom prop'unu sıfırlamak için parent component'e bildirim gönderilebilir
        // Şimdilik sadece log atalım
        console.log('🧹 Zoom state temizlenmeye hazır');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Zoom işlemi sırasında hata:', error);
    }
  }, [zoomToGeometry]);

  // Geometriler değiştiğinde haritayı güncelle (arama sonuçları için)
  useEffect(() => {
    if (!mapInstance.current || !vectorSourceRef.current) return;

    console.log('🔄 Geometriler güncellendiği için haritayı yeniliyoruz...');
    
    // Mevcut feature'ları temizle
    vectorSourceRef.current.clear();
    
    // Yeni geometrileri ekle
    if (geometries.length > 0) {
      const wktFormat = new WKT();
      
      geometries.forEach((geometry, index) => {
        try {
          const feature = wktFormat.readFeature(geometry.wkt, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
          });
          feature.set('name', geometry.name || `Geometry ${index + 1}`);
          feature.set('type', geometry.type || 'Point');
          feature.set('id', geometry.id);
          feature.set('wkt', geometry.wkt);
          feature.set('highlighted', (geometry as any).highlighted || false);
          vectorSourceRef.current!.addFeature(feature);
          
          // Highlighted geometriyi logla
          if ((geometry as any).highlighted) {
            console.log(`🔍 Highlighted geometry: ${geometry.name} (${geometry.type})`);
          }
        } catch (error) {
          console.warn(`❌ Error updating geometry ${index + 1}:`, error);
        }
      });
    }
  }, [geometries]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "400px", position: "relative" }}>
      {/* Drag Status Indicator */}
      {isDragging && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(25, 118, 210, 0.9)",
            color: "white",
            padding: "8px 16px",
            borderRadius: "20px",
            fontSize: "14px",
            fontWeight: "600",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span style={{ animation: "pulse 2s infinite" }}>🖐️</span>
          Geometri şekil olarak hareket ediyor...
        </div>
      )}
      
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      
      {/* Popup Element - MapView'deki gibi */}
      <div
        ref={popupRef}
        style={{
          background: "white",
          border: "2px solid #1976d2",
          borderRadius: "8px",
          padding: "12px",
          fontSize: "14px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          maxWidth: "300px",
          display: popupContent ? "block" : "none",
          position: "relative",
          zIndex: 10000,
          pointerEvents: "auto"
        }}
        onMouseEnter={() => {
          // Popup'ın üzerindeyken hover timeout'unu temizle
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
        }}
        onMouseLeave={() => {
          // Popup'tan çıkınca popup'ı kapat
          setTimeout(() => {
            if (popupOverlayRef.current) {
              popupOverlayRef.current.setPosition(undefined);
              setPopupContent(null);
            }
          }, 200);
        }}
      >
        {popupContent && (
          <>
            <div style={{ 
              fontWeight: "bold", 
              color: "#1976d2", 
              marginBottom: "8px",
              fontSize: "16px"
            }}>
              📍 {popupContent.name}
            </div>
            <div style={{ marginBottom: "6px" }}>
              <strong>Tip:</strong> <span style={{ color: "#666" }}>{popupContent.type}</span>
            </div>
            {popupContent.id && (
              <div style={{ marginBottom: "6px", fontSize: "11px", color: "#888" }}>
                <strong>ID:</strong> <span style={{ color: "#666" }}>{popupContent.id}</span>
              </div>
            )}
            <div style={{ 
              fontSize: "12px", 
              color: "#888",
              wordBreak: "break-all",
              maxHeight: "60px",
              overflow: "hidden",
              marginBottom: "8px"
            }}>
              <strong>WKT:</strong> {popupContent.wkt.substring(0, 80)}
              {popupContent.wkt.length > 80 && "..."}
            </div>
            
            {/* Metrik Bilgileri */}
            {popupContent.area !== undefined && (
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                <strong>📐 Alan:</strong> {popupContent.area.toFixed(2)} m²
              </div>
            )}
            {popupContent.length !== undefined && (
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                <strong>📏 Uzunluk:</strong> {popupContent.length.toFixed(2)} m
              </div>
            )}
            {popupContent.centroid && (
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                <strong>🎯 Merkez:</strong> {formatValue(popupContent.centroid)}
              </div>
            )}
            {popupContent.boundingBox && (
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                <strong>📦 Sınır Kutusu:</strong> {formatValue(popupContent.boundingBox)}
              </div>
            )}
            {popupContent.startPoint && (
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                <strong>🚀 Başlangıç:</strong> {formatValue(popupContent.startPoint)}
              </div>
            )}
            {popupContent.endPoint && (
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                <strong>🏁 Bitiş:</strong> {formatValue(popupContent.endPoint)}
              </div>
            )}
            
            {/* Butonlar */}
            <div style={{
              display: "flex",
              gap: "4px",
              justifyContent: "space-between",
              marginTop: "8px"
            }}>
              <button
                onClick={() => {
                  if (onDeleteGeometry && popupContent && popupContent.id) {
                    console.log("🗑️ Silme işlemi başlatılıyor, ID:", popupContent.id);
                    onDeleteGeometry(popupContent.id as number);
                    // Popup'ı kapat
                    if (popupOverlayRef.current) {
                      popupOverlayRef.current.setPosition(undefined);
                      setPopupContent(null);
                    }
                  } else {
                    toast.error("❌ Bu geometri için ID bulunamadı!");
                  }
                }}
                style={{
                  padding: "3px 6px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                  fontSize: "9px",
                  fontWeight: "600",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#c82333";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#dc3545";
                }}
              >
                🗑️ Sil
              </button>
              
              <button
                onClick={() => {
                  if (onUpdateGeometry && popupContent) {
                    // Geometri bilgilerini bul
                    const geometry = popupContent.id 
                      ? geometries.find(g => g.id === popupContent.id)
                      : geometries.find(g => g.name === popupContent.name && g.type === popupContent.type);
                    
                    if (geometry) {
                      onUpdateGeometry(geometry);
                    } else {
                      toast.error("❌ Geometri bulunamadı!");
                    }
                    // Popup'ı kapat
                    if (popupOverlayRef.current) {
                      popupOverlayRef.current.setPosition(undefined);
                      setPopupContent(null);
                    }
                  }
                }}
                style={{
                  padding: "3px 6px",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                  fontSize: "9px",
                  fontWeight: "600",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#218838";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#28a745";
                }}
              >
                ✏️ Güncelle
              </button>
              
              <button
                onClick={() => {
                  if (popupContent && popupContent.id && selectInteractionRef.current) {
                    // Feature'ı bul ve seç
                    const features = vectorSourceRef.current?.getFeatures();
                    const targetFeature = features?.find(f => f.get('id') === popupContent.id);
                    
                    if (targetFeature) {
                      // Feature'ı seç - bu drag modunu aktif eder
                      selectInteractionRef.current.getFeatures().clear();
                      selectInteractionRef.current.getFeatures().push(targetFeature);
                      
                      const geometryType = targetFeature.get('type') || 'Point';
                      let message = "";
                      
                      if (geometryType === 'Point') {
                        message = "📍 Nokta seçildi! Sürükleyip bırakabilirsiniz.";
                      } else if (geometryType === 'LineString') {
                        message = "📏 Çizgi seçildi! Tüm çizgiyi şekil olarak sürükleyebilirsiniz. Vertex düzenlemek için köşelere tıklayın.";
                      } else if (geometryType === 'Polygon') {
                        message = "🔷 Alan seçildi! Tüm alanı şekil olarak sürükleyebilirsiniz. Vertex düzenlemek için köşelere tıklayın.";
                      } else {
                        message = "🖐️ Geometri seçildi! Şekil olarak sürükleyebilirsiniz.";
                      }
                      
                      toast.info(message + " Taşıma işlemi otomatik olarak kaydedilecek.");
                      
                      // Popup'ı kapat
                      if (popupOverlayRef.current) {
                        popupOverlayRef.current.setPosition(undefined);
                        setPopupContent(null);
                      }
                    } else {
                      toast.error("❌ Geometri bulunamadı!");
                    }
                  } else {
                    toast.error("❌ Bu geometri için ID bulunamadı!");
                  }
                }}
                style={{
                  padding: "3px 6px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                  fontSize: "9px",
                  fontWeight: "600",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#0056b3";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#007bff";
                }}
              >
                🖐️ Taşı
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SimpleMap;
