import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Download, 
  Settings, 
  Calendar, 
  User, 
  Building, 
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Eye
} from 'lucide-react';

// Interfaces para tipado
interface ProjectData {
  name: string;
  location: string;
  client: string;
  engineer: string;
  date: string;
  capacity: number;
  stringCount: number;
  moduleCount: number;
  moduleType: string;
  inverterType: string;
}

interface CalculationResults {
  criticalString: {
    stringId: string;
    totalResistance: number;
    voltageDrop: number;
    powerLoss: number;
    efficiency: number;
    current: number;
    voltage: number;
    cableLength: number;
    cableSection: number;
    resistivity: number;
  };
  recommendations: string[];
  calculations: {
    formula: string;
    steps: string[];
    result: number;
    unit: string;
  }[];
}

interface NormativeValidation {
  standard: string;
  compliance: boolean;
  score: number;
  issues: {
    parameter: string;
    value: number;
    limit: number;
    severity: 'error' | 'warning' | 'info';
    description: string;
  }[];
  recommendations: string[];
}

interface ReportConfig {
  includeCalculations: boolean;
  includeValidations: boolean;
  includeCharts: boolean;
  includeRecommendations: boolean;
  template: 'standard' | 'detailed' | 'executive';
  language: 'es' | 'en';
}

interface ReportData {
  project: ProjectData;
  calculations: CalculationResults;
  validations: NormativeValidation[];
  config: ReportConfig;
}

const PDFReportGenerator: React.FC = () => {
  const [projectData, setProjectData] = useState<ProjectData>({
    name: '',
    location: '',
    client: '',
    engineer: '',
    date: new Date().toISOString().split('T')[0],
    capacity: 0,
    stringCount: 0,
    moduleCount: 0,
    moduleType: '',
    inverterType: ''
  });

  const [calculationResults, setCalculationResults] = useState<CalculationResults>({
    criticalString: {
      stringId: '',
      totalResistance: 0,
      voltageDrop: 0,
      powerLoss: 0,
      efficiency: 0,
      current: 0,
      voltage: 0,
      cableLength: 0,
      cableSection: 0,
      resistivity: 0
    },
    recommendations: [],
    calculations: []
  });

  const [normativeValidations, setNormativeValidations] = useState<NormativeValidation[]>([]);
  
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    includeCalculations: true,
    includeValidations: true,
    includeCharts: true,
    includeRecommendations: true,
    template: 'standard',
    language: 'es'
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Función para cargar datos desde el backend
  const loadDataFromBackend = async () => {
    try {
      // Cargar datos del proyecto desde el backend
      const projectResponse = await fetch('http://localhost:8000/api/reports/project/latest');
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        setProjectData(projectData);
      }

      // Cargar resultados de cálculos
      const calculationsResponse = await fetch('http://localhost:8000/api/reports/calculations/critical-string');
      if (calculationsResponse.ok) {
        const calculationsData = await calculationsResponse.json();
        setCalculationResults(calculationsData);
      }

      // Cargar validaciones normativas
      const validationsResponse = await fetch('http://localhost:8000/api/reports/validations/results');
      if (validationsResponse.ok) {
        const validationsData = await validationsResponse.json();
        setNormativeValidations(validationsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Función para generar gráficos
  const generateChart = (type: string, data: any) => {
    if (!canvasRef.current) return '';
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = 400;
    canvas.height = 300;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    switch (type) {
      case 'voltage-drop':
        drawVoltageDropChart(ctx, data);
        break;
      case 'power-loss':
        drawPowerLossChart(ctx, data);
        break;
      case 'compliance':
        drawComplianceChart(ctx, data);
        break;
    }

    return canvas.toDataURL();
  };

  const drawVoltageDropChart = (ctx: CanvasRenderingContext2D, data: any) => {
    const margin = 50;
    const width = 400 - 2 * margin;
    const height = 300 - 2 * margin;
    
    // Dibujar ejes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + height);
    ctx.lineTo(margin + width, margin + height);
    ctx.stroke();
    
    // Datos simulados para el gráfico
    const voltageData = [
      { distance: 0, voltage: 600 },
      { distance: 50, voltage: 595 },
      { distance: 100, voltage: 588 },
      { distance: 150, voltage: 580 },
      { distance: 200, voltage: 570 }
    ];
    
    // Dibujar línea
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    voltageData.forEach((point, index) => {
      const x = margin + (point.distance / 200) * width;
      const y = margin + height - ((point.voltage - 550) / 50) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Título
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Caída de Tensión vs Distancia', 200, 30);
    
    // Etiquetas
    ctx.font = '12px Arial';
    ctx.fillText('Distancia (m)', 200, 290);
    ctx.save();
    ctx.translate(20, 150);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Tensión (V)', 0, 0);
    ctx.restore();
  };

  const drawPowerLossChart = (ctx: CanvasRenderingContext2D, data: any) => {
    const margin = 50;
    const width = 400 - 2 * margin;
    const height = 300 - 2 * margin;
    
    // Dibujar ejes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + height);
    ctx.lineTo(margin + width, margin + height);
    ctx.stroke();
    
    // Datos de pérdidas por categoría
    const lossData = [
      { category: 'Resistencia', loss: 2.5, color: '#e74c3c' },
      { category: 'Conexiones', loss: 1.2, color: '#f39c12' },
      { category: 'Temperatura', loss: 0.8, color: '#3498db' },
      { category: 'Sombreado', loss: 0.5, color: '#2ecc71' }
    ];
    
    const barWidth = width / lossData.length * 0.8;
    const barSpacing = width / lossData.length * 0.2;
    
    lossData.forEach((item, index) => {
      const x = margin + index * (barWidth + barSpacing) + barSpacing / 2;
      const barHeight = (item.loss / 3) * height;
      const y = margin + height - barHeight;
      
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Etiqueta
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.category, x + barWidth / 2, margin + height + 15);
      ctx.fillText(`${item.loss}%`, x + barWidth / 2, y - 5);
    });
    
    // Título
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Pérdidas de Potencia por Categoría', 200, 30);
  };

  const drawComplianceChart = (ctx: CanvasRenderingContext2D, data: any) => {
    const centerX = 200;
    const centerY = 150;
    const radius = 80;
    
    // Datos de cumplimiento
    const complianceData = [
      { standard: 'IEC 62548', compliance: 95, color: '#2ecc71' },
      { standard: 'NEC 2020', compliance: 88, color: '#f39c12' },
      { standard: 'IEC 60364', compliance: 92, color: '#3498db' },
      { standard: 'UL 1741', compliance: 90, color: '#9b59b6' }
    ];
    
    let startAngle = 0;
    
    complianceData.forEach((item) => {
      const sliceAngle = (item.compliance / 100) * 2 * Math.PI;
      
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.lineTo(centerX, centerY);
      ctx.fill();
      
      // Etiqueta
      const labelAngle = startAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius + 30);
      const labelY = centerY + Math.sin(labelAngle) * (radius + 30);
      
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.standard, labelX, labelY);
      ctx.fillText(`${item.compliance}%`, labelX, labelY + 15);
      
      startAngle += sliceAngle;
    });
    
    // Título
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Cumplimiento Normativo', 200, 30);
  };

  // Función para generar el HTML del reporte
  const generateReportHTML = (data: ReportData): string => {
    const charts = {
      voltageDrop: generateChart('voltage-drop', data.calculations),
      powerLoss: generateChart('power-loss', data.calculations),
      compliance: generateChart('compliance', data.validations)
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Reporte de Análisis - ${data.project.name}</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                color: #333;
                line-height: 1.6;
            }
            .header { 
                text-align: center; 
                border-bottom: 3px solid #3498db; 
                padding-bottom: 20px; 
                margin-bottom: 30px;
            }
            .header h1 { 
                color: #2c3e50; 
                margin: 0; 
                font-size: 28px;
            }
            .header p { 
                color: #7f8c8d; 
                margin: 5px 0;
            }
            .section { 
                margin: 30px 0; 
                padding: 20px;
                border: 1px solid #ecf0f1;
                border-radius: 8px;
            }
            .section h2 { 
                color: #2c3e50; 
                border-bottom: 2px solid #3498db; 
                padding-bottom: 10px;
                margin-top: 0;
            }
            .info-grid { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 20px; 
                margin: 20px 0;
            }
            .info-item { 
                background: #f8f9fa; 
                padding: 15px; 
                border-radius: 5px;
                border-left: 4px solid #3498db;
            }
            .info-item strong { 
                color: #2c3e50; 
            }
            .critical-result { 
                background: #fff3cd; 
                border: 1px solid #ffeaa7; 
                padding: 15px; 
                border-radius: 5px; 
                margin: 15px 0;
            }
            .warning { 
                background: #f8d7da; 
                border: 1px solid #f5c6cb; 
                color: #721c24;
            }
            .success { 
                background: #d4edda; 
                border: 1px solid #c3e6cb; 
                color: #155724;
            }
            .chart-container { 
                text-align: center; 
                margin: 20px 0;
            }
            .chart-container img { 
                max-width: 100%; 
                border: 1px solid #ddd; 
                border-radius: 5px;
            }
            .recommendations { 
                background: #e8f5e8; 
                padding: 15px; 
                border-radius: 5px; 
                margin: 15px 0;
            }
            .recommendations ul { 
                margin: 10px 0; 
                padding-left: 20px;
            }
            .recommendations li { 
                margin: 5px 0;
            }
            .footer { 
                text-align: center; 
                margin-top: 50px; 
                padding-top: 20px; 
                border-top: 1px solid #ecf0f1; 
                color: #7f8c8d;
            }
            .calculation-detail {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin: 10px 0;
                font-family: monospace;
            }
            .formula {
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 10px;
            }
            .steps {
                margin-left: 20px;
            }
            .steps li {
                margin: 5px 0;
            }
            .compliance-table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            .compliance-table th,
            .compliance-table td {
                border: 1px solid #ddd;
                padding: 12px;
                text-align: left;
            }
            .compliance-table th {
                background: #3498db;
                color: white;
            }
            .compliance-table tr:nth-child(even) {
                background: #f2f2f2;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Reporte de Análisis de Strings Críticos</h1>
            <p><strong>Proyecto:</strong> ${data.project.name}</p>
            <p><strong>Cliente:</strong> ${data.project.client}</p>
            <p><strong>Fecha:</strong> ${new Date(data.project.date).toLocaleDateString()}</p>
        </div>

        <div class="section">
            <h2>📋 Información del Proyecto</h2>
            <div class="info-grid">
                <div class="info-item">
                    <strong>Ubicación:</strong> ${data.project.location}
                </div>
                <div class="info-item">
                    <strong>Ingeniero:</strong> ${data.project.engineer}
                </div>
                <div class="info-item">
                    <strong>Capacidad:</strong> ${data.project.capacity} kW
                </div>
                <div class="info-item">
                    <strong>Número de Strings:</strong> ${data.project.stringCount}
                </div>
                <div class="info-item">
                    <strong>Número de Módulos:</strong> ${data.project.moduleCount}
                </div>
                <div class="info-item">
                    <strong>Tipo de Módulo:</strong> ${data.project.moduleType}
                </div>
            </div>
        </div>

        ${data.config.includeCalculations ? `
        <div class="section">
            <h2>⚡ Análisis del String Crítico</h2>
            <div class="critical-result">
                <h3>String ID: ${data.calculations.criticalString.stringId}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <strong>Resistencia Total:</strong> ${data.calculations.criticalString.totalResistance.toFixed(4)} Ω
                    </div>
                    <div class="info-item">
                        <strong>Caída de Tensión:</strong> ${data.calculations.criticalString.voltageDrop.toFixed(2)} V
                    </div>
                    <div class="info-item">
                        <strong>Pérdida de Potencia:</strong> ${data.calculations.criticalString.powerLoss.toFixed(2)} W
                    </div>
                    <div class="info-item">
                        <strong>Eficiencia:</strong> ${data.calculations.criticalString.efficiency.toFixed(2)}%
                    </div>
                </div>
            </div>

            ${data.config.includeCharts ? `
            <div class="chart-container">
                <img src="${charts.voltageDrop}" alt="Gráfico de Caída de Tensión">
            </div>
            <div class="chart-container">
                <img src="${charts.powerLoss}" alt="Gráfico de Pérdidas de Potencia">
            </div>
            ` : ''}

            <h3>Cálculos Detallados</h3>
            ${data.calculations.calculations.map(calc => `
            <div class="calculation-detail">
                <div class="formula">${calc.formula}</div>
                <ol class="steps">
                    ${calc.steps.map(step => `<li>${step}</li>`).join('')}
                </ol>
                <div><strong>Resultado:</strong> ${calc.result} ${calc.unit}</div>
            </div>
            `).join('')}
        </div>
        ` : ''}

        ${data.config.includeValidations ? `
        <div class="section">
            <h2>✅ Validación Normativa</h2>
            
            ${data.config.includeCharts ? `
            <div class="chart-container">
                <img src="${charts.compliance}" alt="Gráfico de Cumplimiento Normativo">
            </div>
            ` : ''}

            <table class="compliance-table">
                <thead>
                    <tr>
                        <th>Estándar</th>
                        <th>Cumplimiento</th>
                        <th>Puntuación</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.validations.map(validation => `
                    <tr>
                        <td>${validation.standard}</td>
                        <td>${validation.compliance ? 'Sí' : 'No'}</td>
                        <td>${validation.score}/100</td>
                        <td class="${validation.compliance ? 'success' : 'warning'}">
                            ${validation.compliance ? '✅ Aprobado' : '⚠️ Requiere atención'}
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

            ${data.validations.map(validation => `
            <div class="section">
                <h3>${validation.standard}</h3>
                ${validation.issues.map(issue => `
                <div class="critical-result ${issue.severity === 'error' ? 'warning' : ''}">
                    <strong>${issue.parameter}:</strong> ${issue.description}<br>
                    <strong>Valor:</strong> ${issue.value} | <strong>Límite:</strong> ${issue.limit}
                </div>
                `).join('')}
            </div>
            `).join('')}
        </div>
        ` : ''}

        ${data.config.includeRecommendations ? `
        <div class="section">
            <h2>💡 Recomendaciones</h2>
            <div class="recommendations">
                <h3>Recomendaciones de Cálculo</h3>
                <ul>
                    ${data.calculations.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            
            ${data.validations.map(validation => `
            <div class="recommendations">
                <h3>Recomendaciones - ${validation.standard}</h3>
                <ul>
                    ${validation.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="footer">
            <p>Reporte generado el ${new Date().toLocaleString()}</p>
            <p>Sistema de Análisis de Strings Críticos - Proyectos Solares Fotovoltaicos</p>
        </div>
    </body>
    </html>
    `;
  };

  // Función para generar el PDF
  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const reportData: ReportData = {
        project: projectData,
        calculations: calculationResults,
        validations: normativeValidations,
        config: reportConfig
      };

      const htmlContent = generateReportHTML(reportData);
      
      // Enviar al backend para generar PDF
      const response = await fetch('http://localhost:8000/api/reports/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: htmlContent,
          filename: `reporte_${projectData.name}_${new Date().toISOString().split('T')[0]}.pdf`
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${projectData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF. Verifique la conexión con el backend.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Función para previsualizar el reporte
  const previewReport = () => {
    const reportData: ReportData = {
      project: projectData,
      calculations: calculationResults,
      validations: normativeValidations,
      config: reportConfig
    };

    const htmlContent = generateReportHTML(reportData);
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(htmlContent);
      previewWindow.document.close();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <FileText className="text-blue-600" />
          Generador de Reportes PDF
        </h1>
        <p className="text-gray-600">
          Genere reportes profesionales integrando análisis de strings críticos y validaciones normativas
        </p>
      </div>

      {/* Canvas oculto para generar gráficos */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de Configuración */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Settings className="text-gray-600" />
              Configuración del Reporte
            </h2>

            {/* Tipo de Plantilla */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plantilla
              </label>
              <select
                value={reportConfig.template}
                onChange={(e) => setReportConfig({
                  ...reportConfig,
                  template: e.target.value as 'standard' | 'detailed' | 'executive'
                })}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="standard">Estándar</option>
                <option value="detailed">Detallado</option>
                <option value="executive">Ejecutivo</option>
              </select>
            </div>

            {/* Idioma */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Idioma
              </label>
              <select
                value={reportConfig.language}
                onChange={(e) => setReportConfig({
                  ...reportConfig,
                  language: e.target.value as 'es' | 'en'
                })}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Opciones de Contenido */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contenido a Incluir
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeCalculations}
                    onChange={(e) => setReportConfig({
                      ...reportConfig,
                      includeCalculations: e.target.checked
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">Cálculos Detallados</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeValidations}
                    onChange={(e) => setReportConfig({
                      ...reportConfig,
                      includeValidations: e.target.checked
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">Validaciones Normativas</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeCharts}
                    onChange={(e) => setReportConfig({
                      ...reportConfig,
                      includeCharts: e.target.checked
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">Gráficos y Visualizaciones</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeRecommendations}
                    onChange={(e) => setReportConfig({
                      ...reportConfig,
                      includeRecommendations: e.target.checked
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">Recomendaciones</span>
                </label>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="space-y-3">
              <button
                onClick={loadDataFromBackend}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Cargar Datos
              </button>
              
              <button
                onClick={previewReport}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Previsualizar
              </button>
              
              <button
                onClick={generatePDF}
                disabled={isGenerating}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {isGenerating ? 'Generando...' : 'Generar PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Panel de Datos del Proyecto */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Building className="text-gray-600" />
              Datos del Proyecto
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Proyecto
                </label>
                <input
                  type="text"
                  value={projectData.name}
                  onChange={(e) => setProjectData({...projectData, name: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Planta Solar ABC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ubicación
                </label>
                <input
                  type="text"
                  value={projectData.location}
                  onChange={(e) => setProjectData({...projectData, location: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Tegucigalpa, Honduras"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente
                </label>
                <input
                  type="text"
                  value={projectData.client}
                  onChange={(e) => setProjectData({...projectData, client: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Empresa XYZ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingeniero Responsable
                </label>
                <input
                  type="text"
                  value={projectData.engineer}
                  onChange={(e) => setProjectData({...projectData, engineer: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Ing. Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha del Proyecto
                </label>
                <input
                  type="date"
                  value={projectData.date}
                  onChange={(e) => setProjectData({...projectData, date: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacidad (kW)
                </label>
                <input
                  type="number"
                  value={projectData.capacity}
                  onChange={(e) => setProjectData({...projectData, capacity: Number(e.target.value)})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: 100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Strings
                </label>
                <input
                  type="number"
                  value={projectData.stringCount}
                  onChange={(e) => setProjectData({...projectData, stringCount: Number(e.target.value)})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: 20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Módulos
                </label>
                <input
                  type="number"
                  value={projectData.moduleCount}
                  onChange={(e) => setProjectData({...projectData, moduleCount: Number(e.target.value)})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: 400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Módulo
                </label>
                <input
                  type="text"
                  value={projectData.moduleType}
                  onChange={(e) => setProjectData({...projectData, moduleType: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Monocristalino 450W"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Inversor
                </label>
                <input
                  type="text"
                  value={projectData.inverterType}
                  onChange={(e) => setProjectData({...projectData, inverterType: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: String Inverter 50kW"
                />
              </div>
            </div>
          </div>

          {/* Resumen de Datos Cargados */}
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="text-blue-600" />
              Resumen de Datos Cargados
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cálculos */}
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Zap className="text-yellow-500 w-4 h-4" />
                  Cálculos Críticos
                </h4>
                {calculationResults.criticalString.stringId ? (
                  <div className="space-y-1 text-sm">
                    <p><strong>String ID:</strong> {calculationResults.criticalString.stringId}</p>
                    <p><strong>Caída de Tensión:</strong> {calculationResults.criticalString.voltageDrop.toFixed(2)} V</p>
                    <p><strong>Pérdida de Potencia:</strong> {calculationResults.criticalString.powerLoss.toFixed(2)} W</p>
                    <p><strong>Eficiencia:</strong> {calculationResults.criticalString.efficiency.toFixed(2)}%</p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No hay datos de cálculos cargados</p>
                )}
              </div>

              {/* Validaciones */}
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <CheckCircle className="text-green-500 w-4 h-4" />
                  Validaciones Normativas
                </h4>
                {normativeValidations.length > 0 ? (
                  <div className="space-y-1 text-sm">
                    {normativeValidations.map((validation, index) => (
                      <p key={index}>
                        <strong>{validation.standard}:</strong> {validation.score}/100
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No hay validaciones cargadas</p>
                )}
              </div>

              {/* Estado del Reporte */}
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="text-blue-500 w-4 h-4" />
                  Estado del Reporte
                </h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Plantilla:</strong> {reportConfig.template}</p>
                  <p><strong>Idioma:</strong> {reportConfig.language === 'es' ? 'Español' : 'English'}</p>
                  <p><strong>Secciones:</strong> {
                    [
                      reportConfig.includeCalculations && 'Cálculos',
                      reportConfig.includeValidations && 'Validaciones',
                      reportConfig.includeCharts && 'Gráficos',
                      reportConfig.includeRecommendations && 'Recomendaciones'
                    ].filter(Boolean).join(', ')
                  }</p>
                </div>
              </div>
            </div>
          </div>

          {/* Alertas y Avisos */}
          <div className="mt-6 space-y-4">
            {!projectData.name && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-yellow-600 w-5 h-5" />
                  <p className="text-yellow-800">
                    Complete los datos del proyecto para generar un reporte completo.
                  </p>
                </div>
              </div>
            )}

            {calculationResults.criticalString.stringId === '' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Zap className="text-blue-600 w-5 h-5" />
                  <p className="text-blue-800">
                    Cargue los datos de cálculos desde el backend o use el analizador de strings críticos.
                  </p>
                </div>
              </div>
            )}

            {normativeValidations.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-green-600 w-5 h-5" />
                  <p className="text-green-800">
                    Cargue las validaciones normativas desde el backend o use el validador de normativas.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Información Adicional */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">📚 Información sobre el Generador de Reportes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Características del Reporte</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Formato PDF profesional</li>
              <li>• Gráficos y visualizaciones integradas</li>
              <li>• Cálculos detallados con fórmulas</li>
              <li>• Validaciones normativas completas</li>
              <li>• Recomendaciones técnicas</li>
              <li>• Referencias y bibliografía</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Plantillas Disponibles</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <strong>Estándar:</strong> Reporte completo con todas las secciones</li>
              <li>• <strong>Detallado:</strong> Incluye cálculos paso a paso y análisis profundo</li>
              <li>• <strong>Ejecutivo:</strong> Resumen ejecutivo con conclusiones principales</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFReportGenerator;