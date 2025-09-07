const API_BASE = "https://localhost:7136/api/Geometry";

export async function getAllGeometries() {
  try {
    const res = await fetch(API_BASE);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Veriler alınamadı`);
    }
    
    const data = await res.json();
    
    // Backend'den gelen veri formatını normalize et
    let geometries = data;
    
    // Eğer data.data varsa onu kullan
    if (data.data && Array.isArray(data.data)) {
      geometries = data.data;
    }
    // Eğer data kendisi array ise
    else if (Array.isArray(data)) {
      geometries = data;
    }
    // Eğer tek bir object ise array'e çevir
    else if (data && typeof data === 'object') {
      geometries = [data];
    }
    
    return { data: geometries };
    
  } catch (error) {
    console.error("❌ API hatası:", error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error("Sunucuya bağlanılamadı. Lütfen backend servisinin çalıştığını kontrol edin.");
    }
    throw error;
  }
}

export async function addGeometry(data: { 
  name: string; 
  fullAddress: string; 
  phone: string; 
  photoBase64: string; 
  description: string; 
  openingHours: string; 
  wkt: string; 
  type: string; 
}) {
  try {
    const requestBody = {
      name: data.name,
      fullAddress: data.fullAddress,
      phone: data.phone,
      photoBase64: data.photoBase64,
      description: data.description,
      openingHours: data.openingHours,
      wkt: data.wkt,
      type: data.type,
      // GeometryMetrics alanları - backend'de otomatik hesaplanmalı
      area: 0,
      length: 0,
      centroid: null,
      boundingBox: null,
      startPoint: null,
      endPoint: null
    };

    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    
    const responseData = await res.json();
    return responseData;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error("Sunucuya bağlanılamadı. Lütfen backend servisinin çalıştığını kontrol edin.");
    }
    throw error;
  }
}

export async function deleteGeometry(id: number) {
  try {
    const url = `${API_BASE}/${id}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });

    // 204 No Content da başarılı kabul edilir (silme işlemlerinde sık kullanılır)
    if (!res.ok && res.status !== 204) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    // 204 durumunda response body olmayabilir
    if (res.status === 204) {
      return { success: true, message: "Geometri başarıyla silindi" };
    }

    // Diğer başarılı durumlar için JSON parse et
    const responseData = await res.json();

    return responseData;

  } catch (error) {
    throw error;
  }
}

export async function updateGeometry(id: number, data: { 
  name?: string; 
  fullAddress?: string; 
  phone?: string; 
  photoBase64?: string; 
  description?: string; 
  openingHours?: string; 
  wkt?: string; 
  type?: string; 
}) {
  try {
    console.log("🔄 Geometri güncelleme isteği gönderiliyor: ID", id);
    console.log("📤 Güncellenecek veriler:", data);

    const url = `${API_BASE}/${id}`;
    console.log("🌐 Güncelleme URL'i:", url);

    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    console.log("📥 Güncelleme API yanıt durumu:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Güncelleme API hata detayı:", errorText);
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const responseData = await res.json();
    console.log("✅ Güncelleme API başarılı yanıt:", responseData);

    return responseData;

  } catch (error) {
    console.error("❌ Güncelleme API hatası:", error);
    throw error;
  }
}

export async function getGeometriesWithPagination(page: number = 1, pageSize: number = 10, searchTerm?: string, selectedType?: string) {
  try {
    console.log("🌐 Server-side Pagination API isteği gönderiliyor");
    console.log("📄 Sayfa:", page, "Sayfa boyutu:", pageSize);
    
    // Backend'inizin URL formatına uygun endpoint
    let url = `${API_BASE}/${page}/${pageSize}`;
    
    console.log("🌐 Pagination URL:", url);
    
    const res = await fetch(url);
    console.log("📥 API yanıt durumu:", res.status);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Veriler alınamadı`);
    }
    
    const data = await res.json();
    console.log("📋 Ham API verisi:", data);
    
    // Backend'den gelen Response<List<GeometryDto>> formatını işle
    let geometries = [];
    let totalCount = 0;
    let totalPages = 1;
    
    // Backend Response formatı kontrol et
    if (data.success && data.data && Array.isArray(data.data)) {
      geometries = data.data;
      totalCount = data.data.length; // Backend'den total bilgisi gelmiyorsa sadece mevcut sayfa
      totalPages = Math.ceil(totalCount / pageSize);
    }
    // Direkt data array'i gelirse
    else if (Array.isArray(data)) {
      geometries = data;
      totalCount = data.length;
      totalPages = Math.ceil(totalCount / pageSize);
    }
    // Tek object gelirse
    else if (data && typeof data === 'object') {
      geometries = [data];
      totalCount = 1;
      totalPages = 1;
    }
    
    // Client-side filtreleme (backend filtreleme yoksa)
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      geometries = geometries.filter((geometry: any) => 
        (geometry.name && geometry.name.toLowerCase().includes(searchLower)) ||
        (geometry.fullAddress && geometry.fullAddress.toLowerCase().includes(searchLower)) ||
        (geometry.description && geometry.description.toLowerCase().includes(searchLower))
      );
    }
    
    if (selectedType && selectedType !== 'all') {
      geometries = geometries.filter((geometry: any) => 
        geometry.type && geometry.type.toLowerCase() === selectedType.toLowerCase()
      );
    }
    
    console.log("� Filtrelenmiş geometri sayısı:", geometries.length);
    console.log("📄 Tahmini toplam sayfa:", totalPages);
    
    return { 
      data: geometries,
      totalCount: geometries.length,
      currentPage: page,
      pageSize: pageSize,
      totalPages: Math.max(1, Math.ceil(geometries.length / pageSize))
    };
    
  } catch (error) {
    console.error("❌ Pagination API hatası:", error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error("Sunucuya bağlanılamadı. Lütfen backend servisinin çalıştığını kontrol edin.");
    }
    throw error;
  }
}

// Diğer API fonksiyonları (ara) eklenebilir
