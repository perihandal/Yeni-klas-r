/**
 * OpenStreetMap Nominatim ile reverse geocoding (koordinatlardan adres alma)
 */

export interface GeocodingResult {
  displayName: string;
  address: {
    country?: string;
    state?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    district?: string;
    neighbourhood?: string;
    road?: string;
    houseNumber?: string;
    postcode?: string;
  };
  lat: string;
  lon: string;
}

/**
 * Koordinatlardan adres bilgisini alır
 * @param lat Enlem
 * @param lon Boylam
 * @returns Adres bilgisi
 */
export async function getAddressFromCoords(lat: number, lon: number): Promise<GeocodingResult | null> {
  try {
    console.log('🌍 Adres sorgulanıyor:', { lat, lon });
    
    // Nominatim API'sine istek gönder
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=tr,en`,
      {
        headers: {
          'User-Agent': 'MapApp/1.0' // Nominatim için gerekli
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Adres alınamadı`);
    }
    
    const data = await response.json();
    
    if (!data || !data.display_name) {
      console.warn('⚠️ Adres bulunamadı:', { lat, lon });
      return null;
    }
    
    const result: GeocodingResult = {
      displayName: data.display_name,
      address: data.address || {},
      lat: data.lat,
      lon: data.lon
    };
    
    console.log('✅ Adres bulundu:', {
      displayName: result.displayName,
      city: result.address.city || result.address.town || result.address.village,
      district: result.address.district || result.address.county,
      country: result.address.country
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Geocoding hatası:', error);
    return null;
  }
}

/**
 * WKT string'inden koordinatları çıkarır (Point için)
 * @param wkt WKT string (örn: "POINT(28.9784 41.0082)")
 * @returns Koordinat objesi
 */
export function extractCoordsFromWkt(wkt: string): { lat: number; lon: number } | null {
  try {
    if (!wkt || typeof wkt !== 'string') {
      return null;
    }
    
    // POINT formatını parse et
    const pointMatch = wkt.match(/POINT\s*\(\s*([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*\)/i);
    if (pointMatch) {
      const lon = parseFloat(pointMatch[1]);
      const lat = parseFloat(pointMatch[2]);
      return { lat, lon };
    }
    
    // POLYGON formatından merkez nokta çıkar (basit yaklaşım)
    const polygonMatch = wkt.match(/POLYGON\s*\(\s*\(\s*([^)]+)\s*\)/i);
    if (polygonMatch) {
      const coordsString = polygonMatch[1];
      const coords = coordsString.split(',').map(coord => {
        const [lon, lat] = coord.trim().split(/\s+/);
        return { lat: parseFloat(lat), lon: parseFloat(lon) };
      });
      
      // Basit merkez hesaplama (tüm noktaların ortalaması)
      const centerLat = coords.reduce((sum, coord) => sum + coord.lat, 0) / coords.length;
      const centerLon = coords.reduce((sum, coord) => sum + coord.lon, 0) / coords.length;
      
      return { lat: centerLat, lon: centerLon };
    }
    
    // LINESTRING formatından merkez nokta çıkar
    const lineStringMatch = wkt.match(/LINESTRING\s*\(\s*([^)]+)\s*\)/i);
    if (lineStringMatch) {
      const coordsString = lineStringMatch[1];
      const coords = coordsString.split(',').map(coord => {
        const [lon, lat] = coord.trim().split(/\s+/);
        return { lat: parseFloat(lat), lon: parseFloat(lon) };
      });
      
      // LineString'in merkez noktasını hesapla (tüm noktaların ortalaması)
      const centerLat = coords.reduce((sum, coord) => sum + coord.lat, 0) / coords.length;
      const centerLon = coords.reduce((sum, coord) => sum + coord.lon, 0) / coords.length;
      
      console.log('📍 LineString merkez noktası:', { lat: centerLat, lon: centerLon });
      return { lat: centerLat, lon: centerLon };
    }
    
    console.warn('⚠️ WKT formatı desteklenmiyor:', wkt.substring(0, 50));
    return null;
    
  } catch (error) {
    console.error('❌ WKT parse hatası:', error);
    return null;
  }
}

/**
 * WKT'den otomatik adres alır
 * @param wkt WKT string
 * @returns Adres bilgisi
 */
export async function getAddressFromWkt(wkt: string): Promise<GeocodingResult | null> {
  const coords = extractCoordsFromWkt(wkt);
  if (!coords) {
    return null;
  }
  
  return await getAddressFromCoords(coords.lat, coords.lon);
}

/**
 * Test fonksiyonu - İstanbul koordinatları ile test
 */
export async function testGeocoding(): Promise<void> {
  console.log('🧪 Geocoding test başlatılıyor...');
  
  // İstanbul Sultanahmet koordinatları
  const testCoords = { lat: 41.0082, lon: 28.9784 };
  
  try {
    const result = await getAddressFromCoords(testCoords.lat, testCoords.lon);
    if (result) {
      console.log('✅ Test başarılı:', result);
    } else {
      console.log('❌ Test başarısız: Adres bulunamadı');
    }
  } catch (error) {
    console.error('❌ Test hatası:', error);
  }
}
