
import React, { useState, useEffect } from "react";
import { getAllGeometries, addGeometry, deleteGeometry, updateGeometry } from "./api";
import { getAddressFromWkt } from "./utils/geocodingUtils";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Sidebar from "./components/Sidebar";
import GeometryTypeSelector from "./components/GeometryTypeSelector";
import SearchBar from "./components/SearchBar";
import SimpleMap from "./components/SimpleMap";
import PointFormModal from "./components/PointFormModal";
import GeometryListModal from "./components/GeometryListModal";
import "./App.css";

const App: React.FC = () => {

  const [geometryType, setGeometryType] = useState("Point");
  const [search, setSearch] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [drawnWkt, setDrawnWkt] = useState("");
  const [popupType, setPopupType] = useState("Point");
  const [listModalOpen, setListModalOpen] = useState(false);
  const [zoomToGeometry, setZoomToGeometry] = useState<{wkt: string, name: string} | null>(null);


  const [geometries, setGeometries] = useState<{
    id?: string | number; 
    wkt: string; 
    name?: string; 
    type?: string; 
    highlighted?: boolean;
    phone?: string;
    description?: string;
    fullAddress?: string;
    photoBase64?: string;
    openingHours?: string;
  }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Debug için state değişikliklerini takip et
  useEffect(() => {
    console.log(`🔍 Debug - addMode: ${addMode}, popupOpen: ${popupOpen}, geometryType: ${addMode && !popupOpen ? geometryType : ""}`);
  }, [addMode, popupOpen, geometryType]);

  // Geometrileri çek
  useEffect(() => {
    console.log("Geometriler yükleniyor...");
    getAllGeometries()
      .then((res) => {
        console.log("API yanıtı:", res);
        const geometryData = res.data || res || [];
        console.log("Geometri verisi:", geometryData);
        console.log("Geometri sayısı:", geometryData.length);
        
        if (geometryData.length > 0) {
          console.log("🔍 Backend'den gelen geometri verileri analizi:");
          geometryData.forEach((g: any, index: number) => {
            console.log(`📍 Geometri ${index + 1}:`, {
              name: g.name,
              type: g.type,
              wkt: g.wkt?.substring(0, 50) + "...",
              hasPolygonType: g.type === 'Polygon',
              hasPolygonWkt: g.wkt && g.wkt.toUpperCase().startsWith('POLYGON'),
              willBeProcessed: g.type === 'Polygon' || (g.wkt && g.wkt.toUpperCase().startsWith('POLYGON'))
            });
          });
          
          const polygonCount = geometryData.filter((g: any) => 
            g.type === 'Polygon' || (g.wkt && g.wkt.toUpperCase().startsWith('POLYGON'))
          ).length;
          
          console.log(`📊 Toplam ${geometryData.length} geometri, bunlardan ${polygonCount} tanesi polygon olarak işlenecek`);
        }
        
        setGeometries(geometryData);
        setError(null);
      })
      .catch((err) => {
        console.warn("Backend bağlantısı başarısız:", err.message);
        setError(err.message);
        // Backend bağlantısı olmasa da harita çalışsın
        setGeometries([]);
      });
  }, []);

  const handleAdd = () => {
    setAddMode(true);
  };

  const handleList = () => {
    // List modal'ını aç
    setListModalOpen(true);
  };

  // Test fonksiyonu kaldırıldı - gerçek veriler kullanılacak

  const refreshGeometries = async () => {
    console.log("🔄 Geometriler yenileniyor...");
    try {
      const res = await getAllGeometries();
      console.log("🔄 API Response:", res);
      
      const geometryData = res.data || res || [];
      console.log("📊 Yeni geometri verisi:", geometryData);
      console.log("📊 Geometri sayısı:", geometryData.length);
      
      setGeometries(geometryData);
      setError(null);
      
      console.log(`✅ ${geometryData.length} geometri başarıyla yüklendi`);
      
      // Test geometrisi ekle (eğer hiç geometri yoksa)
      if (geometryData.length === 0) {
        console.log("📍 Test geometrisi ekleniyor...");
        const testGeometry = {
          name: "Test Nokta",
          type: "Point", 
          wkt: "POINT(32.8597 39.9334)" // Ankara koordinatları
        };
        setGeometries([testGeometry]);
        console.log("📍 Test geometrisi eklendi:", testGeometry);
      }
      
    } catch (err: any) {
      console.warn("❌ Geometriler yüklenirken hata:", err.message);
      setError(err.message);
    }
  };

  const handleSearch = () => {
    if (!search.trim()) {
      toast.warning("Lütfen arama yapılacak bir metin girin!");
      return;
    }
    
    console.log("🔍 Arama yapılıyor:", search);
    
    // Geometriler içinde arama yap
    const searchResults = geometries.filter(geometry => 
      geometry.name?.toLowerCase().includes(search.toLowerCase()) ||
      geometry.type?.toLowerCase().includes(search.toLowerCase()) ||
      geometry.fullAddress?.toLowerCase().includes(search.toLowerCase()) ||
      geometry.description?.toLowerCase().includes(search.toLowerCase())
    );
    
    console.log("🎯 Arama sonuçları:", searchResults);
    
    if (searchResults.length === 0) {
      toast.error(`"${search}" için sonuç bulunamadı!`);
      return;
    }
    
    // İlk sonuca odaklan ve zoom yap
    const firstResult = searchResults[0];
    console.log("📍 İlk sonuca odaklanılıyor:", firstResult);
    
    // Arama sonuçlarını highlights için state'e set et
    setGeometries(prev => prev.map(g => ({
      ...g,
      highlighted: searchResults.some(result => result === g)
    })));
    
    // İlk sonuca zoom yap
    if (firstResult.wkt) {
      setTimeout(() => {
        setZoomToGeometry({ 
          wkt: firstResult.wkt, 
          name: firstResult.name || 'Arama Sonucu' 
        });
        
        // 3 saniye sonra zoom state'ini temizle
        setTimeout(() => {
          setZoomToGeometry(null);
          console.log('🧹 Arama zoom state temizlendi');
        }, 3000);
      }, 200);
    }
    
    toast.success(`🎯 ${searchResults.length} sonuç bulundu: ${searchResults.map(r => r.name || 'İsimsiz').join(", ")}. İlk sonuca zoom yapılıyor...`);
    
    // 10 saniye sonra highlight'ları temizle
    setTimeout(() => {
      setGeometries(prev => prev.map(g => ({
        ...g,
        highlighted: false
      })));
      console.log('🧹 Arama highlightlari temizlendi');
    }, 10000);
  };

  // Çizim tamamlandığında popup aç
  const handleDrawEnd = (wkt: string) => {
    setDrawnWkt(wkt);
    setPopupType(geometryType);
    setPopupOpen(true);
    setAddMode(false);
  };

     // Geometri silme fonksiyonu
   const handleDeleteGeometry = async (id: number) => {
     if (!confirm("Bu geometriyi silmek istediğinizden emin misiniz?")) {
       return;
     }
     
     try {
       console.log("🗑️ Geometri siliniyor, ID:", id);
       toast.info("🗑️ Geometri siliniyor...");
       
       const result = await deleteGeometry(id);
       console.log("🗑️ Silme sonucu:", result);
       
       // Frontend'den kaldır - Bu haritayı otomatik olarak güncelleyecek
       setGeometries(prev => {
         const newGeometries = prev.filter(g => g.id !== id);
         console.log("🗑️ Frontend'den kaldırıldı, yeni liste uzunluğu:", newGeometries.length);
         return newGeometries;
       });
       console.log("✅ Geometri başarıyla silindi");
       
       toast.success("✅ Geometri başarıyla silindi!");
       
     } catch (error) {
       console.error("❌ Geometri silinirken hata:", error);
       console.error("❌ Hata tipi:", typeof error);
       console.error("❌ Hata mesajı:", (error as any)?.message);
       console.error("❌ Hata stack:", (error as any)?.stack);
       
       // Daha detaylı hata mesajı
       let errorMessage = "❌ Geometri silinirken bir hata oluştu!";
       if ((error as any)?.message) {
         errorMessage += ` (${(error as any).message})`;
       }
       
       toast.error(errorMessage);
     }
   };

   // Geometri güncelleme fonksiyonu - İlerde kullanılacak
   const handleUpdateGeometry = (geometry: any) => {
     console.log("✏️ Geometri güncelleniyor:", geometry);
     
     // Düzenlenecek geometriyi set et
     setEditingGeometry(geometry);
     // Güncelleme modal'ını aç
     setDrawnWkt(geometry.wkt);
     setPopupType(geometry.type || "Point");
     setPopupOpen(true);
     setAddMode(false);
   };

   // Güncelleme işlemi için state
   const [editingGeometry, setEditingGeometry] = useState<any>(null);

   // Geometri taşıma fonksiyonu - Şekil olarak hareket eder
   const handleMoveGeometry = async (id: number, newWkt: string) => {
     console.log("🖐️ Geometri şekil taşıma tamamlandı, ID:", id);
     console.log("🔄 Yeni WKT:", newWkt);
     
     try {
       // Mevcut geometri verilerini bul
       const existingGeometry = geometries.find(g => g.id === id);
       if (!existingGeometry) {
         throw new Error("Mevcut geometri bulunamadı!");
       }
       
       console.log("📋 Mevcut geometri verileri:", {
         id: existingGeometry.id,
         name: existingGeometry.name,
         type: existingGeometry.type,
         phone: existingGeometry.phone,
         description: existingGeometry.description,
         fullAddress: existingGeometry.fullAddress,
         photoBase64: existingGeometry.photoBase64 ? "Var" : "Yok",
         openingHours: existingGeometry.openingHours,
         wkt: existingGeometry.wkt?.substring(0, 50) + "..."
       });
       
       // Yeni WKT'den adres bilgisini al
       console.log("🌍 Yeni konumdan adres alınıyor...");
       const newAddress = await getAddressFromWkt(newWkt);
       
       let newFullAddress = existingGeometry.fullAddress || "";
       if (newAddress) {
         newFullAddress = newAddress.displayName;
         console.log("✅ Yeni adres bulundu:", newFullAddress);
       } else {
         console.log("⚠️ Yeni adres bulunamadı, mevcut adres korunuyor");
       }
       
       // Sadece WKT ve adres güncelle, diğer alanları değiştirme
       const updateData = {
         name: existingGeometry.name || "",
         type: existingGeometry.type || "Point",
         phone: existingGeometry.phone || "", // null ise boş string
         description: existingGeometry.description || "", // null ise boş string
         fullAddress: newFullAddress, // Yeni adres
         photoBase64: existingGeometry.photoBase64 || "", // null ise boş string
         openingHours: existingGeometry.openingHours || "", // null ise boş string
         wkt: newWkt // Yeni WKT
       };
       
       console.log("📤 Güncellenecek veriler:", {
         name: updateData.name,
         type: updateData.type,
         phone: updateData.phone,
         description: updateData.description,
         fullAddress: updateData.fullAddress,
         photoBase64: updateData.photoBase64 ? "Var" : "Yok",
         openingHours: updateData.openingHours,
         wkt: updateData.wkt?.substring(0, 50) + "..."
       });
       
       // Backend'e güncelleme gönder
       await updateGeometry(id, updateData);
       console.log("✅ Backend güncelleme başarılı");
       
       // Geometrileri yenile - yeni konumları al
       await refreshGeometries();
       
       // Geometri tipine göre farklı mesaj göster
       const geometryType = existingGeometry.type;
       let successMessage = "";
       if (geometryType === 'Point') {
         successMessage = "📍 Nokta başarıyla yeni konuma taşındı!";
       } else if (geometryType === 'LineString') {
         successMessage = "📏 Çizgi başarıyla şekil olarak yeni konuma taşındı!";
       } else if (geometryType === 'Polygon') {
         successMessage = "🔷 Alan başarıyla şekil olarak yeni konuma taşındı!";
       } else {
         successMessage = "Geometri başarıyla taşındı!";
       }
       
       toast.success(successMessage + " Adres bilgisi güncellendi.");
       
     } catch (error) {
       console.error("❌ Geometri güncelleme hatası:", error);
       toast.error("❌ Geometri güncellenirken hata oluştu!");
     }
   };

   // List modal handler fonksiyonları
   const handleListEdit = (geometry: any) => {
     console.log("✏️ List modal'dan düzenleme:", geometry);
     setEditingGeometry(geometry); // Düzenlenecek geometriyi set et
     setDrawnWkt(geometry.wkt);
     setPopupType(geometry.type || "Point");
     setPopupOpen(true);
     setListModalOpen(false);
   };

   const handleListZoomTo = (geometry: any) => {
     console.log("👁️ List modal'dan zoom:", geometry);
     setListModalOpen(false);
     // Modal kapandıktan sonra zoom işlemini yap
     setTimeout(() => {
       setZoomToGeometry({ wkt: geometry.wkt, name: geometry.name });
       
       // 3 saniye sonra zoom state'ini temizle
       setTimeout(() => {
         setZoomToGeometry(null);
         console.log('🧹 Zoom state temizlendi');
       }, 3000);
     }, 100);
   };

   const handleListDelete = (id: number) => {
     console.log("🗑️ List modal'dan silme:", id);
     handleDeleteGeometry(id);
     // List modal'ı kapatmaya gerek yok, modal kendi içinde yenileyecek
   };

  return (
    <div className="app-layout">
      <Sidebar onAdd={handleAdd} onList={handleList} />
      <main className="main-content">
        <div className="top-bar">
          <GeometryTypeSelector value={geometryType} onChange={setGeometryType} />
          <SearchBar value={search} onChange={setSearch} onSearch={handleSearch} />
        </div>
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          {error && (
            <div style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "#ff9800",
              color: "white",
              padding: "12px",
              borderRadius: "6px",
              zIndex: 1000,
              fontSize: "14px",
              maxWidth: "400px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}>
              <strong>Uyarı:</strong> {error}
              <button 
                onClick={() => setError(null)}
                style={{
                  marginLeft: "10px",
                  background: "transparent",
                  border: "1px solid white",
                  color: "white",
                  padding: "2px 8px",
                  borderRadius: "3px",
                  cursor: "pointer"
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Simple Map Test - Back to working version */}
          <SimpleMap 
            geometries={geometries}
            geometryType={addMode && !popupOpen ? geometryType : ""}
            onDrawEnd={handleDrawEnd}
            onDeleteGeometry={handleDeleteGeometry}
            onUpdateGeometry={handleUpdateGeometry}
            onMoveGeometry={handleMoveGeometry}
            zoomToGeometry={zoomToGeometry}
          />
          
          {/* Original Map - Temporarily disabled until fixed */}
          {/* 
          <ErrorBoundary>
            <MapView
              key={`map-${Date.now()}`}
              geometryType={addMode && !popupOpen ? geometryType : ""}
              onDrawEnd={handleDrawEnd}
              geometries={geometries}
              zoomToGeometry={zoomToGeometry}
              onDeleteGeometry={handleDeleteGeometry}
              onUpdateGeometry={handleUpdateGeometry}
              onMoveGeometry={handleMoveGeometry}
            />
          </ErrorBoundary>
          */}
        </div>
        <PointFormModal
          open={popupOpen}
          wkt={drawnWkt}
          type={popupType}
          editingGeometry={editingGeometry}
          onClose={() => {
            setPopupOpen(false);
            setEditingGeometry(null); // Modal kapandığında editing state'ini temizle
            setAddMode(false); // Modal kapandığında çizim modunu kapat
          }}
          onSave={async (data) => {
            try {
              if (editingGeometry) {
                // Güncelleme işlemi
                console.log("🔄 Geometri güncelleniyor:", editingGeometry.id);
                const response = await updateGeometry(editingGeometry.id, {
                  name: data.name,
                  fullAddress: data.fullAddress,
                  phone: data.phone,
                  photoBase64: data.photoBase64,
                  description: data.description,
                  openingHours: data.openingHours,
                  wkt: data.wkt,
                  type: data.type
                });
                console.log("✅ Geometri başarıyla güncellendi, response:", response);
                

                setEditingGeometry(null);
              } else {
                // Yeni kayıt işlemi
                console.log("➕ Yeni geometri ekleniyor");
                const response = await addGeometry({
                  name: data.name,
                  fullAddress: data.fullAddress,
                  phone: data.phone,
                  photoBase64: data.photoBase64,
                  description: data.description,
                  openingHours: data.openingHours,
                  wkt: data.wkt,
                  type: data.type
                });
                console.log("✅ Yeni geometri başarıyla eklendi, response:", response);
                

              }
              
              setPopupOpen(false);
              setAddMode(false); // İşlem tamamlandığında çizim modunu kapat
              // İşlem sonrası geometrileri yenile
              console.log('🔄 Geometriler yenileniyor...');
              await refreshGeometries();
              console.log('✅ Geometri işlemi tamamlandı ve liste güncellendi');
            } catch (err: any) {
              setError(err.message);
            }
          }}
        />
        
        {/* Geometri Listesi Modal */}
        <GeometryListModal
          isOpen={listModalOpen}
          onClose={() => setListModalOpen(false)}
          onEdit={handleListEdit}
          onZoomTo={handleListZoomTo}
          onDelete={handleListDelete}
        />
      </main>
      
      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </div>
  );
};

export default App;
