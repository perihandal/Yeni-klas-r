import React from 'react';
import { toast } from 'react-toastify';
import type { Id } from 'react-toastify';

// Toast confirmation helper
export const toastConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    let toastId: Id;
    
    const CustomToast = () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontWeight: '500' }}>{message}</div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              toast.dismiss(toastId);
              resolve(true);
            }}
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            ✓ Evet, Sil
          </button>
          <button
            onClick={() => {
              toast.dismiss(toastId);
              resolve(false);
            }}
            style={{
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            ✕ İptal
          </button>
        </div>
      </div>
    );

    toastId = toast(<CustomToast />, {
      position: 'top-center',
      autoClose: false,
      closeButton: false,
      closeOnClick: false,
      draggable: false,
      pauseOnHover: false,
      style: {
        backgroundColor: '#f3f4f6',
        color: '#374151',
        border: '1px solid #d1d5db'
      }
    });
  });
};

// Predefined toast messages
export const toastMessages = {
  // Success messages
  success: {
    geometryDeleted: '✅ Geometri başarıyla silindi!',
    geometryMoved: '✅ Geometri başarıyla taşındı!',
    pointMoved: '📍 Nokta başarıyla yeni konuma taşındı!',
    lineMoved: '📏 Çizgi başarıyla şekil olarak yeni konuma taşındı!',
    polygonMoved: '🔷 Alan başarıyla şekil olarak yeni konuma taşındı!',
  },
  
  // Error messages  
  error: {
    noSearchTerm: '⚠️ Lütfen arama yapılacak bir metin girin!',
    noResults: (searchTerm: string) => `❌ "${searchTerm}" için sonuç bulunamadı!`,
    noGeometryId: '❌ Bu geometri için ID bulunamadı!',
    geometryNotFound: '❌ Geometri bulunamadı!',
    deleteError: '❌ Geometri silinirken bir hata oluştu!',
    loadError: '❌ Geometriler yüklenirken hata oluştu!',
    moveError: '❌ Geometri güncellenirken hata oluştu!',
    deleteNoId: '❌ Bu geometri silinemez - ID bilgisi eksik!',
    deleteFailed: '❌ Silme işlemi başarısız!'
  },
  
  // Info messages
  info: {
    deleting: '🗑️ Geometri siliniyor...',
    searchResults: (count: number, names: string) => `🎯 ${count} sonuç bulundu: ${names}. İlk sonuca zoom yapılıyor...`,
    moveSelected: (type: string) => {
      if (type === 'Point') {
        return "📍 Nokta seçildi! Sürükleyip bırakabilirsiniz.";
      } else if (type === 'LineString') {
        return "📏 Çizgi seçildi! Tüm çizgiyi şekil olarak sürükleyebilirsiniz. Vertex düzenlemek için köşelere tıklayın.";
      } else if (type === 'Polygon') {
        return "🔷 Alan seçildi! Tüm alanı şekil olarak sürükleyebilirsiniz. Vertex düzenlemek için köşelere tıklayın.";
      } else {
        return "🖐️ Geometri seçildi! Şekil olarak sürükleyebilirsiniz.";
      }
    }
  },
  
  // Warning messages
  warning: {
    noSearchTerm: '⚠️ Lütfen arama yapılacak bir metin girin!'
  }
};
