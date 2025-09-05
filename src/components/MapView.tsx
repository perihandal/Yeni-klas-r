import React, { useEffect, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import "ol/ol.css";

import Draw from "ol/interaction/Draw";
import Translate from "ol/interaction/Translate";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Feature } from "ol";
import { Geometry } from "ol/geom";
import { WKT } from "ol/format";
import { Style, Fill, Stroke, Circle, Text, Icon } from "ol/style";
import Overlay from "ol/Overlay";
import { defaults as defaultInteractions } from "ol/interaction";
import Collection from "ol/Collection";

// Geometri tipini tanımla
export interface GeometryItem {
  id?: string | number;
  name?: string;
  type?: string;
  wkt: string;
  highlighted?: boolean;
  area?: number;
  length?: number;
  centroid?: string;
  boundingBox?: string;
  startPoint?: string;
  endPoint?: string;
}


interface MapViewProps {
  geometryType: string;
  onDrawEnd?: (wkt: string) => void;
  geometries?: GeometryItem[];
  zoomToGeometry?: { wkt: string; name?: string } | null;
  onDeleteGeometry?: (id: number) => void;
  onUpdateGeometry?: (geometry: GeometryItem) => void;
  onMoveGeometry?: (id: number, newWkt: string) => void;
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


const MapView: React.FC<MapViewProps> = ({ 
  geometryType,
  onDrawEnd, 
  geometries = [], 
  zoomToGeometry = null,  
  onDeleteGeometry,
  onUpdateGeometry,
  onMoveGeometry
}) => {
  console.log('🚀 MapView component başlatılıyor...', { geometryType, geometriesCount: geometries.length });
  
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);
  const drawRef = useRef<Draw | null>(null);
  const translateRef = useRef<Translate | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupOverlayRef = useRef<Overlay | null>(null);
  const [mapInitialized, setMapInitialized] = React.useState(false);
  const [mapError, setMapError] = React.useState<string | null>(null);
  const [moveMode, setMoveMode] = React.useState<{ active: boolean; geometryId?: number }>({ active: false });

  const [popupContent, setPopupContent] = React.useState<{ 
    id?: string | number;
    name: string; 
    type: string; 
    wkt: string;
    area?: number;
    length?: number;
    centroid?: string;
    boundingBox?: string;
    startPoint?: string;
    endPoint?: string;
  } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Taşıma modunu aktifleştir
  const activateMoveMode = (id: number) => {
    if (!mapInstance.current || !vectorSourceRef.current) {
      alert("Harita henüz hazır değil!");
      return;
    }
    
    // Önceki taşıma interaction'ını temizle
    if (translateRef.current) {
      mapInstance.current.removeInteraction(translateRef.current);
      translateRef.current = null;
    }
    
    // Taşıma modunu aktifleştir
    setMoveMode({ active: true, geometryId: id });
    
    // Taşıma interaction'ını oluştur
    const targetFeature = vectorSourceRef.current.getFeatures().find(feature => feature.get('id') === id);
    if (targetFeature) {
      translateRef.current = new Translate({
        features: new Collection([targetFeature])
      });
    } else {
      alert("Taşınacak geometri bulunamadı!");
      return;
    }
    
    // Taşıma tamamlandığında
    translateRef.current.on('translateend', (event) => {
      const feature = event.features.getArray()[0];
      if (feature && onMoveGeometry) {
        const geometry = feature.getGeometry();
        if (geometry) {
          // WKT formatına çevir
          const wktFormat = new WKT();
          const newWkt = wktFormat.writeGeometry(geometry, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
          });
          
          // Backend'e yeni WKT'yi gönder
          onMoveGeometry(id, newWkt);
          
          // Feature'ın WKT'sini güncelle
          feature.set('wkt', newWkt);
        }
      }
      
      // Taşıma modunu kapat
      setMoveMode({ active: false });
      if (translateRef.current) {
        mapInstance.current!.removeInteraction(translateRef.current);
        translateRef.current = null;
      }
      
      alert("Geometri başarıyla taşındı!");
    });
    
    // Taşıma interaction'ını haritaya ekle
    mapInstance.current.addInteraction(translateRef.current);
    
    alert("Taşıma modu aktifleştirildi! Geometriyi sürükleyebilirsiniz.");
  };

  // Geometrileri haritada göster
  useEffect(() => {
    if (!vectorSourceRef.current || !mapInitialized) {
      return;
    }
    
    try {
      vectorSourceRef.current.clear();
      
      if (geometries.length > 0) {
        const wktFormat = new WKT();
        geometries.forEach((g, index) => {
          try {
            
            // WKT string'inin başında SRID bilgisi var mı kontrol et
            let wktString = g.wkt;
            let projection = 'EPSG:4326';
            
            // Null veya undefined kontrol
            if (!wktString) {
              console.error(`Geometri ${index + 1}: WKT verisi boş`);
              return;
            }
            
            // String olmayan WKT'yi string'e çevir
            if (typeof wktString !== 'string') {
              wktString = String(wktString);
            }
            
            // SRID=xxxx; formatını kontrol et
            if (wktString.includes('SRID=')) {
              const sridMatch = wktString.match(/SRID=(\d+);/);
              if (sridMatch) {
                projection = `EPSG:${sridMatch[1]}`;
                wktString = wktString.replace(/SRID=\d+;/, '');
              }
            }
            
            const feature = wktFormat.readFeature(wktString, { 
              dataProjection: projection, 
              featureProjection: 'EPSG:3857' 
            });
            
            // Feature geometrisini kontrol et
            const geometry = feature.getGeometry();
            if (!geometry) {
              console.error(`Geometri ${index + 1}: Feature geometrisi boş`);
              return;
            }
            
            // Feature'a bilgileri ekle
            if (g.name) {
              feature.set('name', g.name);
            }
            if (g.type) {
              feature.set('type', g.type);
            } else {
              // Eğer tip belirtilmemişse WKT'den çıkar
              const wktType = wktString.split('(')[0].trim();
              feature.set('type', wktType);
            }
            
            // Highlight bilgisini ekle
            const isHighlighted = g.highlighted || false;
            feature.set('highlighted', isHighlighted);
            
            // WKT bilgisini de ekle
            feature.set('wkt', g.wkt);
            

            
            // Feature'a stil uygula
            const featureStyle = createFeatureStyle(feature, feature.get('type') || 'Point', isHighlighted);
            feature.setStyle(featureStyle);
            
            vectorSourceRef.current!.addFeature(feature);
          } catch (err) {
            console.error('Geometry format hatası:', err);
          }
        });
        
        const totalFeatures = vectorSourceRef.current.getFeatures().length;
        
        // Harita görünüm alanını kontrol et (Türkiye sınırları içinde tutmaya çalış)
        if (mapInstance.current && totalFeatures > 0) {
          const view = mapInstance.current.getView();
          // Vector source'un extent'ini kontrol et
          const vectorExtent = vectorSourceRef.current.getExtent();
          if (vectorExtent && vectorExtent.every(val => isFinite(val))) {
            view.fit(vectorExtent, { 
              padding: [20, 20, 20, 20],
              duration: 500,
              easing: (t: number) => t
            });
          }
        }
      } else {
        // Hiç geometri yok
      }
    } catch (err) {
      console.error('Geometri görüntüleme hatası:', err);
    }
  }, [geometries, mapInitialized]);

  // Belirli geometriye zoom yapma
  useEffect(() => {
    if (!mapInstance.current || !zoomToGeometry || !mapInitialized) {
      return;
    }
    
    let animationTimeout: number | null = null;
    
    try {
      const wktFormat = new WKT();
      const feature = wktFormat.readFeature(zoomToGeometry.wkt, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });
      
      const geometry = feature.getGeometry();
      if (!geometry) {
        console.error("Zoom için geometri oluşturulamadı");
        return;
      }
      
      const extent = geometry.getExtent();
      const view = mapInstance.current.getView();
      
      // Türkiye sınırları kontrolü
      const turkeyBounds = [
        2650000, 4350000,
        5300000, 5650000
      ];
      
      const isInTurkey = (
        extent[0] >= turkeyBounds[0] && extent[1] >= turkeyBounds[1] &&
        extent[2] <= turkeyBounds[2] && extent[3] <= turkeyBounds[3]
      );
      
      if (isInTurkey) {
        // Nokta geometrisi için özel zoom
        if (geometry.getType() === 'Point') {
          const coordinates = (geometry as any).getCoordinates();
          view.animate({
            center: coordinates,
            zoom: 18,
            duration: 1500
          });
        } else {
          // Diğer geometriler için fit kullan
          view.fit(extent, {
            padding: [5, 5, 5, 5],
            maxZoom: 18,
            duration: 1500
          });
        }
      } else {
        // Türkiye görünümünde kal ama biraz zoom yap
        view.animate({
          center: [3924862.6, 4865942.2],
          zoom: 7,
          duration: 1000
        });
      }
      
    } catch (err) {
      console.error("Zoom hatası:", err);
    }
    
    // Cleanup - timeout'u temizle
    return () => {
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }
    };
  }, [zoomToGeometry, mapInitialized]);

  // Harita başlatma
  useEffect(() => {
    console.log('🔄 Harita başlatma useEffect çalıştı, mapInstance var mı?', !!mapInstance.current);
    
    if (mapRef.current && !mapInstance.current) {
      console.log('✅ Harita başlatma koşulları sağlandı');
      try {
        console.log('🏗️ Vector source oluşturuluyor...');
      vectorSourceRef.current = new VectorSource();
        const vectorLayer = new VectorLayer({ 
          source: vectorSourceRef.current,
          style: (feature: any) => {
            const featureType = feature.get('type') || 'Point';
            const isHighlighted = feature.get('highlighted') || false;
            return createFeatureStyle(feature as Feature, featureType, isHighlighted);
          }
        });
        console.log('✅ Vector layer oluşturuldu');
        
        // Popup overlay oluştur
        if (popupRef.current) {
          popupOverlayRef.current = new Overlay({
            element: popupRef.current,
            autoPan: true,
            offset: [0, -15], // Popup'u biraz yukarı kaydır
            positioning: 'bottom-center' // Alt ortadan pozisyonla
          });
          console.log('✅ Popup overlay oluşturuldu');
        }

        console.log('🗺️ Map instance oluşturuluyor...');
      mapInstance.current = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({ source: new OSM() }),
          vectorLayer,
        ],
        overlays: popupOverlayRef.current ? [popupOverlayRef.current] : [],
        interactions: defaultInteractions(), // Tüm varsayılan etkileşimleri aktif et
        view: new View({
          center: [3924862.6, 4865942.2], // Türkiye'nin EPSG:3857'deki merkezi
          zoom: 6,
          projection: 'EPSG:3857',
          minZoom: 4, // Daha uzak zoom yapabilsin
          maxZoom: 19, // Daha yakın zoom yapabilsin
          enableRotation: false, // Döndürmeyi kapat, zoom problemini önle
          constrainResolution: false // Zoom kısıtlamasını kaldır
        }),
      });
        console.log('✅ Map instance başarıyla oluşturuldu!');

        // Mouse hover event'leri ekle (daha stabil)
        let currentFeature: any = null;
        
        mapInstance.current.on('pointermove', (evt) => {
          const feature = mapInstance.current!.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
          
          // Eğer aynı feature üzerindeyse hiçbir şey yapma
          if (feature === currentFeature) {
            return;
          }
          
          // Önceki timeout'u temizle
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          
          currentFeature = feature;
          
          // Hover işlemini yap
          hoverTimeoutRef.current = setTimeout(() => {
            if (feature && popupOverlayRef.current) {
              const name = feature.get('name') || 'İsimsiz';
              const type = feature.get('type') || 'Bilinmeyen';
              const coordinates = evt.coordinate;
              
              // Geometri verilerini bul
              const geometryData = geometries.find(g => g.name === name && g.type === type);
              
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

        // Zoom değişikliklerini dinle
        mapInstance.current.getView().on('change:resolution', () => {
          // Zoom değişti
        });

        // Mouse wheel event kontrolü kaldırıldı - gereksiz log

        // Harita yüklenme kontrolü - tek seferlik
        console.log('🎯 Render complete event dinleniyor...');
        let renderCount = 0;
        let isInitialized = false;
        
        mapInstance.current.on('rendercomplete', () => {
          renderCount++;
          console.log(`🎨 Render complete event tetiklendi! (${renderCount}/3)`);
          
          if (!isInitialized && renderCount <= 3) {
            setMapInitialized(true);
            setMapError(null);
            
            // İlk yüklemede Türkiye'ye odaklan
            const view = mapInstance.current!.getView();
            view.setCenter([3924862.6, 4865942.2]);
            view.setZoom(6);
            
            console.log('✅ Harita state başarıyla güncellendi!');
            isInitialized = true;
          }
        });

        // Tile yükleme hata kontrolü
        console.log('🔍 Tile layer eventleri ekleniyor...');
        mapInstance.current.getLayers().forEach(layer => {
          if (layer instanceof TileLayer) {
            const source = layer.getSource();
            source?.on('tileloaderror', (e: any) => {
              console.error('❌ Tile load error:', e);
              setMapError('Harita katmanları yüklenemedi. İnternet bağlantınızı kontrol edin.');
            });
            
            source?.on('tileloadstart', () => {
              console.log('⏳ Tile yükleme başladı');
            });
            
            source?.on('tileloadend', () => {
              console.log('✅ Tile yükleme tamamlandı');
            });
          }
        });
        
        // 3 saniye sonra zorla başlat
        const forceStartTimeout = setTimeout(() => {
          if (!mapInitialized) {
            console.log('⚠️ Timeout! Harita zorla başlatılıyor...');
            setMapInitialized(true);
          }
        }, 3000);
        
        // Cleanup fonksiyonunda timeout'u temizle
        return () => {
          if (forceStartTimeout) {
            clearTimeout(forceStartTimeout);
          }
        };

      } catch (err) {
        console.error('Harita başlatma hatası:', err);
        setMapError('Harita başlatılamadı: ' + (err as Error).message);
      }
    }
    
    return () => {
      // Cleanup - tüm timeout'ları ve event listener'ları temizle
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      
      // Interaction'ları temizle
      if (mapInstance.current) {
        if (drawRef.current) {
          mapInstance.current.removeInteraction(drawRef.current);
          drawRef.current = null;
        }
        if (translateRef.current) {
          mapInstance.current.removeInteraction(translateRef.current);
          translateRef.current = null;
        }
        
        // Harita instance'ını temizle
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
      }
      
      // Vector source referansını temizle
      vectorSourceRef.current = null;
      popupOverlayRef.current = null;
    };
  }, []);

  // Çizim interaction'ı
  useEffect(() => {
    if (!mapInstance.current || !vectorSourceRef.current || !mapInitialized) return;
    
    if (drawRef.current) {
      mapInstance.current.removeInteraction(drawRef.current);
      drawRef.current = null;
    }
    
    if (geometryType) {
      try {
      drawRef.current = new Draw({
        source: vectorSourceRef.current,
        type: geometryType as any,
          style: createFeatureStyle(new Feature(), geometryType)
      });
      mapInstance.current.addInteraction(drawRef.current);
        
      drawRef.current.on('drawend', (evt) => {
          try {
        const feature = (evt as any).feature as Feature<Geometry>;
            
            // Çizilen feature'a tip bilgisi ekle
            feature.set('type', geometryType);
            
            // Stil uygula
            const featureStyle = createFeatureStyle(feature, geometryType);
            feature.setStyle(featureStyle);
            
            const wkt = new WKT().writeFeature(feature, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857'
            });
            
                // LineString çizimi tamamlandıysa başına ve sonuna point ekle
            if (geometryType === 'LineString' && onDrawEnd) {
              try {
                // LineString'den koordinatları çıkar
                const featureGeometry = feature.getGeometry();
                const coords = (featureGeometry as any).getCoordinates();
                if (coords && coords.length >= 2) {
                  const startCoord = coords[0];
                  const endCoord = coords[coords.length - 1];
                  
                  // Başlangıç noktası için WKT oluştur
                  const startWkt = `POINT(${startCoord[0]} ${startCoord[1]})`;
                  const endWkt = `POINT(${endCoord[0]} ${endCoord[1]})`;
                  
                  // Önce LineString'i gönder
                  onDrawEnd(wkt);
                  
                  // Sonra başlangıç noktasını gönder
                  setTimeout(() => onDrawEnd(startWkt), 100);
                  
                  // Sonra bitiş noktasını gönder
                  setTimeout(() => onDrawEnd(endWkt), 200);
                } else {
                  onDrawEnd(wkt);
                }
              } catch (error) {
                console.error('LineString point ekleme hatası:', error);
                onDrawEnd(wkt);
              }
            } else if (onDrawEnd) {
              onDrawEnd(wkt);
            }
          } catch (err) {
            console.error('Çizim tamamlama hatası:', err);
        }
      });
      } catch (err) {
        console.error('Çizim interaction hatası:', err);
      }
    }
    
    // Cleanup - interaction'ları temizle
    return () => {
      if (drawRef.current && mapInstance.current) {
        mapInstance.current.removeInteraction(drawRef.current);
        drawRef.current = null;
      }
    };
  }, [geometryType, onDrawEnd, mapInitialized]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 0, position: "relative" }}>
      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      <div ref={mapRef} className="ol-map-container" style={{ width: "100%", height: "100%", minHeight: 0 }} />
      {mapError && (
        <div style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          right: "10px",
          background: "#ff5722",
          color: "white",
          padding: "10px",
          borderRadius: "4px",
          zIndex: 1000,
          fontSize: "14px"
        }}>
          {mapError}
        </div>
      )}
      {!mapInitialized && !mapError && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(255,255,255,0.95)",
          padding: "30px",
          borderRadius: "12px",
          fontSize: "16px",
          color: "#666",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          textAlign: "center",
          zIndex: 1000
        }}>
          <div style={{
            width: "40px",
            height: "40px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #2196F3",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 15px",
          }}></div>
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Harita Yükleniyor...</div>
          <div style={{ fontSize: "12px", color: "#999" }}>
            Lütfen bekleyin
          </div>
        </div>
      )}
      
      {/* Taşıma Modu Göstergesi */}
      {moveMode.active && (
        <div style={{
          position: "absolute",
          top: "10px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#ff9800",
          color: "white",
          padding: "8px 16px",
          borderRadius: "4px",
          fontSize: "14px",
          fontWeight: "bold",
          zIndex: 1000,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
        }}>
          🖐️ Taşıma Modu Aktif - Geometriyi sürükleyin
        </div>
      )}
      
      {/* Popup Element */}
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
          pointerEvents: "auto" // Mouse eventlerini etkinleştir
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
                <strong>🎯 Merkez:</strong> {popupContent.centroid}
              </div>
            )}
            {popupContent.boundingBox && (
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                <strong>📦 Sınır Kutusu:</strong> {popupContent.boundingBox}
              </div>
            )}
            {popupContent.startPoint && (
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                <strong>🚀 Başlangıç:</strong> {popupContent.startPoint}
              </div>
            )}
            {popupContent.endPoint && (
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                <strong>🏁 Bitiş:</strong> {popupContent.endPoint}
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
                key="delete-button"
                onClick={() => {
                  console.log("🗑️ Sil butonuna tıklandı:", {
                    popupContent,
                    hasId: !!popupContent?.id,
                    id: popupContent?.id,
                    hasOnDeleteGeometry: !!onDeleteGeometry
                  });
                  
                  if (onDeleteGeometry && popupContent && popupContent.id) {
                    console.log("🗑️ Silme işlemi başlatılıyor, ID:", popupContent.id);
                    onDeleteGeometry(popupContent.id as number);
                    // Popup'ı kapat
                    if (popupOverlayRef.current) {
                      popupOverlayRef.current.setPosition(undefined);
                      setPopupContent(null);
                    }
                  } else {
                    console.error("❌ Silme için gerekli bilgiler eksik:", {
                      hasOnDeleteGeometry: !!onDeleteGeometry,
                      hasPopupContent: !!popupContent,
                      hasId: !!popupContent?.id,
                      id: popupContent?.id
                    });
                    alert("Bu geometri için ID bulunamadı!");
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
                key="update-button"
                onClick={() => {
                  if (onUpdateGeometry && popupContent) {
                    // Geometri bilgilerini bul - ID ile daha güvenilir
                    const geometry = popupContent.id 
                      ? geometries.find(g => g.id === popupContent.id)
                      : geometries.find(g => g.name === popupContent.name && g.type === popupContent.type);
                    
                    if (geometry) {
                      onUpdateGeometry(geometry);
                    } else {
                      alert("Geometri bulunamadı!");
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
                key="move-button"
                onClick={() => {
                  if (popupContent && popupContent.id) {
                    activateMoveMode(popupContent.id as number);
                    // Popup'ı kapat
                    if (popupOverlayRef.current) {
                      popupOverlayRef.current.setPosition(undefined);
                      setPopupContent(null);
                    }
                  } else {
                    alert("Bu geometri için ID bulunamadı!");
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

export default MapView;
