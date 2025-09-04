import React from "react";

interface GeometryTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const GeometryTypeSelector: React.FC<GeometryTypeSelectorProps> = ({ value, onChange }) => (
  <div className="geometry-type-selector">
    <label htmlFor="geometryType">Geometry type:</label>
    <select id="geometryType" value={value} onChange={e => onChange(e.target.value)}>
      <option value="Point">Point</option>
      <option value="LineString">LineString</option>
      <option value="Polygon">Polygon</option>
    </select>
  </div>
);

export default GeometryTypeSelector;
