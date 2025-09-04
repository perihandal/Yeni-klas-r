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
import { Collection } from "ol";

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

// Pin/marker stillerini oluştur
const createFeatureStyle = (feature: Feature, geometryType: string, isHighlighted: boolean = false) => {
  const fillColor = getColorByType(geometryType);
  const strokeColor = darkenColor(fillColor);
  
  if (geometryType === 'Point') {
    // Pin ikonunu kullan
    const iconStyle = new Style({
      image: new Icon({
        src: '/pin.png',
        scale: 0.03, // Ultra küçük boyut
        anchor: [0.5, 1], // Pin'in alt ucu koordinata hizalanır
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction'
      }),
      text: new Text({
        text: feature.get('name') || '',
        offsetY: -10, // Ultra küçük pin için minimal offset
        fill: new Fill({ color: isHighlighted ? '#ff0000' : '#000' }),
        stroke: new Stroke({ 
          color: isHighlighted ? '#ffff00' : '#fff', 
          width: isHighlighted ? 2 : 1 
        }),
        font: isHighlighted ? 'bold 11px Arial' : '10px Arial'
      })
    });
    
    return iconStyle;
  } else if (geometryType === 'LineString') {
    return new Style({
      stroke: new Stroke({
        color: strokeColor,
        width: 3
      })
    });
  } else if (geometryType === 'Polygon') {
    return new Style({
      fill: new Fill({ 
        color: fillColor + '40'
      }),
      stroke: new Stroke({ 
        color: strokeColor, 
        width: 2
      })
    });
  }
  
  // Varsayılan stil
  return new Style({
    image: new Circle({
      radius: 6,
      fill: new Fill({ color: '#ff0000' }),
      stroke: new Stroke({ color: '#ffffff', width: 2 })
    })
  });
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
    console.log("🖐️ Taşıma modu aktifleştiriliyor, ID:", id);
    
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
          
          console.log("🔄 Geometri taşındı:", {
            id: feature.get('id'),
            oldWkt: feature.get('wkt'),
            newWkt: newWkt
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
    console.log("MapView - geometries useEffect çalıştı:", {
      geometriesLength: geometries.length,
      mapInitialized,
      hasVectorSource: !!vectorSourceRef.current
    });
    
    if (!vectorSourceRef.current || !mapInitialized) {
      console.log("MapView - Koşullar sağlanmadı, çıkılıyor");
      return;
    }
    
    try {
      vectorSourceRef.current.clear();
      console.log("Vector source temizlendi");
      
      if (geometries.length > 0) {
        console.log(`MapView - ${geometries.length} geometri işlenecek`);
        const wktFormat = new WKT();
        geometries.forEach((g, index) => {
          try {
            console.log(`\n🔍 Geometri ${index + 1} analizi:`, {
              name: g.name,
              type: g.type,
              originalWkt: g.wkt,
              wktType: typeof g.wkt,
              wktLength: g.wkt?.length
            });
            
            // WKT string'inin başında SRID bilgisi var mı kontrol et
            let wktString = g.wkt;
            let projection = 'EPSG:4326';
            
            // Null veya undefined kontrol
            if (!wktString) {
              console.error(`❌ Geometri ${index + 1}: WKT verisi boş`);
              return;
            }
            
            // String olmayan WKT'yi string'e çevir
            if (typeof wktString !== 'string') {
              wktString = String(wktString);
              console.log(`⚠️ WKT string'e çevrildi:`, wktString);
            }
            
            // SRID=xxxx; formatını kontrol et
            if (wktString.includes('SRID=')) {
              const sridMatch = wktString.match(/SRID=(\d+);/);
              if (sridMatch) {
                projection = `EPSG:${sridMatch[1]}`;
                wktString = wktString.replace(/SRID=\d+;/, '');
                console.log(`🌍 SRID tespit edildi: ${projection}`);
              }
            } else {
              console.log(`📍 SRID bulunamadı, varsayılan: ${projection}`);
            }
            
            console.log(`📝 İşlenecek WKT:`, wktString.substring(0, 100) + "...");
            
            const feature = wktFormat.readFeature(wktString, { 
              dataProjection: projection, 
              featureProjection: 'EPSG:3857' 
            });
            
            console.log(`🔍 WKT okuma:`, {
              wktString: wktString.substring(0, 100),
              projection,
              featureProjection: 'EPSG:3857',
              geometryType: feature.getGeometry()?.getType()
            });
            
            // Feature geometrisini kontrol et
            const geometry = feature.getGeometry();
            if (!geometry) {
              console.error(`❌ Geometri ${index + 1}: Feature geometrisi boş`);
              return;
            }
            
            // Koordinatları kontrol et (geometry tipine göre)
            let coordinates: any = null;
            if (geometry.getType() === 'Point') {
              coordinates = (geometry as any).getCoordinates();
            } else if (geometry.getType() === 'LineString') {
              coordinates = (geometry as any).getCoordinates();
            } else if (geometry.getType() === 'Polygon') {
              coordinates = (geometry as any).getCoordinates();
            }
            console.log(`🎯 Feature koordinatları (EPSG:3857):`, {
              coordinates,
              firstCoord: coordinates?.[0],
              coordCount: coordinates?.length,
              isInRange: coordinates?.[0]?.[0] > 1000000 && coordinates?.[0]?.[1] > 1000000
            });
            
            // Feature'a bilgileri ekle
            if (g.id) {
              feature.set('id', g.id);
            }
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
            
            // Feature'ı eklemeden önce extent kontrolü
            const extent = geometry.getExtent();
            console.log(`📦 Geometri extent:`, extent);
            
        vectorSourceRef.current!.addFeature(feature);
            console.log(`📍 Pin stili uygulandı:`, {
              type: feature.get('type'),
              name: feature.get('name'),
              hasStyle: !!feature.getStyle(),
              isPoint: feature.get('type') === 'Point',
              isHighlighted: isHighlighted,
              iconSrc: feature.get('type') === 'Point' ? '/pin.png' : 'N/A',
              iconScale: feature.get('type') === 'Point' ? '0.03 (ultra mini)' : 'N/A'
            });
            console.log(`✅ Geometri başarıyla eklendi:`, {
              name: g.name || 'İsimsiz',
              type: g.type,
              projection,
              geometryType: geometry.getType(),
              coordinates: coordinates,
              extent: extent
            });
          } catch (err) {
            console.error('❌ Geometry format hatası:', {
              name: g.name,
              wkt: g.wkt,
              error: err
            });
          }
        });
        
        const totalFeatures = vectorSourceRef.current.getFeatures().length;
        console.log(`🎯 Toplam ${totalFeatures} feature vector source'a eklendi`);
        
        // Harita görünüm alanını kontrol et (Türkiye sınırları içinde tutmaya çalış)
        if (mapInstance.current && totalFeatures > 0) {
          const view = mapInstance.current.getView();
          const currentCenter = view.getCenter();
          const currentZoom = view.getZoom();
          
          console.log(`🗺️ Harita görünüm bilgileri:`, {
            center: currentCenter,
            zoom: currentZoom
          });
          
          // Vector source'un extent'ini kontrol et
          const vectorExtent = vectorSourceRef.current.getExtent();
          console.log(`📦 Vector source extent:`, vectorExtent);
          
          // Geometrilerin extent'ine zoom yap
          if (vectorExtent && vectorExtent.every(val => isFinite(val))) {
            console.log(`🎯 Geometrilerin extent'ine zoom yapılıyor`);
            view.fit(vectorExtent, { 
              padding: [20, 20, 20, 20],
              duration: 800
            });
          }
        }
      } else {
        console.log("⚠️ Hiç geometri bulunamadı");
      }
    } catch (err) {
      console.error('🔥 Geometri görüntüleme hatası:', err);
    }
  }, [geometries, mapInitialized]);

  // Belirli geometriye zoom yapma
  useEffect(() => {
    console.log("🔄 zoomToGeometry useEffect çalıştı:", {
      hasMapInstance: !!mapInstance.current,
      hasZoomToGeometry: !!zoomToGeometry,
      mapInitialized,
      zoomToGeometry
    });
    
    if (!mapInstance.current || !zoomToGeometry || !mapInitialized) {
      console.log("❌ Zoom yapılamıyor - koşullar sağlanmadı");
      return;
    }
    
    console.log("🎯 Geometriye zoom yapılıyor:", zoomToGeometry);
    
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
      
      console.log("📦 Zoom extent:", extent);
      
      // Geometri tipine göre zoom yap
      if (geometry.getType() === 'Point') {
        const coordinates = (geometry as any).getCoordinates();
        view.animate({
          center: coordinates,
          zoom: 15,
          duration: 1500
        });
        console.log(`📍 Nokta için zoom`);
      } else {
        // Diğer geometriler için fit kullan
        view.fit(extent, {
          padding: [20, 20, 20, 20],
          duration: 1500
        });
        console.log(`📏 Çizgi/alan için fit zoom`);
      }
      
      // Zoom tamamlandıktan sonra bilgi ver
      setTimeout(() => {
        console.log("✅ Zoom tamamlandı:", {
          name: zoomToGeometry.name,
          newCenter: view.getCenter(),
          newZoom: view.getZoom(),
          geometryType: geometry.getType()
        });
      }, 1600);
      
    } catch (err) {
      console.error("❌ Zoom hatası:", err);
    }
  }, [zoomToGeometry, mapInitialized]);

  // Harita başlatma
  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      try {
      vectorSourceRef.current = new VectorSource();
        const vectorLayer = new VectorLayer({ 
          source: vectorSourceRef.current,
          style: (feature: any) => {
            const featureType = feature.get('type') || 'Point';
            const isHighlighted = feature.get('highlighted') || false;
            return createFeatureStyle(feature as Feature, featureType, isHighlighted);
          }
        });
        
        // Popup overlay oluştur
        if (popupRef.current) {
          popupOverlayRef.current = new Overlay({
            element: popupRef.current,
            autoPan: false, // Harita kaymasını engelle
            offset: [0, -15], // Popup'u biraz yukarı kaydır
            positioning: 'bottom-center' // Alt ortadan pozisyonla
          });
        }

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
          enableRotation: false, // Döndürmeyi kapat
          constrainResolution: false // Zoom kısıtlamasını kaldır
        }),
      });

        // Mouse hover event'leri ekle (daha stabil)
        let currentFeature: any = null;
        
        mapInstance.current.on('pointermove', (evt) => {
          const feature = mapInstance.current!.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
          
          // Popup'ın üzerindeyse hiçbir şey yapma
          if (popupRef.current && popupRef.current.contains(evt.originalEvent.target as Node)) {
            return;
          }
          
          // Eğer aynı feature üzerindeyse hiçbir şey yapma
          if (feature === currentFeature) {
            return;
          }
          
          // Önceki timeout'u temizle
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          
          currentFeature = feature;
          
          // Daha uzun gecikme ile hover işlemini yap
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
              console.log("📍 Popup gösteriliyor:", { 
                name, 
                type, 
                id: feature.get('id'),
                geometryDataId: geometryData?.id,
                finalId: feature.get('id') || geometryData?.id
              });
            } else if (popupOverlayRef.current) {
              popupOverlayRef.current.setPosition(undefined);
              setPopupContent(null);
            }
          }, 300); // 300ms gecikme ile titreşimi tamamen önle
        });

        // Zoom değişikliklerini dinle
        mapInstance.current.getView().on('change:resolution', () => {
          const zoom = mapInstance.current!.getView().getZoom();
          console.log("🔍 Zoom seviyesi değişti:", zoom);
        });

        // Mouse wheel event'ini test et
        mapRef.current.addEventListener('wheel', (e) => {
          console.log("🖱️ Mouse wheel event algılandı:", {
            deltaY: e.deltaY,
            ctrlKey: e.ctrlKey,
            preventDefault: true
          });
        });

        // Harita yüklenme kontrolü
        mapInstance.current.on('rendercomplete', () => {
          setMapInitialized(true);
          setMapError(null);
          

          
          // Interaction'ları kontrol et
          const view = mapInstance.current!.getView();
          const interactions = mapInstance.current!.getInteractions();
          const interactionNames = interactions.getArray().map(i => i.constructor.name);
          
          console.log("🗺️ Harita başlatıldı - Zoom kontrolü aktif:", {
            currentZoom: view.getZoom(),
            minZoom: view.getMinZoom(),
            maxZoom: view.getMaxZoom(),
            interactions: interactionNames,
            hasMouseWheelZoom: interactionNames.includes('MouseWheelZoom'),
            hasDoubleClickZoom: interactionNames.includes('DoubleClickZoom'),
            totalInteractions: interactions.getLength()
          });
        });

        // Tile yükleme hata kontrolü
        mapInstance.current.getLayers().forEach(layer => {
          if (layer instanceof TileLayer) {
            layer.getSource()?.on('tileloaderror', () => {
              setMapError('Harita katmanları yüklenemedi. İnternet bağlantınızı kontrol edin.');
            });
          }
        });

      } catch (err) {
        console.error('Harita başlatma hatası:', err);
        setMapError('Harita başlatılamadı: ' + (err as Error).message);
      }
    }
    
    return () => {
      // Timeout'u temizle
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
      }
    };
  }, []);

  // Çizim interaction'ı
  useEffect(() => {
    console.log(`🔧 Draw interaction kontrolü:`, {
      hasMapInstance: !!mapInstance.current,
      hasVectorSource: !!vectorSourceRef.current,
      mapInitialized,
      geometryType
    });
    
    if (!mapInstance.current || !vectorSourceRef.current || !mapInitialized) {
      console.log(`❌ Draw interaction eklenmedi - eksik bileşenler`);
      return;
    }
    
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
            
            // WKT'yi doğrudan kullan
            const finalWkt = wkt;
            
            console.log(`🎨 Çizilen geometri WKT:`, {
              type: geometryType,
              originalWkt: wkt,
              finalWkt: finalWkt
            });
            
            console.log(`🎨 Çizilen geometriye stil uygulandı:`, {
              type: geometryType,
              hasStyle: !!feature.getStyle(),
              isPoint: geometryType === 'Point',
              usingIcon: geometryType === 'Point' ? 'pin.png' : false
            });
            
            // Çizilen feature'ı vector source'a ekle
            if (vectorSourceRef.current) {
              const beforeCount = vectorSourceRef.current.getFeatures().length;
              vectorSourceRef.current.addFeature(feature);
              const afterCount = vectorSourceRef.current.getFeatures().length;
              
              console.log(`✅ Feature vector source'a eklendi:`, {
                type: geometryType,
                beforeCount,
                afterCount,
                geometry: feature.getGeometry()?.getType(),
                coordinates: (feature.getGeometry() as any)?.getCoordinates?.()
              });
              
              // Tüm feature'ları listele
              console.log(`📋 Vector source'daki tüm feature'lar:`, 
                vectorSourceRef.current.getFeatures().map(f => ({
                  type: f.get('type'),
                  name: f.get('name'),
                  geometry: f.getGeometry()?.getType()
                }))
              );
            }
            
            // LineString çizimi tamamlandıysa sadece LineString'i gönder
            if (geometryType === 'LineString' && onDrawEnd) {
              console.log('🔗 LineString gönderiliyor:', finalWkt);
              onDrawEnd(finalWkt);
            } else if (onDrawEnd) {
              onDrawEnd(finalWkt);
            }
          } catch (err) {
            console.error('Çizim tamamlama hatası:', err);
        }
      });
      } catch (err) {
        console.error('Çizim interaction hatası:', err);
      }
    }
    
    // Temizlik
    return () => {
      if (drawRef.current && mapInstance.current) {
        mapInstance.current.removeInteraction(drawRef.current);
      }
    };
  }, [geometryType, onDrawEnd, mapInitialized]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 0, position: "relative" }}>
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
          background: "rgba(255,255,255,0.9)",
          padding: "20px",
          borderRadius: "8px",
          fontSize: "16px",
          color: "#666"
        }}>
          Harita yükleniyor...
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
