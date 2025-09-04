import React, { useState, useEffect } from "react";
import { getAddressFromWkt, type GeocodingResult } from "../utils/geocodingUtils";

interface PointFormModalProps {
  open: boolean;
  wkt: string;
  onClose: () => void;
  onSave: (data: { 
    name: string; 
    fullAddress: string; 
    phone: string; 
    photoBase64: string; 
    description: string; 
    openingHours: string; 
    wkt: string; 
    type: string; 
  }) => void;
  type: string;
  editingGeometry?: {
    id: number;
    name?: string;
    fullAddress?: string;
    phone?: string;
    photoBase64?: string;
    description?: string;
    openingHours?: string;
    wkt: string;
    type?: string;
  } | null;
}

const PointFormModal: React.FC<PointFormModalProps> = ({ open, wkt, onClose, onSave, type, editingGeometry }) => {
  const [name, setName] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [photoBase64, setPhotoBase64] = useState("");
  const [description, setDescription] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [geocodingResult, setGeocodingResult] = useState<GeocodingResult | null>(null);

  // WKT değiştiğinde otomatik adres al veya düzenleme modunda mevcut verileri yükle
  useEffect(() => {
    if (open && wkt) {
      if (editingGeometry) {
        // Düzenleme modu - mevcut verileri yükle
        console.log("✏️ Düzenleme modu - mevcut veriler yükleniyor:", editingGeometry);
        setName(editingGeometry.name || "");
        setFullAddress(editingGeometry.fullAddress || "");
        setPhone(editingGeometry.phone || "");
        setPhotoBase64(editingGeometry.photoBase64 || "");
        setDescription(editingGeometry.description || "");
        setOpeningHours(editingGeometry.openingHours || "");
      } else {
        // Yeni kayıt modu - adres al
        setLoadingAddress(true);
        getAddressFromWkt(wkt)
          .then(result => {
            if (result) {
              setGeocodingResult(result);
              setFullAddress(result.displayName);
            }
          })
          .catch(error => {
            console.error('Adres alınamadı:', error);
          })
          .finally(() => {
            setLoadingAddress(false);
          });
      }
    }
  }, [open, wkt, editingGeometry]);

  // Modal kapandığında form temizle (sadece yeni kayıt modunda)
  useEffect(() => {
    if (!open && !editingGeometry) {
      setName("");
      setFullAddress("");
      setPhone("");
      setPhotoBase64("");
      setDescription("");
      setOpeningHours("");
      setGeocodingResult(null);
    }
  }, [open, editingGeometry]);

  if (!open) return null;

  // Fotoğraf yükleme fonksiyonu
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPhotoBase64(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSave({ 
      name, 
      fullAddress, 
      phone, 
      photoBase64, 
      description, 
      openingHours, 
      wkt, 
      type 
    });
    
    // Form'u temizle (sadece yeni kayıt modunda)
    if (!editingGeometry) {
      setName("");
      setFullAddress("");
      setPhone("");
      setPhotoBase64("");
      setDescription("");
      setOpeningHours("");
      setGeocodingResult(null);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{editingGeometry ? 'Geometri Düzenle' : 'Konum Bilgileri'}</h2>
        <form onSubmit={handleSubmit}>
          <label>Adı
            <input value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label>Telefon
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+90 555 123 45 67" />
          </label>
          <label>Adres
            <textarea 
              value={fullAddress} 
              onChange={e => setFullAddress(e.target.value)}
              placeholder={loadingAddress ? "Adres alınıyor..." : "Adres bilgisi"}
              rows={3}
              disabled={loadingAddress}
            />
            {loadingAddress && <small>🌍 Adres bilgisi alınıyor...</small>}
            {geocodingResult && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                <strong>Detaylar:</strong><br/>
                {geocodingResult.address.city && `Şehir: ${geocodingResult.address.city}`}<br/>
                {geocodingResult.address.district && `İlçe: ${geocodingResult.address.district}`}<br/>
                {geocodingResult.address.neighbourhood && `Mahalle: ${geocodingResult.address.neighbourhood}`}<br/>
                {geocodingResult.address.road && `Sokak: ${geocodingResult.address.road}`}
              </div>
            )}
          </label>
          <label>Açılış Saatleri
            <input 
              value={openingHours} 
              onChange={e => setOpeningHours(e.target.value)} 
              placeholder="09:00-18:00"
            />
          </label>
          <label>Açıklama
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Açıklama bilgisi"
              rows={3}
            />
          </label>
          <label>Fotoğraf
            <input 
              type="file" 
              accept="image/*" 
              onChange={handlePhotoUpload}
              style={{ padding: '8px' }}
            />
            {photoBase64 && (
              <div style={{ marginTop: '8px' }}>
                <img 
                  src={photoBase64} 
                  alt="Preview" 
                  style={{ maxWidth: '200px', maxHeight: '150px', border: '1px solid #ccc' }}
                />
              </div>
            )}
          </label>
          <label>WKT
            <input value={wkt} readOnly />
          </label>
          <label>Tip
            <input value={type} readOnly />
          </label>
          <div className="modal-actions">
            <button type="submit">{editingGeometry ? 'Güncelle' : 'Kaydet'}</button>
            <button type="button" onClick={onClose}>İptal</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PointFormModal;
