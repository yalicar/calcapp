import { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Box, Typography, Button } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

function UploadExcelPage() {
  const { projectName } = useParams();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`http://localhost:8000/upload-excel/${projectName}`, formData);
      await new Promise((res) => setTimeout(res, 1000));

      const valid = await axios.get(`http://localhost:8000/validate-content/${projectName}`);
      setMessage(valid.data.message);
      setErrors([]);

      const previewRes = await axios.get(`http://localhost:8000/read-excel/${projectName}`);
      const sheetData = Object.values(previewRes.data)[0]; // solo una hoja

      if (Array.isArray(sheetData) && sheetData.length > 0) {
        const formattedColumns = Object.keys(sheetData[0]).map((key) => ({
          field: key,
          headerName: key,
          width: 150,
        }));
        const formattedRows = sheetData.map((row, index) => ({ id: index, ...row }));

        setColumns(formattedColumns);
        setRows(formattedRows);
      }
    } catch (error: any) {
      if (error.response?.status === 400) {
        const detail = error.response.data.detail;
        setErrors(Array.isArray(detail) ? detail : [detail]);
      } else {
        setMessage("Error al subir o validar el archivo.");
      }
    }
  };

  return (
    <Box sx={{ p: 4, backgroundColor: "#121212", minHeight: "100vh", color: "white" }}>
      <Typography variant="h5" gutterBottom>
        Proyecto: {projectName}
      </Typography>

      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ marginBottom: "1rem" }}
      />

      <Button variant="contained" onClick={handleUpload} sx={{ mb: 2 }}>
        Subir Excel
      </Button>

      {message && <Typography sx={{ mt: 2 }}>{message}</Typography>}

      {errors.length > 0 && (
        <Box sx={{ mt: 2, color: "red" }}>
          <Typography variant="h6">Errores encontrados:</Typography>
          <ul>
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </Box>
      )}

      {rows.length > 0 && (
        <Box sx={{ mt: 4, height: 400, backgroundColor: "#1a1a1a" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            checkboxSelection
            disableRowSelectionOnClick
            sx={{
              color: "white",
              borderColor: "#333",
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#2a2a2a",
              },
              "& .MuiDataGrid-cell": {
                borderColor: "#444",
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}

export default UploadExcelPage;
