import { useState, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import { AllCommunityModule } from "ag-grid-community";

// Solo importa estilos base, NO el alpine.css para evitar conflicto
import "ag-grid-community/styles/ag-grid.css";

// Registrar los módulos
ModuleRegistry.registerModules([AllCommunityModule]);

const GridExample = () => {
  const [rowData, setRowData] = useState<any[]>([]);
  const [colDefs] = useState([
    { field: "mission" },
    { field: "company" },
    { field: "location" },
    { field: "date" },
    { field: "price" },
    { field: "successful" },
    { field: "rocket" },
  ]);

  useEffect(() => {
    fetch("https://www.ag-grid.com/example-assets/space-mission-data.json")
      .then((res) => res.json())
      .then((data) => setRowData(data));
  }, []);

  return (
    <div
      className="ag-theme-alpine custom-grid-theme"
      style={{
        height: 500,
        width: "90%",
        maxWidth: 1000,
        margin: "40px auto",
        borderRadius: 16,
        padding: 12,
        backgroundColor: "rgba(36, 36, 36, 0.9)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <AgGridReact
        rowData={rowData}
        columnDefs={colDefs}
        theme="legacy" // 👈 Esto es CLAVE para usar los estilos por CSS
      />
    </div>
  );
};

export default GridExample;
