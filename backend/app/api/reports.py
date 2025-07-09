# backend/app/api/reports.py
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from typing import List, Optional
import json
import os
from datetime import datetime

# Importar WeasyPrint solo si está instalado
try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False
    print("⚠️  WeasyPrint no está instalado. Instala con: pip install weasyprint")

router = APIRouter()

# Modelos básicos
class ReportRequest(BaseModel):
    html: str
    filename: str

def ensure_reports_directory():
    """Asegura que el directorio de reportes exista"""
    reports_dir = "reports"
    if not os.path.exists(reports_dir):
        os.makedirs(reports_dir)
    return reports_dir

# CSS básico para PDFs
PDF_CSS = """
@page {
    size: A4;
    margin: 2cm;
}

body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    font-size: 12px;
}

.header {
    text-align: center;
    border-bottom: 3px solid #3498db;
    padding-bottom: 20px;
    margin-bottom: 30px;
}

.section {
    margin: 20px 0;
    padding: 15px;
    border: 1px solid #ecf0f1;
    border-radius: 8px;
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin: 15px 0;
}

.info-item {
    background: #f8f9fa;
    padding: 10px;
    border-radius: 5px;
    border-left: 4px solid #3498db;
}
"""

@router.post("/generate-pdf")
async def generate_pdf_report(request: ReportRequest):
    """Genera un reporte PDF básico"""
    
    if not WEASYPRINT_AVAILABLE:
        raise HTTPException(
            status_code=500, 
            detail="WeasyPrint no está instalado. Ejecute: pip install weasyprint"
        )
    
    try:
        reports_dir = ensure_reports_directory()
        
        # Configurar WeasyPrint
        font_config = FontConfiguration()
        
        # Crear el PDF
        html_doc = HTML(string=request.html, base_url=".")
        css_doc = CSS(string=PDF_CSS, font_config=font_config)
        
        # Generar el PDF en memoria
        pdf_bytes = html_doc.write_pdf(stylesheets=[css_doc], font_config=font_config)
        
        # Guardar el PDF en el sistema de archivos
        pdf_path = os.path.join(reports_dir, request.filename)
        with open(pdf_path, 'wb') as f:
            f.write(pdf_bytes)
        
        # Retornar el PDF como respuesta
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={request.filename}",
                "Content-Length": str(len(pdf_bytes))
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")

@router.get("/templates")
async def get_available_templates():
    """Endpoint básico para verificar que el backend funciona"""
    return {
        "message": "Backend de reportes funcionando",
        "weasyprint_available": WEASYPRINT_AVAILABLE,
        "templates": ["standard", "detailed", "executive"]
    }

@router.get("/list")
async def list_reports():
    """Lista reportes generados"""
    try:
        reports_dir = ensure_reports_directory()
        reports = []
        
        for filename in os.listdir(reports_dir):
            if filename.endswith('.pdf'):
                file_path = os.path.join(reports_dir, filename)
                
                report_info = {
                    "filename": filename,
                    "size": os.path.getsize(file_path),
                    "created_at": datetime.fromtimestamp(os.path.getctime(file_path)).isoformat()
                }
                reports.append(report_info)
        
        return {"reports": reports}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listando reportes: {str(e)}")

@router.get("/statistics")
async def get_statistics():
    """Estadísticas básicas"""
    try:
        reports_dir = ensure_reports_directory()
        pdf_files = [f for f in os.listdir(reports_dir) if f.endswith('.pdf')]
        
        return {
            "total_reports": len(pdf_files),
            "total_size_mb": 0,
            "average_size_mb": 0,
            "reports_by_template": {},
            "reports_by_month": {},
            "latest_report": None
        }
    except Exception as e:
        return {
            "total_reports": 0,
            "total_size_mb": 0,
            "average_size_mb": 0,
            "reports_by_template": {},
            "reports_by_month": {},
            "latest_report": None
        }

# Endpoints para datos de ejemplo (para que funcione sin romper nada)
@router.get("/project/latest")
async def get_latest_project():
    """Datos de ejemplo"""
    return {
        "name": "Proyecto de Prueba PDF",
        "location": "Tegucigalpa, Honduras",
        "client": "Cliente de Prueba",
        "engineer": "Ing. Prueba",
        "date": "2024-12-15",
        "capacity": 100.0,
        "stringCount": 20,
        "moduleCount": 400,
        "moduleType": "Módulo de Prueba",
        "inverterType": "Inversor de Prueba"
    }

@router.get("/calculations/critical-string")
async def get_critical_string():
    """Datos de ejemplo"""
    return {
        "criticalString": {
            "stringId": "STR-TEST",
            "totalResistance": 0.025,
            "voltageDrop": 10.0,
            "powerLoss": 200.0,
            "efficiency": 95.0,
            "current": 10.0,
            "voltage": 600.0,
            "cableLength": 100.0,
            "cableSection": 4.0,
            "resistivity": 0.017
        },
        "recommendations": ["Recomendación de prueba"],
        "calculations": []
    }

@router.get("/validations/results")
async def get_validations():
    """Datos de ejemplo"""
    return [{
        "standard": "IEC TEST",
        "compliance": True,
        "score": 90,
        "issues": [],
        "recommendations": ["Validación de prueba"]
    }]