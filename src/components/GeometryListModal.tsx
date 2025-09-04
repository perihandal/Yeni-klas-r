import React, { useState, useEffect } from 'react';
import { getGeometriesWithPagination, deleteGeometry } from '../api';
import './GeometryListModal.css';

interface GeometryItem {
  id?: string | number;
  name?: string;
  type?: string;
  wkt: string;
  fullAddress?: string;
  phone?: string;
  description?: string;
  photoBase64?: string;
  openingHours?: string;
}

interface GeometryListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: (geometry: GeometryItem) => void;
  onZoomTo: (geometry: GeometryItem) => void;
  onDelete: (id: number) => void;
}

const GeometryListModal: React.FC<GeometryListModalProps> = ({
  isOpen,
  onClose,
  onEdit,
  onZoomTo,
  onDelete
}) => {
  const [geometries, setGeometries] = useState<GeometryItem[]>([]);
  const [filteredGeometries, setFilteredGeometries] = useState<GeometryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Geometrileri yükle
  const loadGeometries = async (page: number = 1) => {
    setLoading(true);
    try {
      const response = await getGeometriesWithPagination(page, pageSize, searchTerm, selectedType);
      console.log('📋 Pagination API yanıtı:', response);
      console.log('📋 Gelen geometriler:', response.data);
      
      // Her geometrinin detaylarını logla
      if (response.data && response.data.length > 0) {
        response.data.forEach((geo: any, index: number) => {
          console.log(`📍 Geometri ${index + 1}:`, {
            id: geo.id,
            name: geo.name,
            type: geo.type,
            fullAddress: geo.fullAddress,
            phone: geo.phone,
            description: geo.description,
            openingHours: geo.openingHours,
            photoBase64: geo.photoBase64 ? 'Var' : 'Yok'
          });
          
          // ID kontrolü
          if (!geo.id) {
            console.warn(`⚠️ Geometri ${index + 1} için ID bulunamadı!`);
          }
        });
      }
      
      setGeometries(response.data || []);
      setFilteredGeometries(response.data || []);
      // API'den gelen totalPages bilgisini kullan
      setTotalPages(response.totalPages || Math.ceil((response.totalCount || 0) / pageSize));
      
      console.log(`📊 Sayfa ${page} yüklendi: ${response.data?.length || 0} geometri`);
      console.log(`📊 Toplam sayfa: ${response.totalPages}, Toplam kayıt: ${response.totalCount}`);
    } catch (error) {
      console.error('❌ Geometriler yüklenirken hata:', error);
      alert('Geometriler yüklenirken hata oluştu!');
    } finally {
      setLoading(false);
    }
  };

  // Modal açıldığında geometrileri yükle
  useEffect(() => {
    if (isOpen) {
      loadGeometries(currentPage);
    }
  }, [isOpen, currentPage]);

  // Filtreleme ve arama - Server-side pagination için yeniden yükle
  useEffect(() => {
    if (isOpen) {
      // Filtreleme değiştiğinde sayfa 1'e dön ve yeniden yükle
      setCurrentPage(1);
      loadGeometries(1);
    }
  }, [searchTerm, selectedType]);

  // Sayfa değiştirme
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Geometri silme
  const handleDelete = async (id: number) => {
    if (!id) {
      console.error('❌ Silme işlemi için geçerli ID bulunamadı!');
      alert('Bu geometri silinemez - ID bilgisi eksik!');
      return;
    }
    
    if (window.confirm('Bu geometriyi silmek istediğinizden emin misiniz?')) {
      try {
        await deleteGeometry(id);
        // Listeyi yenile
        loadGeometries(currentPage);
        onDelete(id);
      } catch (error) {
        console.error('❌ Silme hatası:', error);
        alert('Silme işlemi başarısız!');
      }
    }
  };

  // Geometri tipine göre ikon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Point': return '📍';
      case 'LineString': return '📏';
      case 'Polygon': return '🔷';
      default: return '📍';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="geometry-list-modal-overlay">
      <div className="geometry-list-modal-container">
        {/* Header */}
        <div className="geometry-list-modal-header">
          <div className="geometry-list-modal-header-content">
            <div className="geometry-list-modal-title">
              <span>🗺️</span>
              <h2>Geometri Listesi</h2>
            </div>
            <button
              onClick={onClose}
              className="geometry-list-modal-close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="geometry-list-modal-filters">
          <div className="geometry-list-modal-filters-content">
            {/* Arama */}
            <div className="geometry-list-modal-search">
              <span className="geometry-list-modal-search-icon">🔍</span>
              <input
                type="text"
                placeholder="İsim, adres veya açıklama ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="geometry-list-modal-search-input"
              />
            </div>

            {/* Tip Filtresi */}
            <div className="geometry-list-modal-filter-row">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="geometry-list-modal-type-select"
              >
                <option value="all">🎯 Tüm</option>
                <option value="Point">📍 Point</option>
                <option value="LineString">📏 Line</option>
                <option value="Polygon">🔷 Polygon</option>
              </select>

              {/* Yenile Butonu */}
              <button
                onClick={() => loadGeometries(currentPage)}
                disabled={loading}
                className="geometry-list-modal-refresh-btn"
              >
                {loading ? '🔄' : '🔄'}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="geometry-list-modal-content">
          {loading ? (
            <div className="geometry-list-modal-loading">
              <div className="text-center">
                <div className="geometry-list-modal-loading-spinner"></div>
                <div className="geometry-list-modal-loading-text">Geometriler yükleniyor...</div>
              </div>
            </div>
          ) : filteredGeometries.length === 0 ? (
            <div className="geometry-list-modal-empty">
              <div className="text-center">
                <div className="geometry-list-modal-empty-icon">🔍</div>
                <div className="geometry-list-modal-empty-title">Geometri bulunamadı</div>
                <div className="geometry-list-modal-empty-subtitle">Arama kriterlerinizi değiştirmeyi deneyin</div>
              </div>
            </div>
          ) : (
            <div className="geometry-list-modal-grid">
              {filteredGeometries.map((geometry, index) => (
                <div key={`${geometry.id || 'unknown'}-${index}`} className="geometry-list-modal-card">
                  {/* Kart Başlığı */}
                  <div className="geometry-list-modal-card-header">
                    <div className="geometry-list-modal-card-title">
                      <div className="geometry-list-modal-card-icon">
                        <div className="geometry-list-modal-card-icon-bg">
                          <span>{getTypeIcon(geometry.type || 'Point')}</span>
                        </div>
                        <div className="geometry-list-modal-card-info">
                          <h3>
                            {geometry.name || 'İsimsiz Geometri'}
                          </h3>
                          <span className={`geometry-list-modal-card-type ${geometry.type?.toLowerCase() || 'point'}`}>
                            {geometry.type || 'Point'}
                          </span>
                        </div>
                      </div>
                      <div className="geometry-list-modal-card-zoom">
                        <button
                          onClick={() => onZoomTo(geometry)}
                          title="Konuma zoom yap"
                        >
                          👁️
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Kart İçeriği */}
                  <div className="geometry-list-modal-card-body">
                                         {/* Fotoğraf */}
                     {geometry.photoBase64 && (
                       <div className="geometry-list-modal-card-field">
                         <span className="geometry-list-modal-card-field-icon">📷</span>
                         <div className="geometry-list-modal-card-field-content">
                           <p className="geometry-list-modal-card-field-label">Fotoğraf</p>
                           <div className="geometry-list-modal-card-photo">
                             <img 
                               src={geometry.photoBase64?.startsWith('data:') ? geometry.photoBase64 : `data:image/jpeg;base64,${geometry.photoBase64}`}
                               alt={geometry.name || 'Geometri fotoğrafı'}
                               className="geometry-list-modal-card-photo-img"
                               onLoad={() => {
                                 console.log('✅ Fotoğraf başarıyla yüklendi:', geometry.name);
                               }}
                               onError={(e) => {
                                 console.error('❌ Fotoğraf yüklenemedi:', geometry.name);
                                 console.error('❌ Base64 uzunluğu:', geometry.photoBase64?.length);
                                 console.error('❌ Base64 başlangıcı:', geometry.photoBase64?.substring(0, 50));
                                 console.error('❌ Kullanılan src:', geometry.photoBase64?.startsWith('data:') ? geometry.photoBase64 : `data:image/jpeg;base64,${geometry.photoBase64}`);
                                 e.currentTarget.style.display = 'none';
                                 // Fotoğraf yüklenemezse placeholder göster
                                 const placeholder = e.currentTarget.parentElement;
                                 if (placeholder) {
                                   placeholder.innerHTML = '<div class="geometry-list-modal-card-photo-placeholder">📷 Fotoğraf yüklenemedi</div>';
                                 }
                               }}
                             />
                           </div>
                         </div>
                       </div>
                     )}

                    {/* Adres */}
                    <div className="geometry-list-modal-card-field">
                      <span className="geometry-list-modal-card-field-icon">📍</span>
                      <div className="geometry-list-modal-card-field-content">
                        <p className="geometry-list-modal-card-field-label">Adres</p>
                        <p className="geometry-list-modal-card-field-value">
                          {geometry.fullAddress || 'Adres bilgisi yok'}
                        </p>
                      </div>
                    </div>

                    {/* Telefon */}
                    <div className="geometry-list-modal-card-field">
                      <span className="geometry-list-modal-card-field-icon">📞</span>
                      <div className="geometry-list-modal-card-field-content">
                        <p className="geometry-list-modal-card-field-label">Telefon</p>
                        <p className="geometry-list-modal-card-field-value">
                          {geometry.phone || 'Telefon bilgisi yok'}
                        </p>
                      </div>
                    </div>

                    {/* Açıklama */}
                    <div className="geometry-list-modal-card-field">
                      <span className="geometry-list-modal-card-field-icon">📝</span>
                      <div className="geometry-list-modal-card-field-content">
                        <p className="geometry-list-modal-card-field-label">Açıklama</p>
                        <p className="geometry-list-modal-card-field-value">
                          {geometry.description || 'Açıklama bilgisi yok'}
                        </p>
                      </div>
                    </div>

                    {/* Çalışma Saatleri */}
                    {geometry.openingHours && (
                      <div className="geometry-list-modal-card-field">
                        <span className="geometry-list-modal-card-field-icon">🕒</span>
                        <div className="geometry-list-modal-card-field-content">
                          <p className="geometry-list-modal-card-field-label">Çalışma Saatleri</p>
                          <p className="geometry-list-modal-card-field-value">
                            {geometry.openingHours}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Kart Alt Kısmı - İşlem Butonları */}
                  <div className="geometry-list-modal-card-actions">
                    <div className="geometry-list-modal-card-buttons">
                      <button
                        onClick={() => onEdit(geometry)}
                        className="geometry-list-modal-card-btn edit"
                        title="Düzenle"
                      >
                        ✏️ Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(Number(geometry.id))}
                        className="geometry-list-modal-card-btn delete"
                        title="Sil"
                      >
                        🗑️ Sil
                      </button>
                    </div>
                    <div className="geometry-list-modal-card-status">
                      <div className="geometry-list-modal-card-status-dot"></div>
                      <span className="geometry-list-modal-card-status-text">Aktif</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="geometry-list-modal-pagination">
            <div className="geometry-list-modal-page-info">
              Sayfa {currentPage} / {totalPages}
            </div>
            <div className="geometry-list-modal-page-buttons">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="geometry-list-modal-page-btn"
              >
                ← Önceki
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="geometry-list-modal-page-btn"
              >
                Sonraki →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeometryListModal;




