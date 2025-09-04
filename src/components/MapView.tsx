import React, { useEffect, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { get as getProjection, transform } from "ol/proj";
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
  popupOpen?: boolean; // Popup durumu
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
  onMoveGeometry,
  popupOpen = false
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);
  const drawRef = useRef<Draw | null>(null);
  const translateRef = useRef<Translate | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupOverlayRef = useRef<Overlay | null>(null);
  const [mapInitialized, setMapInitialized] = React.useState(true);
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
    if (!vectorSourceRef.current) {
      return;
    }
    
    try {
      vectorSourceRef.current!.clear();
        
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
            }
            
            // SRID=xxxx; formatını kontrol et
            if (wktString.includes('SRID=')) {
              const sridMatch = wktString.match(/SRID=(\d+);/);
              if (sridMatch) {
                const srid = parseInt(sridMatch[1]);
                // Sadece geçerli SRID'leri kabul et
                if ([4326, 3857, 32636, 32637, 32638, 32639, 32640, 32641, 32642, 32643, 32644, 32645, 32646, 32647, 32648, 32649, 32650, 32651, 32652, 32653, 32654, 32655, 32656, 32657, 32658, 32659, 32660].includes(srid)) {
                  projection = `EPSG:${srid}`;
                  wktString = wktString.replace(/SRID=\d+;/, '');
                  console.log(`✅ Geçerli SRID bulundu: EPSG:${srid}`);
                } else {
                  console.warn(`⚠️ Geçersiz SRID: ${srid}, varsayılan EPSG:4326 kullanılıyor`);
                  projection = 'EPSG:4326';
                  wktString = wktString.replace(/SRID=\d+;/, '');
                }
              }
            }
            
            let feature;
            try {
              feature = wktFormat.readFeature(wktString, { 
                dataProjection: projection, 
                featureProjection: 'EPSG:3857' 
              });
              
              // Projection kontrolü
              const geometry = feature.getGeometry();
              if (geometry) {
                const coords = (geometry as any).getCoordinates?.();
                // Koordinatların geçerli olup olmadığını kontrol et
                if (coords && Array.isArray(coords)) {
                  const isValid = coords.every(coord => 
                    Array.isArray(coord) && coord.every(c => typeof c === 'number' && isFinite(c))
                  );
                  if (!isValid) {
                    console.warn(`⚠️ Geçersiz koordinatlar: ${JSON.stringify(coords)}`);
                    return;
                  }
                }
              }
            } catch (err) {
              console.error(`❌ WKT okuma hatası (${projection}):`, err);
              // Fallback olarak EPSG:4326 dene
              try {
                feature = wktFormat.readFeature(wktString, { 
                  dataProjection: 'EPSG:4326', 
                  featureProjection: 'EPSG:3857' 
                });
                console.log(`✅ EPSG:4326 ile başarılı okuma`);
              } catch (fallbackErr) {
                console.error(`❌ Fallback okuma da başarısız:`, fallbackErr);
                return;
              }
            }
            

            
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
            
            // Feature'ı ekle
            vectorSourceRef.current!.addFeature(feature);

          } catch (err) {
            console.error('❌ Geometry format hatası:', {
              name: g.name,
              wkt: g.wkt,
              error: err
            });
          }
        });
        
        const totalFeatures = vectorSourceRef.current.getFeatures().length;
        console.log(`📊 Haritada ${totalFeatures} geometri yüklendi`);
        
        // Harita görünüm alanını ayarla
        if (mapInstance.current && totalFeatures > 0) {
          const view = mapInstance.current.getView();
          const vectorExtent = vectorSourceRef.current.getExtent();
          
          // Geometrilerin extent'ine zoom yap
          if (vectorExtent && vectorExtent.every(val => isFinite(val))) {
            view.fit(vectorExtent, { 
              padding: [20, 20, 20, 20],
              duration: 500, // Animasyon süresini kısalt
              easing: (t: number) => t // Linear easing kullan
            });
            console.log("📍 Geometrilerin extent'ine zoom yapıldı");
          }
        }
      } else {
        console.log("⚠️ Hiç geometri bulunamadı");
      }
    } catch (err) {
      console.error('🔥 Geometri görüntüleme hatası:', err);
    }
  }, [geometries]);

  // Belirli geometriye zoom yapma
  useEffect(() => {
    if (!mapInstance.current || !zoomToGeometry) {
      return;
    }
    
    try {
      const wktFormat = new WKT();
      let feature;
      
      // SRID kontrolü
      let wktString = zoomToGeometry.wkt;
      let projection = 'EPSG:4326';
      
      if (wktString.includes('SRID=')) {
        const sridMatch = wktString.match(/SRID=(\d+);/);
        if (sridMatch) {
          const srid = parseInt(sridMatch[1]);
          if ([4326, 3857, 32636, 32637, 32638, 32639, 32640, 32641, 32642, 32643, 32644, 32645, 32646, 32647, 32648, 32649, 32650, 32651, 32652, 32653, 32654, 32655, 32656, 32657, 32658, 32659, 32660].includes(srid)) {
            projection = `EPSG:${srid}`;
            wktString = wktString.replace(/SRID=\d+;/, '');
          }
        }
      }
      
      try {
        feature = wktFormat.readFeature(wktString, {
          dataProjection: projection,
          featureProjection: 'EPSG:3857'
        });
      } catch (err) {
        // Fallback olarak EPSG:4326 dene
        feature = wktFormat.readFeature(wktString, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857'
        });
      }
      
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
        view.setCenter(coordinates);
        view.setZoom(15);
        console.log(`📍 Nokta için zoom`);
      } else {
        // Diğer geometriler için fit kullan
        view.fit(extent, {
          padding: [20, 20, 20, 20],
          duration: 500, // Animasyon süresini kısalt
          easing: (t: number) => t // Linear easing kullan
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
  }, [zoomToGeometry]);

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
          },
          renderBuffer: 50, // Render buffer'ı artır
          updateWhileAnimating: true, // Animasyon sırasında güncellemeyi aç
          updateWhileInteracting: true, // Etkileşim sırasında güncellemeyi aç
          zIndex: 1
        });
        
        // Popup overlay oluştur
        if (popupRef.current) {
          popupOverlayRef.current = new Overlay({
            element: popupRef.current
          });
        }

        mapInstance.current = new Map({
          target: mapRef.current,
        layers: [
          new TileLayer({ 
            source: new OSM(),
            zIndex: 0
          }),
          vectorLayer,
        ],
        overlays: popupOverlayRef.current ? [popupOverlayRef.current] : [],
        interactions: defaultInteractions({
          doubleClickZoom: true,
          dragPan: true,
          mouseWheelZoom: true,
          pinchZoom: true,
          keyboard: true
        }),
        view: new View({
          center: transform([0, 0], 'EPSG:4326', 'EPSG:3857'), // Merkezi doğru projection'da ayarla
          zoom: 2,
          projection: 'EPSG:3857', // Açıkça projection belirt
          enableRotation: false, // Rotasyonu kapat
          constrainOnlyCenter: true, // Sadece merkezi sınırla
          multiWorld: false // Çoklu dünya desteğini kapat
        }),
        pixelRatio: window.devicePixelRatio || 1 // Device pixel ratio kullan
      });

        // Mouse hover event'leri ekle
        let currentFeature: any = null;
        
        // Zoom event'lerini kaldır - titreşime neden oluyor
        // mapInstance.current.getView().on('change:resolution', () => {
        //   isZooming = true;
        //   if (popupOverlayRef.current) {
        //     popupOverlayRef.current.setPosition(undefined);
        //     setPopupContent(null);
        //   }
        // });
        
        // mapInstance.current.getView().on('change:center', () => {
        //   setTimeout(() => {
        //     isZooming = false;
        //   }, 1000);
        // });
        
        // Mouse hover event'leri ekle - optimize edilmiş
        let isZooming = false;
        let hoverTimeout: number | null = null;
        
        // Zoom durumunu takip et
        mapInstance.current.getView().on('change:resolution', () => {
          isZooming = true;
          // Zoom sırasında popup'ı gizle
          if (popupOverlayRef.current) {
            popupOverlayRef.current.setPosition(undefined);
            setPopupContent(null);
          }
          // Zoom bittikten sonra popup'ı tekrar göster
          setTimeout(() => {
            isZooming = false;
          }, 300);
        });
        
        mapInstance.current.on('pointermove', (evt) => {
          // Zoom sırasında hover işlemini yapma
          if (isZooming) {
            return;
          }
          
          // Hover timeout'unu temizle
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
          }
          
          // Hover işlemini geciktir
          hoverTimeout = window.setTimeout(() => {
            const feature = mapInstance.current!.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
            
            // Popup'ın üzerindeyse hiçbir şey yapma
            if (popupRef.current && popupRef.current.contains(evt.originalEvent.target as Node)) {
              return;
            }
            
            // Eğer aynı feature üzerindeyse hiçbir şey yapma
            if (feature === currentFeature) {
              return;
            }
            
            currentFeature = feature;
            
            // Hover işlemini yap
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
          }, 50); // 50ms gecikme
        });

        // Mouse wheel event'ini test et
        mapRef.current.addEventListener('wheel', (e) => {
          // Zoom sırasında gereksiz log'ları kaldır
        });

        // Harita yüklenme kontrolü
        mapInstance.current.on('rendercomplete', () => {
          setMapInitialized(true);
          setMapError(null);
        });

        // Harita hazır
        setMapInitialized(true);

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
      // Timeout'ları temizle
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
    if (!mapInstance.current || !vectorSourceRef.current) {
      return;
    }
    
    console.log(`🎨 Çizim modu durumu: ${geometryType ? 'Aktif' : 'Pasif'}`);
    
    // Mevcut çizim interaction'ını kaldır
    if (drawRef.current) {
      mapInstance.current.removeInteraction(drawRef.current);
      drawRef.current = null;
      console.log("🗑️ Çizim interaction'ı kaldırıldı");
    }
    
    // Sadece geometryType varsa ve boş string değilse çizim interaction'ı ekle
    if (geometryType && geometryType.trim() !== "") {
      try {
      drawRef.current = new Draw({
        source: vectorSourceRef.current,
        type: geometryType as any,
          style: createFeatureStyle(new Feature(), geometryType)
      });
      mapInstance.current.addInteraction(drawRef.current);
      console.log(`✅ Çizim interaction'ı eklendi: ${geometryType}`);
        
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
            
            // WKT'nin geçerli olup olmadığını kontrol et
            if (!wkt || wkt.length < 10) {
              console.error('❌ Geçersiz WKT oluşturuldu:', wkt);
              return;
            }
            
            // WKT'yi doğrudan kullan
            const finalWkt = wkt;
            
            console.log(`🎨 Çizilen geometri WKT:`, {
              type: geometryType,
              originalWkt: wkt,
              finalWkt: finalWkt,
              wktLength: wkt.length,
              isValid: wkt && wkt.length > 10
            });
            
            console.log(`🎨 Çizilen geometriye stil uygulandı:`, {
              type: geometryType,
              hasStyle: !!feature.getStyle(),
              isPoint: geometryType === 'Point',
              usingIcon: geometryType === 'Point' ? 'pin.png' : false
            });
            
            // Draw interaction'ı zaten feature'ı otomatik olarak ekliyor
            console.log(`✅ Çizilen feature hazır:`, {
              type: geometryType,
              geometry: feature.getGeometry()?.getType(),
              coordinates: (feature.getGeometry() as any)?.getCoordinates?.()
            });
            
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
  }, [geometryType, onDrawEnd]);

  return (
    <div style={{ 
      width: "100%", 
      height: "100%", 
      minHeight: 0, 
      position: "relative",
      overflow: "hidden", // Overflow'u gizle
      pointerEvents: !popupOpen ? "auto" : "none" // Popup açıkken mouse event'leri engelle
    }}>
      <div 
        ref={mapRef} 
        className="ol-map-container" 
        style={{ 
          width: "100%", 
          height: "100%", 
          minHeight: 0,
          willChange: "transform", // GPU hızlandırma
          backfaceVisibility: "hidden", // Backface'i gizle
          pointerEvents: !popupOpen ? "auto" : "none" // Popup açıkken mouse event'leri engelle
        }} 
      />
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
