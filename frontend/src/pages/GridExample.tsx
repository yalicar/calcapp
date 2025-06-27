import { useState, useEffect, useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import { AllCommunityModule } from "ag-grid-community";
import type { 
  ColDef, 
  GridReadyEvent, 
  CellClassParams,
  ValueFormatterParams,
  GridApi,
  ColumnApi
} from "ag-grid-community";

// Importar estilos
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

// Registrar módulos
ModuleRegistry.registerModules([AllCommunityModule]);

// Interfaz para los datos
interface SpaceMission {
  mission: string;
  company: string;
  location: string;
  date: string;
  price: number;
  successful: boolean;
  rocket: string;
}

// Componente personalizado para el estado
const StatusCellRenderer = (params: any) => {
  const isSuccessful = params.value;
  const statusClass = isSuccessful ? 'status-success' : 'status-failed';
  const statusText = isSuccessful ? '✓ Éxito' : '✗ Fallo';
  
  return `<span class="status-badge ${statusClass}">${statusText}</span>`;
};

// Componente personalizado para la misión (con tooltip)
const MissionCellRenderer = (params: any) => {
  return `<div class="mission-cell" title="${params.value}">
    <strong>${params.value}</strong>
  </div>`;
};

const GridExample = () => {
  const [rowData, setRowData] = useState<SpaceMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [columnApi, setColumnApi] = useState<ColumnApi | null>(null);

  // Definición de columnas con configuración avanzada
  const columnDefs = useMemo<ColDef<SpaceMission>[]>(() => [
    {
      field: "mission",
      headerName: "Misión",
      width: 200,
      pinned: "left",
      cellRenderer: MissionCellRenderer,
      cellClass: "mission-column",
      headerClass: "header-primary",
      tooltipField: "mission",
      sortable: true,
      filter: "agTextColumnFilter",
      floatingFilter: true,
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    {
      field: "company",
      headerName: "Compañía",
      width: 150,
      cellClass: "company-column",
      headerClass: "header-secondary",
      sortable: true,
      filter: "agSetColumnFilter",
      floatingFilter: true,
      cellStyle: { fontWeight: "500" }
    },
    {
      field: "rocket",
      headerName: "Cohete",
      width: 160,
      cellClass: "rocket-column",
      headerClass: "header-secondary",
      sortable: true,
      filter: "agTextColumnFilter",
      floatingFilter: true,
      cellStyle: { fontStyle: "italic", color: "#6366f1" }
    },
    {
      field: "location",
      headerName: "Ubicación",
      width: 180,
      cellClass: "location-column",
      headerClass: "header-secondary",
      sortable: true,
      filter: "agTextColumnFilter",
      floatingFilter: true,
      tooltipField: "location"
    },
    {
      field: "date",
      headerName: "Fecha",
      width: 130,
      cellClass: "date-column",
      headerClass: "header-secondary",
      sortable: true,
      filter: "agDateColumnFilter",
      floatingFilter: true,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return "";
        const date = new Date(params.value);
        return date.toLocaleDateString("es-ES", {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      },
      cellStyle: { fontFamily: "monospace", fontSize: "13px" }
    },
    {
      field: "price",
      headerName: "Precio (USD)",
      width: 140,
      type: "numericColumn",
      cellClass: "price-column",
      headerClass: "header-numeric",
      sortable: true,
      filter: "agNumberColumnFilter",
      floatingFilter: true,
      valueFormatter: (params: ValueFormatterParams) => {
        if (params.value == null) return "N/A";
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(params.value);
      },
      cellClassRules: {
        "price-high": (params: CellClassParams) => params.value > 100000000,
        "price-medium": (params: CellClassParams) => params.value > 50000000 && params.value <= 100000000,
        "price-low": (params: CellClassParams) => params.value <= 50000000
      }
    },
    {
      field: "successful",
      headerName: "Estado",
      width: 120,
      cellRenderer: StatusCellRenderer,
      cellClass: "status-column",
      headerClass: "header-status",
      sortable: true,
      filter: "agSetColumnFilter",
      floatingFilter: true,
      filterParams: {
        valueFormatter: (params: any) => params.value ? "Éxito" : "Fallo"
      }
    }
  ], []);

  // Configuración por defecto de columnas
  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    floatingFilter: false,
    menuTabs: ["filterMenuTab", "generalMenuTab"],
    cellStyle: {
      display: "flex",
      alignItems: "center",
      paddingLeft: "12px"
    }
  }), []);

  // Configuración de la grilla
  const gridOptions = useMemo(() => ({
    animateRows: true,
    rowSelection: "multiple",
    suppressCellFocus: true,
    suppressRowClickSelection: true,
    rowHeight: 55,
    headerHeight: 50,
    floatingFiltersHeight: 40,
    rowMultiSelectWithClick: true,
    suppressMenuHide: true,
    enableRangeSelection: true,
    enableFillHandle: true,
    undoRedoCellEditing: true,
    undoRedoCellEditingLimit: 20,
    stopEditingWhenCellsLoseFocus: true,
    maintainColumnOrder: true,
    suppressDragLeaveHidesColumns: true,
    onGridReady: (params: GridReadyEvent) => {
      setGridApi(params.api);
      setColumnApi(params.columnApi);
      
      // Auto-size columns
      params.api.sizeColumnsToFit();
      
      // Auto-height para las filas si es necesario
      // params.api.setDomLayout('autoHeight');
    },
    onFirstDataRendered: (params: any) => {
      // Expandir automáticamente los filtros si hay pocos datos
      if (rowData.length < 50) {
        params.columnApi.getColumns()?.forEach((column: any) => {
          if (column.colDef.filter) {
            params.api.setFilterModel({
              [column.colId]: { filterType: 'text', type: 'contains' }
            });
          }
        });
      }
    }
  }), [rowData.length]);

  // Cargar datos
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch("https://www.ag-grid.com/example-assets/space-mission-data.json");
        const data = await response.json();
        setRowData(data);
      } catch (error) {
        console.error("Error loading data:", error);
        // Datos de fallback en caso de error
        setRowData([
          {
            mission: "Demo Mission",
            company: "SpaceX",
            location: "Cape Canaveral",
            date: "2024-01-15",
            price: 62000000,
            successful: true,
            rocket: "Falcon 9"
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Funciones de utilidad
  const exportToCsv = useCallback(() => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: `space-missions-${new Date().toISOString().split('T')[0]}.csv`,
        columnSeparator: ';'
      });
    }
  }, [gridApi]);

  const clearFilters = useCallback(() => {
    if (gridApi) {
      gridApi.setFilterModel(null);
    }
  }, [gridApi]);

  const autoSizeColumns = useCallback(() => {
    if (columnApi) {
      columnApi.autoSizeAllColumns();
    }
  }, [columnApi]);

  const getSelectedRows = useCallback(() => {
    if (gridApi) {
      const selectedRows = gridApi.getSelectedRows();
      console.log("Filas seleccionadas:", selectedRows);
      alert(`${selectedRows.length} filas seleccionadas. Ver consola para detalles.`);
    }
  }, [gridApi]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando datos de misiones espaciales...</p>
      </div>
    );
  }

  return (
    <div className="grid-container">
      {/* Header con estadísticas */}
      <div className="grid-header">
        <div className="header-content">
          <h1>🚀 Misiones Espaciales</h1>
          <p>Historial completo de lanzamientos espaciales comerciales</p>
        </div>
        
        <div className="stats-container">
          <div className="stat-card">
            <span className="stat-number">{rowData.length}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-card success">
            <span className="stat-number">{rowData.filter(row => row.successful).length}</span>
            <span className="stat-label">Éxitos</span>
          </div>
          <div className="stat-card failed">
            <span className="stat-number">{rowData.filter(row => !row.successful).length}</span>
            <span className="stat-label">Fallos</span>
          </div>
          <div className="stat-card companies">
            <span className="stat-number">{new Set(rowData.map(row => row.company)).size}</span>
            <span className="stat-label">Compañías</span>
          </div>
        </div>
      </div>

      {/* Controles de la grilla */}
      <div className="grid-controls">
        <div className="controls-left">
          <button onClick={clearFilters} className="btn btn-secondary">
            🔄 Limpiar Filtros
          </button>
          <button onClick={autoSizeColumns} className="btn btn-secondary">
            📏 Auto-ajustar Columnas
          </button>
        </div>
        <div className="controls-right">
          <button onClick={getSelectedRows} className="btn btn-primary">
            📋 Ver Seleccionadas
          </button>
          <button onClick={exportToCsv} className="btn btn-success">
            📥 Exportar CSV
          </button>
        </div>
      </div>

      {/* Grid principal */}
      <div className="ag-theme-alpine professional-grid" style={{ height: 600, width: "100%" }}>
        <AgGridReact<SpaceMission>
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          gridOptions={gridOptions}
          theme="legacy"
        />
      </div>

      {/* Footer */}
      <div className="grid-footer">
        <p>📊 Datos actualizados • {rowData.length} misiones • 
           {rowData.filter(r => r.successful).length} éxitos • 
           {((rowData.filter(r => r.successful).length / rowData.length) * 100).toFixed(1)}% tasa de éxito
        </p>
      </div>

      {/* Estilos CSS personalizados */}
      <style jsx>{`
        .grid-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          color: white;
          margin: 40px auto;
          max-width: 600px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255,255,255,0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .grid-header {
          margin-bottom: 30px;
        }

        .header-content h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: #1a202c;
          margin: 0 0 8px 0;
        }

        .header-content p {
          font-size: 1.1rem;
          color: #4a5568;
          margin: 0;
        }

        .stats-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          border-radius: 12px;
          color: white;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
        }

        .stat-card.success {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        }

        .stat-card.failed {
          background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
        }

        .stat-card.companies {
          background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%);
        }

        .stat-number {
          display: block;
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 0.9rem;
          opacity: 0.9;
        }

        .grid-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 16px;
          background: #f7fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .controls-left, .controls-right {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .btn-primary {
          background: #4299e1;
          color: white;
        }

        .btn-secondary {
          background: #718096;
          color: white;
        }

        .btn-success {
          background: #48bb78;
          color: white;
        }

        .professional-grid {
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
        }

        .grid-footer {
          margin-top: 20px;
          text-align: center;
          color: #718096;
          font-size: 14px;
          padding: 16px;
          background: #f7fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        /* Estilos personalizados para ag-Grid */
        :global(.ag-theme-alpine) {
          --ag-header-background-color: #2d3748;
          --ag-header-foreground-color: white;
          --ag-border-color: #e2e8f0;
          --ag-row-hover-color: #f7fafc;
          --ag-selected-row-background-color: #ebf8ff;
          --ag-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --ag-font-size: 14px;
          --ag-header-height: 50px;
          --ag-row-height: 55px;
        }

        :global(.header-primary) {
          background: linear-gradient(135deg, #2b6cb0 0%, #2c5282 100%) !important;
        }

        :global(.header-secondary) {
          background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%) !important;
        }

        :global(.header-numeric) {
          background: linear-gradient(135deg, #38a169 0%, #2f855a 100%) !important;
        }

        :global(.header-status) {
          background: linear-gradient(135deg, #805ad5 0%, #6b46c1 100%) !important;
        }

        :global(.mission-column) {
          font-weight: 600 !important;
          color: #2d3748 !important;
        }

        :global(.price-high) {
          color: #e53e3e !important;
          font-weight: 600 !important;
        }

        :global(.price-medium) {
          color: #d69e2e !important;
          font-weight: 600 !important;
        }

        :global(.price-low) {
          color: #38a169 !important;
          font-weight: 600 !important;
        }

        :global(.status-badge) {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          display: inline-block;
          text-align: center;
          min-width: 70px;
        }

        :global(.status-success) {
          background-color: #c6f6d5;
          color: #22543d;
        }

        :global(.status-failed) {
          background-color: #fed7d7;
          color: #742a2a;
        }

        :global(.ag-row) {
          border-bottom: 1px solid #f1f5f9;
        }

        :global(.ag-row:hover) {
          background-color: #f8fafc !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        :global(.ag-header-cell) {
          border-right: 1px solid rgba(255, 255, 255, 0.2);
        }

        :global(.ag-floating-filter) {
          background-color: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
        }

        :global(.ag-floating-filter-input) {
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 13px;
        }

        @media (max-width: 768px) {
          .grid-controls {
            flex-direction: column;
            gap: 12px;
          }
          
          .controls-left, .controls-right {
            width: 100%;
            justify-content: center;
          }
          
          .stats-container {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default GridExample;