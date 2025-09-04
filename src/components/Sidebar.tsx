import React from "react";

const Sidebar: React.FC<{
  onAdd: () => void;
  onList: () => void;
}> = ({ onAdd, onList }) => (
  <aside className="sidebar">
    <h3>Harita İşlemleri</h3>
    <button onClick={onAdd}>Ekle</button>
    {/* <button onClick={onUpdate}>Güncelle</button> */}
    <button onClick={onList}>Listele</button>
  </aside>
);

export default Sidebar;
