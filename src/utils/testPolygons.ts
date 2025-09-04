// Test için örnek polygon verileri
export const testPolygonData = [
  // Üst üste gelen 2 polygon - Ankara'da
  {
    id: 1,
    name: "Test Polygon 1",
    type: "Polygon",
    wkt: "POLYGON((32.8 39.9, 32.9 39.9, 32.9 40.0, 32.8 40.0, 32.8 39.9))"
  },
  {
    id: 2,
    name: "Test Polygon 2", 
    type: "Polygon",
    wkt: "POLYGON((32.85 39.95, 32.95 39.95, 32.95 40.05, 32.85 40.05, 32.85 39.95))"
  },
  
  // Ayrı bir polygon - İstanbul'da
  {
    id: 3,
    name: "İstanbul Polygon",
    type: "Polygon", 
    wkt: "POLYGON((28.9 41.0, 29.1 41.0, 29.1 41.1, 28.9 41.1, 28.9 41.0))"
  },
  
  // Üst üste gelen 3 polygon - İzmir'de
  {
    id: 4,
    name: "İzmir Polygon A",
    type: "Polygon",
    wkt: "POLYGON((27.1 38.4, 27.2 38.4, 27.2 38.5, 27.1 38.5, 27.1 38.4))"
  },
  {
    id: 5,
    name: "İzmir Polygon B", 
    type: "Polygon",
    wkt: "POLYGON((27.15 38.45, 27.25 38.45, 27.25 38.55, 27.15 38.55, 27.15 38.45))"
  },
  {
    id: 6,
    name: "İzmir Polygon C",
    type: "Polygon", 
    wkt: "POLYGON((27.12 38.42, 27.22 38.42, 27.22 38.52, 27.12 38.52, 27.12 38.42))"
  },
  
  // Normal point geometri
  {
    id: 7,
    name: "Test Point",
    type: "Point",
    wkt: "POINT(35.2433 38.9637)" // Kayseri
  },
  
  // Normal linestring geometri  
  {
    id: 8,
    name: "Test Line",
    type: "LineString",
    wkt: "LINESTRING(26.4142 39.6191, 27.1428 39.6434)" // Balıkesir-Manisa arası
  }
];

// Test verilerini konsola yazdıran fonksiyon
export function logTestResults() {
  console.log("🧪 Test Polygon Verileri:");
  console.log("Ankara'da üst üste gelen 2 polygon (birleşmeli)");
  console.log("İstanbul'da ayrı 1 polygon (tek kalmalı)");  
  console.log("İzmir'de üst üste gelen 3 polygon (birleşmeli)");
  console.log("Kayseri'de 1 point (etkilenmemeli)");
  console.log("Balıkesir-Manisa arası 1 line (etkilenmemeli)");
  console.log("Beklenen sonuç: 5 geometri (2 birleşik polygon + 1 tek polygon + 1 point + 1 line)");
}

// Manuel test için App.tsx'e eklenebilecek fonksiyon
export function loadTestData() {
  return testPolygonData;
}

