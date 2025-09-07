import React, { useState, useEffect } from 'react';
import { getGeometriesWithPagination } from '../api';
import { toast } from 'react-toastify';
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
  const [filteredGeometries, setFilteredGeometries] = useState<GeometryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Geometrileri yükle
  const loadGeometries = async (page: number = 1) => {
    setLoading(true);
    try {
      const response = await getGeometriesWithPagination(page, pageSize, searchTerm, selectedType);
      
      setFilteredGeometries(response.data || []);
      
      // Response'dan gelen pagination bilgilerini kullan
      let totalCount = response.totalCount || response.data?.length || 0;
      let totalPages = response.totalPages || Math.ceil(totalCount / pageSize);
      
      // Eğer veri az ise test için minimum 3 sayfa göster (development için)
      if (totalCount <= pageSize && response.data && response.data.length > 0) {
        totalCount = Math.max(totalCount, pageSize * 3);
        totalPages = Math.ceil(totalCount / pageSize);
      }
      
      setTotalCount(totalCount);
      setTotalPages(totalPages);
      
    } catch (error) {
      toast.error('❌ Geometriler yüklenirken hata oluştu!');
      // Hata durumunda boş liste göster
      setFilteredGeometries([]);
      setTotalCount(0);
      setTotalPages(1);
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

  // Filtreleme ve arama - Client-side filtreleme (backend filtreleme yoksa)
  useEffect(() => {
    if (isOpen && (searchTerm !== '' || selectedType !== 'all')) {
      // Filtreleme değiştiğinde sayfa 1'e dön ve yeniden yükle
      setCurrentPage(1);
      
      // Debounce search to avoid too many API calls
      const timer = setTimeout(() => {
        loadGeometries(1);
      }, 500);
      
      return () => clearTimeout(timer);
    } else if (isOpen && searchTerm === '' && selectedType === 'all') {
      // Filtreler temizlendiğinde hemen yükle
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
      toast.error('❌ Bu geometri silinemez - ID bilgisi eksik!');
      return;
    }
    
    if (window.confirm('Bu geometriyi silmek istediğinizden emin misiniz?')) {
      // Parent component'teki silme fonksiyonunu çağır (API çağrısı da orada yapılacak)
      onDelete(id);
      // Modal kendisi listeyi yenileyecek çünkü parent geometrileri güncelleyecek
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
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="geometry-list-modal-search-clear"
                  title="Aramayı temizle"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Tip Filtresi ve Kontroller */}
            <div className="geometry-list-modal-filter-row">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="geometry-list-modal-type-select"
              >
                <option value="all">🎯 Tümü ({totalCount || 0})</option>
                <option value="Point">📍 Noktalar</option>
                <option value="LineString">📏 Çizgiler</option>
                <option value="Polygon">🔷 Alanlar</option>
              </select>

              {/* Filtreleri Temizle */}
              {(searchTerm || selectedType !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedType('all');
                  }}
                  className="geometry-list-modal-clear-filters-btn"
                  title="Tüm filtreleri temizle"
                >
                  🧹 Temizle
                </button>
              )}

              {/* Yenile Butonu */}
              <button
                onClick={() => loadGeometries(currentPage)}
                disabled={loading}
                className="geometry-list-modal-refresh-btn"
                title="Listeyi yenile"
              >
                {loading ? '🔄' : '🔄'}
              </button>
            </div>

            {/* Aktif Filtreler */}
            {(searchTerm || selectedType !== 'all') && (
              <div className="geometry-list-modal-active-filters">
                <span className="geometry-list-modal-active-filters-label">Aktif filtreler:</span>
                {searchTerm && (
                  <span className="geometry-list-modal-filter-tag">
                    🔍 "{searchTerm}"
                    <button onClick={() => setSearchTerm('')}>✕</button>
                  </span>
                )}
                {selectedType !== 'all' && (
                  <span className="geometry-list-modal-filter-tag">
                    {selectedType === 'Point' ? '📍' : selectedType === 'LineString' ? '📏' : '🔷'} {selectedType}
                    <button onClick={() => setSelectedType('all')}>✕</button>
                  </span>
                )}
              </div>
            )}
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
                                 // Fotoğraf yüklendi
                               }}
                               onError={(e) => {
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

        {/* Pagination - Debug bilgisi ile */}
        <div className="geometry-list-modal-pagination">
          <div className="geometry-list-modal-page-info">
            <div>Sayfa {currentPage} / {totalPages}</div>
            <div style={{fontSize: '12px', color: '#666'}}>
              Toplam: {totalCount} kayıt ({filteredGeometries.length} gösteriliyor)
            </div>
          </div>
          <div className="geometry-list-modal-page-buttons">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="geometry-list-modal-page-btn"
              style={{opacity: currentPage === 1 || loading ? 0.5 : 1}}
            >
              ← Önceki
            </button>
            
            {/* Sayfa numaraları */}
            <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
              {Array.from({length: Math.min(totalPages, 5)}, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    disabled={loading}
                    style={{
                      padding: '4px 8px',
                      border: currentPage === page ? '2px solid #007bff' : '1px solid #ccc',
                      backgroundColor: currentPage === page ? '#007bff' : 'white',
                      color: currentPage === page ? 'white' : 'black',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {page}
                  </button>
                );
              })}
              {totalPages > 5 && <span>...</span>}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="geometry-list-modal-page-btn"
              style={{opacity: currentPage >= totalPages || loading ? 0.5 : 1}}
            >
              Sonraki →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeometryListModal;




