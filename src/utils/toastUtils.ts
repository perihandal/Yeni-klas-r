import { toast } from 'react-toastify';

// Basit onaylama fonksiyonu - sadece confirm kullan
export const confirmAction = (message: string): boolean => {
  return confirm(message);
};

// Toast mesaj fonksiyonları
export const showSuccessToast = (message: string) => {
  toast.success(message);
};

export const showErrorToast = (message: string) => {
  toast.error(message);
};

export const showWarningToast = (message: string) => {
  toast.warning(message);
};

export const showInfoToast = (message: string) => {
  toast.info(message);
};

// Predefined mesajlar
export const TOAST_MESSAGES = {
  DELETE_CONFIRM: 'Bu geometriyi silmek istediğinizden emin misiniz?',
  DELETE_SUCCESS: '✅ Geometri başarıyla silindi!',
  DELETE_ERROR: '❌ Geometri silinirken bir hata oluştu!',
  SAVE_SUCCESS: '✅ Geometri başarıyla kaydedildi!',
  SAVE_ERROR: '❌ Geometri kaydedilirken bir hata oluştu!',
  SEARCH_EMPTY: 'Lütfen arama yapılacak bir metin girin!',
  SEARCH_NO_RESULTS: 'Arama için sonuç bulunamadı!',
};
